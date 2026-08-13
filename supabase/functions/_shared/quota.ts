/**
 * Garde-fou de quota pour les fonctions serveur coûteuses.
 *
 * À appeler avant tout appel à un modèle d'IA ou à la voix — jamais après :
 * consommer le jeton une fois la facture déjà engagée ne protège de rien.
 *
 * L'incrément et le contrôle du plafond se font dans une seule instruction SQL
 * (voir `consume_quota`), donc deux requêtes simultanées ne peuvent pas franchir
 * la limite ensemble.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Familles d'usage facturées. Doit rester aligné sur la table `plan_quotas`. */
export type QuotaKind = "recommendation" | "chat" | "voice";

export interface QuotaVerdict {
  allowed: boolean;
  used: number;
  quota: number | null;
  plan: string;
}

/**
 * Consomme un jeton. En cas d'indisponibilité de la base, laisse passer :
 * un incident d'infrastructure ne doit pas rendre l'application inutilisable.
 * Le plafond protège d'un usage excessif, pas d'une panne.
 */
export async function consumeQuota(
  userId: string,
  kind: QuotaKind,
  amount = 1,
): Promise<QuotaVerdict> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.warn("[quota] service non configuré — appel laissé passer");
    return { allowed: true, used: 0, quota: null, plan: "unknown" };
  }

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc("consume_quota", {
    p_user_id: userId,
    p_kind: kind,
    p_amount: amount,
  });

  if (error) {
    console.error(`[quota] consume_quota a échoué (${kind}):`, error.message);
    return { allowed: true, used: 0, quota: null, plan: "unknown" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    console.error(`[quota] réponse vide pour ${kind}`);
    return { allowed: true, used: 0, quota: null, plan: "unknown" };
  }

  return {
    allowed: !!row.allowed,
    used: Number(row.used ?? 0),
    quota: row.quota == null ? null : Number(row.quota),
    plan: String(row.plan ?? "free"),
  };
}

const LIBELLES: Record<QuotaKind, string> = {
  recommendation: "recommandations",
  chat: "conversations",
  voice: "usages de la voix",
};

/**
 * Réponse 429 prête à renvoyer. Le message dit ce qui s'est passé et quand ça
 * repart — un refus sans horizon est une impasse pour l'utilisateur.
 */
export function quotaExceededResponse(
  kind: QuotaKind,
  verdict: QuotaVerdict,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: `Tu as atteint ta limite de ${LIBELLES[kind]} pour aujourd'hui (${verdict.used}/${verdict.quota}). Elle repart à zéro demain.`,
      quotaExceeded: true,
      kind,
      used: verdict.used,
      quota: verdict.quota,
      plan: verdict.plan,
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
