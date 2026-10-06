/**
 * send-push — envoie une notification sur les téléphones d'un utilisateur.
 *
 * Appelée par le déclencheur `push_on_notification_insert` à chaque nouvelle
 * ligne de `notifications`, avec pour seul paramètre l'identifiant de cette
 * ligne. Pas d'authentification (verify_jwt = false) et pas de secret partagé,
 * car la fonction ne fait confiance à rien de ce qu'on lui envoie :
 *
 * - elle relit la notification avec la clé de service — le titre et le texte
 *   viennent de la base, jamais de la requête ;
 * - elle n'envoie qu'une notification créée il y a moins de 10 minutes et
 *   jamais poussée, et la « réserve » atomiquement (pushed_at) avant l'envoi.
 *
 * Rappeler la fonction avec un identifiant connu ne fait donc rien du tout.
 *
 * Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. Sans eux, la fonction
 * ne fait rien et le dit dans ses journaux : la notification reste visible dans
 * l'application.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";
import { construirePush } from "../_shared/notification-routes.ts";

const FRAICHEUR_MAX_MS = 10 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);

  let notificationId: unknown;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return json({ error: "corps JSON invalide" }, 400);
  }
  if (typeof notificationId !== "string" || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
    return json({ error: "notification_id invalide" }, 400);
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    console.warn("[send-push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents : envoi ignoré");
    return json({ skipped: "vapid_missing" });
  }
  webpush.setVapidDetails("https://pick-your-spotlight.lovable.app", publicKey, privateKey);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Réservation atomique : une seule exécution peut poser pushed_at.
  const depuis = new Date(Date.now() - FRAICHEUR_MAX_MS).toISOString();
  const { data: notif, error: errReservation } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("pushed_at", null)
    .gte("created_at", depuis)
    .select("id, user_id, type, title, body, data")
    .maybeSingle();

  if (errReservation) {
    console.error("[send-push] réservation :", errReservation.message);
    return json({ error: "reservation" }, 500);
  }
  if (!notif) return json({ skipped: "deja_envoyee_ou_trop_ancienne" });

  const { data: abonnements, error: errAbos } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notif.user_id);

  if (errAbos) {
    console.error("[send-push] abonnements :", errAbos.message);
    return json({ error: "abonnements" }, 500);
  }
  if (!abonnements?.length) return json({ skipped: "aucun_appareil" });

  const contenu = JSON.stringify(construirePush(notif));
  let envoyees = 0;
  let retirees = 0;

  await Promise.all(abonnements.map(async (abo) => {
    try {
      await webpush.sendNotification(
        { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
        contenu,
        // « high » : sinon Android retarde la livraison tant que le téléphone
        // est en veille, et la notification n'arrivait qu'à l'ouverture de Pick.
        // Justifié : on n'envoie que des messages qui concernent la personne
        // (invitation, conseil d'un ami, film choisi), jamais de relance.
        { TTL: 60 * 60, urgency: "high" },
      );
      envoyees++;
      await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", abo.id);
    } catch (e) {
      const statut = (e as { statusCode?: number }).statusCode;
      // 404 / 410 : l'abonnement n'existe plus (application désinstallée,
      // autorisation retirée). On l'oublie pour ne plus essayer.
      if (statut === 404 || statut === 410) {
        retirees++;
        await admin.from("push_subscriptions").delete().eq("id", abo.id);
      } else {
        console.error("[send-push] envoi :", statut, (e as Error).message);
      }
    }
  }));

  return json({ envoyees, retirees });
});
