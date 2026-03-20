import { supabase } from "@/integrations/supabase/client";

/**
 * Engine Performance Metrics — computes KPIs from recommendation_events + user_interactions.
 * Section 16 of the recommendation spec.
 */

export interface EngineKPIs {
  // Primary metrics
  recommendationAcceptanceRate: number;    // % of recos accepted
  watchRateAfterRecommendation: number;    // % of accepted recos actually watched
  averageTimeToDecision: number;           // avg seconds between shown_at and reaction_at
  repeatUsageRate: number;                 // % of days user came back for a reco
  noveltyAcceptanceRate: number;           // % of "discovery" recos accepted
  groupMatchAcceptanceRate: number;        // % of group recos accepted

  // Diagnostics
  skipRate: number;                        // overall skip rate
  skipRateBySource: Record<string, number>;
  topRejectionReasons: { reason: string; count: number }[];
  fatigueByGenre: Record<string, number>;
  totalRecommendations: number;
  totalAccepted: number;
  totalSkipped: number;
  totalWatched: number;

  // Trust indicators
  saveRate: number;       // added to watchlist after reco
  likeRate: number;       // liked after reco
  confidenceScore: number;
}

export async function computeEngineKPIs(userId: string): Promise<EngineKPIs> {
  const [
    { data: recoEvents },
    { data: interactions },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("recommendation_events")
      .select("*")
      .eq("user_id", userId)
      .order("shown_at", { ascending: false })
      .limit(500),
    supabase
      .from("user_interactions")
      .select("action_type, context, created_at, tmdb_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("profile_confidence, total_recommendations, accepted_recommendations")
      .eq("id", userId)
      .single(),
  ]);

  const events = (recoEvents || []) as any[];
  const allInteractions = (interactions || []) as any[];

  const total = events.length;
  const accepted = events.filter(e => e.accepted === true).length;
  const skipped = events.filter(e => e.skipped === true).length;
  const watched = events.filter(e => e.watched === true).length;

  // Acceptance rate
  const recommendationAcceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  // Watch rate after acceptance
  const watchRateAfterRecommendation = accepted > 0 ? Math.round((watched / accepted) * 100) : 0;

  // Average time to decision
  const decisionsWithTime = events.filter(e => e.reaction_at && e.shown_at);
  const avgTime = decisionsWithTime.length > 0
    ? decisionsWithTime.reduce((sum, e) => {
        const diff = (new Date(e.reaction_at).getTime() - new Date(e.shown_at).getTime()) / 1000;
        return sum + Math.max(0, diff);
      }, 0) / decisionsWithTime.length
    : 0;

  // Repeat usage: distinct dates with recommendations
  const uniqueDates = new Set(events.map(e => e.shown_at?.split("T")[0]));
  const firstDate = events.length > 0 ? new Date(events[events.length - 1].shown_at) : new Date();
  const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
  const repeatUsageRate = Math.round((uniqueDates.size / daysSinceFirst) * 100);

  // Novelty acceptance: recos with source containing "discovery" or "exploration"
  const noveltyRecos = events.filter(e => e.source?.includes("discover") || e.context?.exploration);
  const noveltyAccepted = noveltyRecos.filter(e => e.accepted === true).length;
  const noveltyAcceptanceRate = noveltyRecos.length > 0 ? Math.round((noveltyAccepted / noveltyRecos.length) * 100) : 0;

  // Group acceptance
  const groupRecos = events.filter(e => e.source === "together");
  const groupAccepted = groupRecos.filter(e => e.accepted === true).length;
  const groupMatchAcceptanceRate = groupRecos.length > 0 ? Math.round((groupAccepted / groupRecos.length) * 100) : 0;

  // Skip rate by source
  const skipRateBySource: Record<string, number> = {};
  const sourceGroups: Record<string, { total: number; skipped: number }> = {};
  events.forEach(e => {
    const src = e.source || "unknown";
    if (!sourceGroups[src]) sourceGroups[src] = { total: 0, skipped: 0 };
    sourceGroups[src].total++;
    if (e.skipped) sourceGroups[src].skipped++;
  });
  for (const [src, data] of Object.entries(sourceGroups)) {
    skipRateBySource[src] = data.total > 0 ? Math.round((data.skipped / data.total) * 100) : 0;
  }

  // Top rejection reasons
  const reasonCounts: Record<string, number> = {};
  events.forEach(e => {
    if (e.reaction && e.reaction !== "accepted") {
      reasonCounts[e.reaction] = (reasonCounts[e.reaction] || 0) + 1;
    }
  });
  const topRejectionReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // Fatigue by genre
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentInteractions = allInteractions.filter(i => i.created_at >= sevenDaysAgo);
  const fatigueByGenre: Record<string, number> = {};
  recentInteractions.forEach((i: any) => {
    const genres = i.context?.genres || [];
    genres.forEach((g: string) => {
      fatigueByGenre[g] = (fatigueByGenre[g] || 0) + 1;
    });
  });

  // Trust: save & like rates
  const recoTmdbIds = new Set(events.map(e => e.tmdb_id));
  const savedAfterReco = allInteractions.filter(
    i => i.action_type === "watchlist_add" && recoTmdbIds.has(i.tmdb_id)
  ).length;
  const likedAfterReco = allInteractions.filter(
    i => i.action_type === "liked" && recoTmdbIds.has(i.tmdb_id)
  ).length;
  const saveRate = total > 0 ? Math.round((savedAfterReco / total) * 100) : 0;
  const likeRate = total > 0 ? Math.round((likedAfterReco / total) * 100) : 0;

  return {
    recommendationAcceptanceRate,
    watchRateAfterRecommendation,
    averageTimeToDecision: Math.round(avgTime),
    repeatUsageRate: Math.min(100, repeatUsageRate),
    noveltyAcceptanceRate,
    groupMatchAcceptanceRate,
    skipRate: total > 0 ? Math.round((skipped / total) * 100) : 0,
    skipRateBySource,
    topRejectionReasons,
    fatigueByGenre,
    totalRecommendations: total,
    totalAccepted: accepted,
    totalSkipped: skipped,
    totalWatched: watched,
    saveRate,
    likeRate,
    confidenceScore: (profile as any)?.profile_confidence || 0,
  };
}
