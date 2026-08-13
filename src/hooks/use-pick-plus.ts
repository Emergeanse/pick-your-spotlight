/**
 * usePickPlus — affichage du palier et de la consommation.
 *
 * ⚠️ Ce hook ne protège rien. Il informe.
 *
 * Le plafonnement réel est appliqué côté serveur : chaque fonction coûteuse
 * consomme un jeton via `consume_quota` avant d'appeler un modèle, dans une
 * table que le navigateur ne peut pas écrire. Un utilisateur qui contournerait
 * ce hook se verrait simplement refuser par le serveur, avec un 429.
 *
 * C'était l'inverse avant : les compteurs vivaient dans `daily_usage`, que le
 * client pouvait remettre à zéro lui-même. La limite était décorative et rien
 * ne bornait le coût des appels d'IA.
 *
 * Les chiffres affichés viennent désormais de `get_my_quotas()`, qui lit la
 * même table que le serveur. Ce que voit l'utilisateur est donc ce qui
 * s'applique vraiment.
 *
 * Position alpha : tous les comptes sont sur le palier Pick+, offert. Les deux
 * paliers existent et fonctionnent — voir la migration des quotas pour basculer.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const FREE_RECO_LIMIT = 3;
const FREE_COMPANION_LIMIT = 1;
const FREE_DISCOVERY_CHAT_LIMIT = 1;

/** Une ligne de `get_my_quotas()` — la consommation telle que le serveur la voit. */
export interface QuotaRow {
  kind: "recommendation" | "chat" | "voice";
  used: number;
  quota: number | null;
  plan: string;
}

export interface PickPlusState {
  plan: "free" | "pick_plus";
  /** Consommation réelle du jour, tous types confondus. Vide si non chargée. */
  serverQuotas: QuotaRow[];
  /** Recharge les compteurs depuis le serveur — après un refus 429, par exemple. */
  refreshQuotas: () => Promise<void>;
  isPremium: boolean;
  loading: boolean;
  trialDaysLeft: number;
  recoUsed: number;
  recoLimit: number;
  recoRemaining: number;
  canRecommend: boolean;
  recordRecommendation: () => Promise<boolean>;
  getCompanionUsed: (movieId: number) => number;
  companionLimit: number;
  canAskCompanion: (movieId: number) => boolean;
  recordCompanionQuestion: (movieId: number) => Promise<boolean>;
  discoveryConvoUsed: number;
  canDiscoveryChat: boolean;
  discoveryConvoLocked: boolean;
  lockDiscoveryChat: () => void;
  recordDiscoveryConvo: () => Promise<boolean>;
  shouldShowPaywall: boolean;
  paywallTrigger: string;
  showPaywall: (trigger?: string) => void;
  hidePaywall: () => void;
}

export function usePickPlus(): PickPlusState {
  const { user } = useAuth();
  const [plan, setPlan] = useState<"free" | "pick_plus">("free");
  const [subStatus, setSubStatus] = useState<string>("active");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoUsed, setRecoUsed] = useState(0);
  const [discoveryConvoUsed, setDiscoveryConvoUsed] = useState(0);
  const [discoveryConvoLocked, setDiscoveryConvoLocked] = useState(false);
  const [companionUsage, setCompanionUsage] = useState<Record<string, number>>({});
  const [serverQuotas, setServerQuotas] = useState<QuotaRow[]>([]);
  const [shouldShowPaywall, setShouldShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState("general");

  // Le palier vient de l'abonnement réel. Pendant l'alpha, chaque compte est
  // sur `pick_plus` (offert), donc personne n'est dégradé — mais la bascule ne
  // demande plus de toucher au code.
  //
  // Par défaut à `true` tant que le chargement n'a pas répondu : afficher un
  // paywall pendant une fraction de seconde, puis le retirer, serait pire que
  // de ne rien afficher.
  const isPremium = loading || plan === "pick_plus";

  const trialDaysLeft = subStatus === "trial" && periodEnd
    ? Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / (1000 * 3600 * 24)))
    : 0;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [subRes, usageRes, quotaRes] = await Promise.all([
        supabase.from("subscriptions" as any).select("plan, status, current_period_end").eq("user_id", user.id).maybeSingle(),
        supabase.from("daily_usage" as any).select("recommendation_count, companion_questions, chat_count").eq("user_id", user.id).eq("usage_date", today).maybeSingle(),
        // Les compteurs qui font foi, ceux que le serveur applique réellement.
        (supabase as any).rpc("get_my_quotas"),
      ]);

      if (subRes.data) {
        const d = subRes.data as any;
        setPlan(d.plan === "free" ? "free" : "pick_plus");
        setSubStatus(d.status || "active");
        setPeriodEnd(d.current_period_end || null);
      }

      if (usageRes.data) {
        // Uniquement le suivi par film, que le serveur n'a pas à connaître.
        setCompanionUsage((usageRes.data as any).companion_questions || {});
      }

      const quotas: QuotaRow[] = Array.isArray(quotaRes?.data) ? quotaRes.data : [];
      setServerQuotas(quotas);
      const reco = quotas.find((q) => q.kind === "recommendation");
      const chat = quotas.find((q) => q.kind === "chat");
      if (reco) setRecoUsed(reco.used ?? 0);
      if (chat) setDiscoveryConvoUsed(chat.used ?? 0);
    } catch (e) {
      console.error("usePickPlus load error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Les plafonds viennent du serveur. Même Pick+ en a un : un palier sans
  // limite laisserait le risque de coût entier, ce qui est précisément ce que
  // les quotas corrigent. On retombe sur les constantes tant que la réponse
  // n'est pas arrivée.
  const quotaFor = (kind: QuotaRow["kind"], secours: number): number => {
    const row = serverQuotas.find((q) => q.kind === kind);
    if (!row) return isPremium ? Infinity : secours;
    return row.quota ?? Infinity;
  };

  const recoLimit = quotaFor("recommendation", FREE_RECO_LIMIT);
  const recoRemaining = Math.max(0, recoLimit - recoUsed);
  const canRecommend = recoUsed < recoLimit;

  const chatLimit = quotaFor("chat", FREE_DISCOVERY_CHAT_LIMIT);
  const canDiscoveryChat = discoveryConvoUsed < chatLimit && (isPremium || !discoveryConvoLocked);

  const recordRecommendation = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (!isPremium && recoUsed >= FREE_RECO_LIMIT) {
      setPaywallTrigger("reco_limit");
      setShouldShowPaywall(true);
      return false;
    }
    const today = new Date().toISOString().split("T")[0];
    const newCount = recoUsed + 1;
    const { error } = await supabase.from("daily_usage" as any).upsert(
      { user_id: user.id, usage_date: today, recommendation_count: newCount },
      { onConflict: "user_id,usage_date" }
    );
    if (!error) setRecoUsed(newCount);
    return !error;
  }, [user, isPremium, recoUsed]);

  const getCompanionUsed = useCallback((movieId: number): number => {
    return companionUsage[String(movieId)] || 0;
  }, [companionUsage]);

  const canAskCompanion = useCallback((movieId: number): boolean => {
    if (isPremium) return true;
    return (companionUsage[String(movieId)] || 0) < FREE_COMPANION_LIMIT;
  }, [isPremium, companionUsage]);

  const recordCompanionQuestion = useCallback(async (movieId: number): Promise<boolean> => {
    if (!user) return false;
    const key = String(movieId);
    const current = companionUsage[key] || 0;
    if (!isPremium && current >= FREE_COMPANION_LIMIT) {
      setPaywallTrigger("companion_limit");
      setShouldShowPaywall(true);
      return false;
    }
    const today = new Date().toISOString().split("T")[0];
    const updated = { ...companionUsage, [key]: current + 1 };
    const { error } = await supabase.from("daily_usage" as any).upsert(
      { user_id: user.id, usage_date: today, companion_questions: updated },
      { onConflict: "user_id,usage_date" }
    );
    if (!error) setCompanionUsage(updated);
    return !error;
  }, [user, isPremium, companionUsage]);

  const lockDiscoveryChat = useCallback(() => {
    if (!isPremium) setDiscoveryConvoLocked(true);
  }, [isPremium]);

  const recordDiscoveryConvo = useCallback(async (): Promise<boolean> => {
    if (!user || isPremium) return true;
    const today = new Date().toISOString().split("T")[0];
    const newCount = discoveryConvoUsed + 1;
    const { error } = await supabase.from("daily_usage" as any).upsert(
      { user_id: user.id, usage_date: today, chat_count: newCount },
      { onConflict: "user_id,usage_date" }
    );
    if (!error) setDiscoveryConvoUsed(newCount);
    return !error;
  }, [user, isPremium, discoveryConvoUsed]);

  return {
    plan,
    serverQuotas,
    refreshQuotas: loadData,
    isPremium,
    loading,
    trialDaysLeft,
    recoUsed,
    recoLimit,
    recoRemaining,
    canRecommend,
    recordRecommendation,
    getCompanionUsed,
    companionLimit: isPremium ? Infinity : FREE_COMPANION_LIMIT,
    canAskCompanion,
    recordCompanionQuestion,
    discoveryConvoUsed,
    canDiscoveryChat,
    discoveryConvoLocked,
    lockDiscoveryChat,
    recordDiscoveryConvo,
    shouldShowPaywall,
    paywallTrigger,
    showPaywall: (trigger = "general") => { setPaywallTrigger(trigger); setShouldShowPaywall(true); },
    hidePaywall: () => setShouldShowPaywall(false),
  };
}
