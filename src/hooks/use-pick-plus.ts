/**
 * usePickPlus — freemium gating hook for Pick+.
 * 
 * Free limits:
 * - 3 recommendations per day
 * - 5 companion questions per film
 * 
 * Pick+ (plan !== 'free') → unlimited.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const FREE_RECO_LIMIT = 3;
const FREE_COMPANION_LIMIT = 1;
const FREE_CHAT_LIMIT = 5;

export interface PickPlusState {
  plan: "free" | "pick_plus";
  isPremium: boolean;
  loading: boolean;
  // Recommendation limits
  recoUsed: number;
  recoLimit: number;
  recoRemaining: number;
  canRecommend: boolean;
  recordRecommendation: () => Promise<boolean>;
  // Companion limits
  getCompanionUsed: (movieId: number) => number;
  companionLimit: number;
  canAskCompanion: (movieId: number) => boolean;
  recordCompanionQuestion: (movieId: number) => Promise<boolean>;
  // Chat limits
  chatUsed: number;
  chatLimit: number;
  chatRemaining: number;
  canChat: boolean;
  recordChatMessage: () => Promise<boolean>;
  // Paywall
  shouldShowPaywall: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
}

export function usePickPlus(): PickPlusState {
  const { user } = useAuth();
  const [plan, setPlan] = useState<"free" | "pick_plus">("free");
  const [loading, setLoading] = useState(true);
  const [recoUsed, setRecoUsed] = useState(0);
  const [chatUsed, setChatUsed] = useState(0);
  const [companionUsage, setCompanionUsage] = useState<Record<string, number>>({});
  const [shouldShowPaywall, setShouldShowPaywall] = useState(false);

  const isPremium = plan !== "free";

  // Load subscription + today's usage
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
        supabase.from("subscriptions" as any).select("plan, status").eq("user_id", user.id).maybeSingle(),
        supabase.from("daily_usage" as any).select("recommendation_count, companion_questions, chat_count").eq("user_id", user.id).eq("usage_date", today).maybeSingle(),
      ]);

      if (subRes.data && (subRes.data as any).status === "active") {
        const p = (subRes.data as any).plan;
        setPlan(p === "free" ? "free" : "pick_plus");
      }

      if (usageRes.data) {
        setRecoUsed((usageRes.data as any).recommendation_count || 0);
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

  const recordRecommendation = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (!isPremium && recoUsed >= FREE_RECO_LIMIT) {
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

  return {
    plan,
    isPremium,
    loading,
    recoUsed,
    recoLimit,
    recoRemaining,
    canRecommend,
    recordRecommendation,
    getCompanionUsed,
    companionLimit: isPremium ? Infinity : FREE_COMPANION_LIMIT,
    canAskCompanion,
    recordCompanionQuestion,
    shouldShowPaywall,
    showPaywall: () => setShouldShowPaywall(true),
    hidePaywall: () => setShouldShowPaywall(false),
  };
}
