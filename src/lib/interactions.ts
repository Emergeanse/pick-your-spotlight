import { supabase } from "@/integrations/supabase/client";
import { getPreferencesSnapshot } from "@/lib/preferences";

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
  | "unknown"
  | "watch_clicked"
  | "reviewed"
  | "rejected_style"
  | "rejected_too_long"
  | "rejected_not_tonight"
  | "rejected_too_slow"
  | "rejected_too_intense"
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

type InteractionRow = {
  id?: string;
  tmdb_id: number;
  action_type: string;
  context?: InteractionContext | null;
  created_at: string;
};

type FeedbackCatalogItem = {
  id: string;
  tmdb_id: number;
  title: string;
  media_type: string;
  poster_path?: string | null;
  runtime?: number | null;
  year?: number | null;
  overview?: string | null;
};

type FeedbackRow = {
  item_id: string;
  action: string;
  feedback_type?: string | null;
  score?: number | null;
  created_at: string;
  catalog_items?: FeedbackCatalogItem | null;
};

interface SkipPattern {
  skippedGenres: Record<string, number>;
  avgSkipRate: number;
  recentSkipStreak: number;
  contextualRejections: {
    timeOfDay: Record<string, string[]>;
    withWho: Record<string, string[]>;
  };
}

export async function trackInteraction(tmdbId: number, actionType: ActionType, context: InteractionContext = {}) {
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

export async function updateRecommendationReaction(
  tmdbId: number,
  reaction: "accepted" | "skipped" | "rejected" | "watched",
  reactionDetail?: string,
) {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const { data: events } = await supabase
      .from("recommendation_events" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("tmdb_id", tmdbId)
      .order("shown_at", { ascending: false })
      .limit(1);

    const latestEvent = (events as unknown as Array<{ id: string }> | null)?.[0];

    if (latestEvent?.id) {
      await supabase
        .from("recommendation_events" as any)
        .update({
          accepted: reaction === "accepted" || reaction === "watched",
          skipped: reaction === "skipped" || reaction === "rejected",
          watched: reaction === "watched",
          reaction: reactionDetail || reaction,
          reaction_at: new Date().toISOString(),
        } as any)
        .eq("id", latestEvent.id);
    }
  } catch (e) {
    console.error("Failed to update reco reaction:", e);
  }
}

function analyzeSkipPatterns(interactions: InteractionRow[]): SkipPattern {
  const skipActionTypes = [
    "skipped",
    "rejected_style",
    "rejected_too_long",
    "rejected_not_tonight",
    "rejected_too_slow",
    "rejected_too_intense",
  ];

  const skips = interactions.filter((i) => skipActionTypes.includes(i.action_type));
  const watches = interactions.filter((i) => ["watched", "already_seen"].includes(i.action_type));

  const decisionCount = skips.length + watches.length;
  const avgSkipRate = decisionCount > 0 ? skips.length / decisionCount : 0.5;

  let recentSkipStreak = 0;
  for (const i of interactions) {
    if (skipActionTypes.includes(i.action_type)) recentSkipStreak++;
    else if (["watched", "already_seen", "liked", "saved"].includes(i.action_type)) break;
  }

  const skippedGenres: Record<string, number> = {};
  const contextualRejections: SkipPattern["contextualRejections"] = {
    timeOfDay: {},
    withWho: {},
  };

  for (const s of skips) {
    const ctx = s.context || {};

    if (Array.isArray(ctx.genres)) {
      ctx.genres.forEach((g) => {
        skippedGenres[g] = (skippedGenres[g] || 0) + 1;
      });
    }

    if (typeof ctx.mood === "string" && ctx.mood) {
      skippedGenres[ctx.mood] = (skippedGenres[ctx.mood] || 0) + 1;
    }

    if (typeof ctx.time === "string" && ctx.time && Array.isArray(ctx.genres)) {
      if (!contextualRejections.timeOfDay[ctx.time]) {
        contextualRejections.timeOfDay[ctx.time] = [];
      }
      contextualRejections.timeOfDay[ctx.time].push(...ctx.genres);
    }

    if (typeof ctx.context === "string" && ctx.context && Array.isArray(ctx.genres)) {
      if (!contextualRejections.withWho[ctx.context]) {
        contextualRejections.withWho[ctx.context] = [];
      }
      contextualRejections.withWho[ctx.context].push(...ctx.genres);
    }
  }

  return { skippedGenres, avgSkipRate, recentSkipStreak, contextualRejections };
}

function computeConfidence(totalInteractions: number): {
  score: number;
  discoveryRatio: number;
} {
  const rawConfidence = Math.min(100, Math.sqrt(totalInteractions) * 12);
  const discoveryRatio = Math.max(0.05, Math.min(0.4, 1 - rawConfidence / 100));
  return { score: Math.round(rawConfidence), discoveryRatio };
}

function inferClusters(genreCounts: Record<string, number>): Record<string, number> {
  const genreMap: Record<string, string[]> = {
    Thriller: ["dark / intense", "suspense"],
    Horreur: ["dark / intense", "tension"],
    Comédie: ["feel good", "léger"],
    Romance: ["feel good", "émotionnel"],
    Drame: ["émotionnel", "slow burn"],
    "Science-Fiction": ["mind blowing", "cérébral"],
    Action: ["adrénaline", "spectaculaire"],
    Aventure: ["évasion", "spectaculaire"],
  };

  const clusters: Record<string, number> = {};
  for (const [genre, count] of Object.entries(genreCounts)) {
    (genreMap[genre] || []).forEach((cluster) => {
      clusters[cluster] = (clusters[cluster] || 0) + count;
    });
  }
  return clusters;
}

export async function getAcceptanceRate(): Promise<number> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return 0;

  const { data: interactions } = await supabase
    .from("user_interactions" as any)
    .select("action_type")
    .eq("user_id", userId)
    .in("action_type", ["watched", "already_seen", "skipped"]);

  if (!interactions || interactions.length === 0) return 0;

  const watched = interactions.filter((i: any) => ["watched", "already_seen"].includes(i.action_type)).length;

  return Math.round((watched / interactions.length) * 100);
}

export async function getUserTasteProfile() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const [prefs, { data: profileData }, { data: feedbackRows }, { data: interactions }, { data: vectorData }, { data: peoplePrefs }] =
    await Promise.all([
      getPreferencesSnapshot(),
      supabase
        .from("profiles")
        .select("favorite_genres, excluded_genres")
        .eq("id", userId)
        .single(),
      supabase
        .from("user_item_feedback")
        .select(
          `
        item_id,
        action,
        feedback_type,
        score,
        created_at,
        catalog_items:item_id (
          id,
          tmdb_id,
          title,
          media_type,
          poster_path,
          runtime,
          year,
          overview
        )
      `,
        )
        .eq("user_id", userId)
        .limit(5000),
      supabase
        .from("user_interactions" as any)
        .select("id, tmdb_id, action_type, context, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("user_taste_vectors" as any)
        .select(
          "avoidance_vector, recent_taste_vector, stable_confidence, novelty_tolerance, fatigue_state, top_clusters, rejected_clusters",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      (supabase.from("user_people_preferences" as any) as any)
        .select("person_name, person_type, preference, known_for")
        .eq("user_id", userId),
    ]);

  const allFeedback = ((feedbackRows || []) as unknown as FeedbackRow[]).filter((row) => row?.catalog_items?.tmdb_id);
  const allInteractions = (interactions || []) as unknown as InteractionRow[];

  const positiveRows = allFeedback.filter((r) => ["like", "love"].includes(r.feedback_type ?? r.action));
  const seenRows = allFeedback.filter((r) => (r.feedback_type ?? r.action) === "seen");
  const watchlistRows = allFeedback.filter((r) => (r.feedback_type ?? r.action) === "watchlist");
  const skipRows = allFeedback.filter((r) => (r.feedback_type ?? r.action) === "skip");
  const rejectedRows = allFeedback.filter((r) => ["not_for_me", "dislike"].includes(r.feedback_type ?? r.action));

  // Build genre counts from positive interactions (context.genres) with a like/watch bonus
  const genreCounts: Record<string, number> = {};
  for (const i of allInteractions) {
    const ctx = i.context as any;
    if (!Array.isArray(ctx?.genres)) continue;
    const weight =
      i.action_type === "liked" || i.action_type === "post_watch_loved" ? 2 :
      i.action_type === "watched" || i.action_type === "already_seen" || i.action_type === "post_watch_good" ? 1.5 :
      i.action_type === "saved" ? 1 : 0;
    if (weight === 0) continue;
    for (const g of ctx.genres as string[]) {
      genreCounts[g] = (genreCounts[g] || 0) + weight;
    }
  }
  const roundedGenreCounts: Record<string, number> = {};
  for (const [g, c] of Object.entries(genreCounts)) {
    roundedGenreCounts[g] = Math.round(c * 100) / 100;
  }

  const skipCount = skipRows.length;
  const watchCount = seenRows.length;
  const openCount = allInteractions.filter((i) => i.action_type === "opened").length;
  const likeCount = positiveRows.length;

  const skipPatterns = analyzeSkipPatterns(allInteractions);
  const totalSignals = likeCount + watchCount + skipCount;
  const confidence = computeConfidence(totalSignals);

  const likedIds = positiveRows.map((r) => r.catalog_items?.tmdb_id).filter(Boolean) as number[];

  const skippedIds = skipRows.map((r) => r.catalog_items?.tmdb_id).filter(Boolean) as number[];

  const watchedIds = seenRows.map((r) => r.catalog_items?.tmdb_id).filter(Boolean) as number[];

  const watchlistIds = watchlistRows.map((r) => r.catalog_items?.tmdb_id).filter(Boolean) as number[];

  const rejectedIds = rejectedRows.map((r) => r.catalog_items?.tmdb_id).filter(Boolean) as number[];

  const unlikedIds = allInteractions
    .filter((i: any) => i.action_type === "unliked")
    .map((i: any) => i.tmdb_id)
    .filter((id): id is number => typeof id === "number" && id > 0);

  // Genres explicites : union de "Mon Cinéma" (user_preferences) + profil/onboarding (profiles.favorite_genres)
  // Fallback sur l'historique d'interactions si aucune préférence explicite n'est définie
  const explicitLikedGenres = [
    ...new Set([
      ...prefs.genres.liked,
      ...((profileData as any)?.favorite_genres || []),
    ]),
  ];
  const explicitExcludedGenres = [
    ...new Set([
      ...prefs.genres.excluded,
      ...((profileData as any)?.excluded_genres || []),
    ]),
  ];

  const topGenres =
    explicitLikedGenres.length > 0
      ? explicitLikedGenres.slice(0, 8)
      : Object.entries(roundedGenreCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([g]) => g);

  const recentContexts = allInteractions
    .slice(0, 5)
    .map((i) => i.context)
    .filter(Boolean) as InteractionContext[];

  const sessionMood = recentContexts.find((c) => typeof c.mood === "string" && c.mood)?.mood || null;
  const sessionContext = recentContexts.find((c) => typeof c.context === "string" && c.context)?.context || null;
  const sessionTime = recentContexts.find((c) => typeof c.time === "string" && c.time)?.time || null;

  const decisionCount = watchCount + skipCount;
  const acceptanceRate = decisionCount > 0 ? Math.round((watchCount / decisionCount) * 100) : 0;

  const multiVectorData = vectorData as any;

  const topClusters =
    multiVectorData?.top_clusters ||
    Object.entries(inferClusters(roundedGenreCounts))
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8)
      .map(([c]) => c);

  const rejectedClusters = multiVectorData?.rejected_clusters || [];
  const fatigueState = multiVectorData?.fatigue_state || {};

  const allPeoplePrefs = (peoplePrefs || []) as any[];
  const lovedActors = allPeoplePrefs
    .filter((p) => p.person_type === "actor" && p.preference === "loved")
    .map((p) => p.person_name);
  const likedActors = allPeoplePrefs
    .filter((p) => p.person_type === "actor" && p.preference === "liked")
    .map((p) => p.person_name);
  const dislikedActors = allPeoplePrefs
    .filter((p) => p.person_type === "actor" && p.preference === "disliked")
    .map((p) => p.person_name);
  const lovedDirectors = allPeoplePrefs
    .filter((p) => p.person_type === "director" && p.preference === "loved")
    .map((p) => p.person_name);
  const likedDirectors = allPeoplePrefs
    .filter((p) => p.person_type === "director" && p.preference === "liked")
    .map((p) => p.person_name);
  const dislikedDirectors = allPeoplePrefs
    .filter((p) => p.person_type === "director" && p.preference === "disliked")
    .map((p) => p.person_name);

  return {
    topGenres,
    genreCounts: roundedGenreCounts,
    tasteClusters: topClusters,
    rejectedClusters,
    fatigueState,

    likedTitles: positiveRows
      .map((r) => r.catalog_items?.title)
      .filter(Boolean)
      .slice(0, 20),

    likedIds,
    skippedIds,
    watchedIds,
    alreadySeenIds: watchedIds,
    watchlistIds,
    rejectedIds,
    excludeIds: [...new Set([...watchedIds, ...rejectedIds, ...unlikedIds])],

    preferredPlatforms: prefs.platforms.liked,
    excludedPlatforms: prefs.platforms.excluded,
    favoriteGenres: explicitLikedGenres,
    excludedGenres: explicitExcludedGenres,
    mediaPreference: prefs.mediaType,
    maxDuration: prefs.maxDuration,
    minRating: prefs.minRating,

    peoplePreferences: {
      lovedActors,
      likedActors,
      dislikedActors,
      lovedDirectors,
      likedDirectors,
      dislikedDirectors,
    },

    stats: {
      likeCount,
      watchCount,
      skipCount,
      openCount,
      watchlistCount: watchlistRows.length,
      rejectedCount: rejectedRows.length,
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

    hasAvoidanceVector: !!multiVectorData?.avoidance_vector,
    hasRecentVector: !!multiVectorData?.recent_taste_vector,

    scoringWeights: {
      stable_taste: 0.16,
      recent_taste: 0.1,
      session_context: 0.16,
      embedding_similarity: 0.1,
      acceptance_likelihood: 0.1,
      rejection_risk: -0.1,
      quality_score: 0.06,
      novelty_fit: 0.05,
      availability: 0.04,
      fatigue_penalty: -0.03,
      strategic_boost: 0.02,
      people_affinity: 0.11,
    },
  };
}
