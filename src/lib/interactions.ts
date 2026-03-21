import { supabase } from "@/integrations/supabase/client";

export type ActionType = 
  | "liked" 
  | "unliked" 
  | "saved" 
  | "unsaved" 
  | "watched" 
  | "skipped" 
  | "opened" 
  | "searched"
  | "already_seen"
  | "unsure"
  | "watch_clicked"
  | "reviewed"
  // New enriched rejection types
  | "rejected_style"     // "Pas mon style"
  | "rejected_too_long"  // "Trop long"
  | "rejected_not_tonight" // "Pas ce soir"
  | "rejected_too_slow"  // "Trop lent"
  | "rejected_too_intense" // "Trop intense"
  // Post-watch feedback
  | "post_watch_loved"
  | "post_watch_good"
  | "post_watch_meh"
  | "post_watch_regret";

export interface InteractionContext {
  mood?: string;
  context?: string;
  time?: string;
  source?: string;
  genres?: string[];
  title?: string;
  runtime?: number;
  session_id?: string;
  rejection_reason?: string;
  time_to_decision_ms?: number;
  [key: string]: unknown;
}

export async function trackInteraction(
  tmdbId: number,
  actionType: ActionType,
  context: InteractionContext = {}
) {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    await supabase.from("user_interactions" as any).insert({
      user_id: userId,
      tmdb_id: tmdbId,
      action_type: actionType,
      context,
    } as any);
  } catch (e) {
    console.error("Failed to track interaction:", e);
  }
}

/**
 * Track a recommendation event (what was shown and how user reacted)
 */
export async function trackRecommendationEvent(params: {
  tmdbId: number;
  title: string;
  source: string;
  rankPosition?: number;
  scoreBreakdown?: Record<string, number>;
  context?: Record<string, unknown>;
}) {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    await supabase.from("recommendation_events" as any).insert({
      user_id: userId,
      tmdb_id: params.tmdbId,
      title: params.title,
      source: params.source,
      rank_position: params.rankPosition || 1,
      score_breakdown: params.scoreBreakdown || {},
      context: params.context || {},
    } as any);
  } catch (e) {
    console.error("Failed to track reco event:", e);
  }
}

/**
 * Update a recommendation event with user's reaction
 */
export async function updateRecommendationReaction(
  tmdbId: number,
  reaction: "accepted" | "skipped" | "rejected" | "watched",
  reactionDetail?: string
) {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    // Find the most recent reco event for this movie
    const { data: events } = await supabase
      .from("recommendation_events" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("tmdb_id", tmdbId)
      .order("shown_at", { ascending: false })
      .limit(1) as any;

    if (events && events.length > 0) {
      await supabase
        .from("recommendation_events" as any)
        .update({
          accepted: reaction === "accepted" || reaction === "watched",
          skipped: reaction === "skipped" || reaction === "rejected",
          watched: reaction === "watched",
          reaction: reactionDetail || reaction,
          reaction_at: new Date().toISOString(),
        } as any)
        .eq("id", events[0].id);
    }
  } catch (e) {
    console.error("Failed to update reco reaction:", e);
  }
}

// ── Temporal weighting ──
function recencyWeight(dateStr: string): number {
  const daysAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-0.0077 * daysAgo); // half-life ~90 days
}

// ── Skip pattern analysis ──
interface SkipPattern {
  skippedGenres: Record<string, number>;
  avgSkipRate: number;
  recentSkipStreak: number;
  contextualRejections: {
    timeOfDay: Record<string, string[]>; // e.g., "evening" -> ["horror", "dark"]
    withWho: Record<string, string[]>;   // e.g., "couple" -> ["violence"]
  };
}

function analyzeSkipPatterns(interactions: any[]): SkipPattern {
  const skips = interactions.filter(i => 
    ["skipped", "rejected_style", "rejected_too_long", "rejected_not_tonight", "rejected_too_slow", "rejected_too_intense"].includes(i.action_type)
  );
  const watches = interactions.filter(i => i.action_type === "watched");

  const decisionCount = skips.length + watches.length;
  const avgSkipRate = decisionCount > 0 ? skips.length / decisionCount : 0.5;

  let recentSkipStreak = 0;
  for (const i of interactions) {
    if (skips.some(s => s.id === i.id)) recentSkipStreak++;
    else if (["watched", "liked"].includes(i.action_type)) break;
  }

  const skippedGenres: Record<string, number> = {};
  const contextualRejections: SkipPattern["contextualRejections"] = {
    timeOfDay: {},
    withWho: {},
  };

  for (const s of skips) {
    const ctx = s.context || {};
    // Track skipped genres
    if (ctx.genres) {
      (ctx.genres as string[]).forEach((g: string) => {
        skippedGenres[g] = (skippedGenres[g] || 0) + 1;
      });
    }
    if (ctx.mood) {
      skippedGenres[ctx.mood] = (skippedGenres[ctx.mood] || 0) + 1;
    }
    // Contextual rejection memory
    if (ctx.time && ctx.genres) {
      if (!contextualRejections.timeOfDay[ctx.time]) {
        contextualRejections.timeOfDay[ctx.time] = [];
      }
      contextualRejections.timeOfDay[ctx.time].push(...(ctx.genres as string[]));
    }
    if (ctx.context && ctx.genres) {
      if (!contextualRejections.withWho[ctx.context]) {
        contextualRejections.withWho[ctx.context] = [];
      }
      contextualRejections.withWho[ctx.context].push(...(ctx.genres as string[]));
    }
  }

  return { skippedGenres, avgSkipRate, recentSkipStreak, contextualRejections };
}

// ── Confidence score ──
function computeConfidence(totalInteractions: number, likeCount: number): {
  score: number;
  discoveryRatio: number;
} {
  const rawConfidence = Math.min(100, Math.sqrt(totalInteractions) * 12);
  const discoveryRatio = Math.max(0.05, Math.min(0.4, 1 - rawConfidence / 100));
  return { score: Math.round(rawConfidence), discoveryRatio };
}

// ── Acceptance rate ──
export async function getAcceptanceRate(): Promise<number> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return 0;

  const { data: interactions } = await supabase
    .from("user_interactions" as any)
    .select("action_type")
    .eq("user_id", userId)
    .in("action_type", ["watched", "skipped"]) as any;

  if (!interactions || interactions.length === 0) return 0;
  const watched = interactions.filter((i: any) => i.action_type === "watched").length;
  return Math.round((watched / interactions.length) * 100);
}

// ── Main taste profile builder (enriched) ──
export async function getUserTasteProfile() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const [
    { data: likedMovies },
    { data: interactions },
    { data: profile },
    { data: watchlist },
    { data: vectorData },
    { data: peoplePrefs },
  ] = await Promise.all([
    supabase.from("liked_movies")
      .select("tmdb_id, genres, title, liked_at")
      .eq("user_id", userId),
    supabase.from("user_interactions" as any)
      .select("tmdb_id, action_type, context, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500) as any,
    supabase.from("profiles")
      .select("favorite_genres, preferred_platforms")
      .eq("id", userId)
      .single(),
    supabase.from("watchlist")
      .select("tmdb_id")
      .eq("user_id", userId),
    supabase.from("user_taste_vectors" as any)
      .select("avoidance_vector, recent_taste_vector, stable_confidence, novelty_tolerance, fatigue_state, top_clusters, rejected_clusters")
      .eq("user_id", userId)
      .maybeSingle(),
    (supabase.from("user_people_preferences" as any) as any)
      .select("person_name, person_type, preference, known_for")
      .eq("user_id", userId),
  ]);

  // Temporally weighted genre counts
  const genreCounts: Record<string, number> = {};
  (likedMovies || []).forEach(m => {
    const weight = recencyWeight(m.liked_at);
    (m.genres || []).forEach((g: string) => {
      genreCounts[g] = (genreCounts[g] || 0) + weight;
    });
  });

  const roundedGenreCounts: Record<string, number> = {};
  for (const [g, c] of Object.entries(genreCounts)) {
    roundedGenreCounts[g] = Math.round(c * 100) / 100;
  }

  // Interaction analysis
  const allInteractions = (interactions || []) as any[];
  const skipCount = allInteractions.filter((i: any) => 
    ["skipped", "rejected_style", "rejected_too_long", "rejected_not_tonight", "rejected_too_slow", "rejected_too_intense"].includes(i.action_type)
  ).length;
  const watchCount = allInteractions.filter((i: any) => i.action_type === "watched").length;
  const openCount = allInteractions.filter((i: any) => i.action_type === "opened").length;
  const likeCount = (likedMovies || []).length;

  const skipPatterns = analyzeSkipPatterns(allInteractions);
  const totalSignals = likeCount + watchCount + skipCount;
  const confidence = computeConfidence(totalSignals, likeCount);

  // ID sets for exclusion
  const skippedIds = allInteractions
    .filter((i: any) => ["skipped", "rejected_style", "rejected_too_long"].includes(i.action_type))
    .map((i: any) => i.tmdb_id);
  const watchedIds = allInteractions
    .filter((i: any) => i.action_type === "watched")
    .map((i: any) => i.tmdb_id);
  const alreadySeenIds = allInteractions
    .filter((i: any) => i.action_type === "already_seen")
    .map((i: any) => i.tmdb_id);
  const likedIds = (likedMovies || []).map(m => m.tmdb_id);
  const watchlistIds = (watchlist || []).map(w => w.tmdb_id);

  const topGenres = Object.entries(roundedGenreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([g]) => g);

  // Session context
  const recentContexts = allInteractions.slice(0, 5).map((i: any) => i.context).filter(Boolean);
  const sessionMood = recentContexts.find((c: any) => c.mood)?.mood || null;
  const sessionContext = recentContexts.find((c: any) => c.context)?.context || null;
  const sessionTime = recentContexts.find((c: any) => c.time)?.time || null;

  // Acceptance rate
  const decisionCount = watchCount + skipCount;
  const acceptanceRate = decisionCount > 0 ? Math.round((watchCount / decisionCount) * 100) : 0;

  // Multi-vector data from cache
  const multiVectorData = vectorData as any;

  // Clusters from cache or genre inference
  const topClusters = multiVectorData?.top_clusters || 
    Object.entries(inferClusters(roundedGenreCounts))
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8)
      .map(([c]) => c);

  const rejectedClusters = multiVectorData?.rejected_clusters || [];
  const fatigueState = multiVectorData?.fatigue_state || {};

  // Cluster inference helper (local)
  function inferClusters(gc: Record<string, number>): Record<string, number> {
    const GENRE_MAP: Record<string, string[]> = {
      "Thriller": ["dark / intense", "suspense"], "Horreur": ["dark / intense", "tension"],
      "Comédie": ["feel good", "léger"], "Romance": ["feel good", "émotionnel"],
      "Drame": ["émotionnel", "slow burn"], "Science-Fiction": ["mind blowing", "cérébral"],
      "Action": ["adrénaline", "spectaculaire"], "Aventure": ["évasion", "spectaculaire"],
    };
    const clusters: Record<string, number> = {};
    for (const [genre, count] of Object.entries(gc)) {
      (GENRE_MAP[genre] || []).forEach(c => { clusters[c] = (clusters[c] || 0) + count; });
    }
    return clusters;
  }

  return {
    topGenres,
    genreCounts: roundedGenreCounts,
    tasteClusters: topClusters,
    rejectedClusters,
    fatigueState,

    likedTitles: (likedMovies || []).map(m => m.title).slice(0, 20),

    // IDs for exclusion (comprehensive)
    likedIds,
    skippedIds,
    watchedIds,
    alreadySeenIds,
    watchlistIds,
    excludeIds: [...new Set([...skippedIds, ...watchedIds, ...likedIds, ...alreadySeenIds, ...watchlistIds])],

    preferredPlatforms: profile?.preferred_platforms || [],

    stats: {
      likeCount,
      watchCount,
      skipCount,
      openCount,
      acceptanceRate,
    },

    confidence: {
      score: multiVectorData?.stable_confidence || confidence.score,
      discoveryRatio: multiVectorData?.novelty_tolerance || confidence.discoveryRatio,
    },
    skipPatterns,

    session: {
      mood: sessionMood,
      context: sessionContext,
      time: sessionTime,
    },

    // Multi-vector references (the actual vectors are computed in taste-engine.ts)
    hasAvoidanceVector: !!multiVectorData?.avoidance_vector,
    hasRecentVector: !!multiVectorData?.recent_taste_vector,

    // Enhanced scoring weights
    scoringWeights: {
      stable_taste: 0.18,
      recent_taste: 0.12,
      session_context: 0.18,
      embedding_similarity: 0.12,
      acceptance_likelihood: 0.12,
      rejection_risk: -0.10,
      quality_score: 0.06,
      novelty_fit: 0.05,
      availability: 0.04,
      fatigue_penalty: -0.03,
      strategic_boost: 0.02,
    },
  };
}
