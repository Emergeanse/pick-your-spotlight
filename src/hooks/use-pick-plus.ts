/**
 * usePickPlus — freemium gating hook for Pick+.
 * 
 * Free limits:
 * - 3 recommendations per day
 * - 1 companion question per film
 * - 1 discovery conversation per day (chat locked after reco received)
 * - No full chatbot access (Pick+ only)
 * 
 * Pick+ (plan !== 'free') → unlimited everything + full chatbot.
 * Trial: 7 days granted after completing activation flow.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const FREE_RECO_LIMIT = 3;
const FREE_COMPANION_LIMIT = 1;
const FREE_DISCOVERY_CHAT_LIMIT = 1;

export interface PickPlusState {
  plan: "free" | "pick_plus";
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
  const [shouldShowPaywall, setShouldShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState("general");

  // TEMPORARY: All users are premium until Pick+ launch
  const isPremium = true;

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

      const [subRes, usageRes] = await Promise.all([
        supabase.from("subscriptions" as any).select("plan, status, current_period_end").eq("user_id", user.id).maybeSingle(),
        supabase.from("daily_usage" as any).select("recommendation_count, companion_questions, chat_count").eq("user_id", user.id).eq("usage_date", today).maybeSingle(),
      ]);

      if (subRes.data) {
        const d = subRes.data as any;
        setPlan(d.plan === "free" ? "free" : "pick_plus");
        setSubStatus(d.status || "active");
        setPeriodEnd(d.current_period_end || null);
      }

      if (usageRes.data) {
        setRecoUsed((usageRes.data as any).recommendation_count || 0);
        setDiscoveryConvoUsed((usageRes.data as any).chat_count || 0);
        setCompanionUsage((usageRes.data as any).companion_questions || {});
      }
    } catch (e) {
      console.error("usePickPlus load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const recoLimit = isPremium ? Infinity : FREE_RECO_LIMIT;
  const recoRemaining = isPremium ? Infinity : Math.max(0, FREE_RECO_LIMIT - recoUsed);
  const canRecommend = isPremium || recoUsed < FREE_RECO_LIMIT;
  const canDiscoveryChat = isPremium || (discoveryConvoUsed < FREE_DISCOVERY_CHAT_LIMIT && !discoveryConvoLocked);

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
