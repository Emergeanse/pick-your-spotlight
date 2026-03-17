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
  | "reviewed";

interface InteractionContext {
  mood?: string;
  context?: string;
  time?: string;
  source?: string;
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

// ── Temporal weighting ──
// Returns a weight between 0 and 1 based on how recent the event is.
// Yesterday = ~1.0, 1 month ago = ~0.7, 1 year ago = ~0.3, 3 years ago = ~0.05
function recencyWeight(dateStr: string): number {
  const daysAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  // Exponential decay with half-life of ~90 days
  return Math.exp(-0.0077 * daysAgo);
}

// ── Micro-genre / taste cluster inference ──
// Maps raw genres to richer taste clusters
const GENRE_TO_CLUSTERS: Record<string, string[]> = {
  "Thriller":        ["dark / intense", "suspense", "twist ending"],
  "Horreur":         ["dark / intense", "tension"],
  "Comédie":         ["feel good", "léger"],
  "Romance":         ["feel good", "cozy movie", "émotionnel"],
  "Drame":           ["émotionnel", "slow burn"],
  "Science-Fiction": ["mind blowing", "visually stunning"],
  "Fantastique":     ["visually stunning", "évasion"],
  "Animation":       ["visually stunning", "feel good"],
  "Action":          ["adrénaline", "spectaculaire"],
  "Aventure":        ["évasion", "spectaculaire"],
  "Documentaire":    ["intellectuel", "slow burn"],
  "Crime":           ["dark / intense", "thriller psychologique"],
  "Mystère":         ["thriller psychologique", "twist ending"],
  "Famille":         ["cozy movie", "feel good"],
  "Guerre":          ["dark / intense", "émotionnel"],
  "Western":         ["slow burn", "atmosphérique"],
  "Musique":         ["feel good", "émotionnel"],
  "Histoire":        ["intellectuel", "émotionnel"],
};

function inferClusters(genreCounts: Record<string, number>): Record<string, number> {
  const clusters: Record<string, number> = {};
  for (const [genre, count] of Object.entries(genreCounts)) {
    const mapped = GENRE_TO_CLUSTERS[genre] || [];
    for (const cluster of mapped) {
      clusters[cluster] = (clusters[cluster] || 0) + count;
    }
  }
  return clusters;
}

// ── Skip pattern analysis ──
interface SkipPattern {
  skippedGenres: Record<string, number>;
  avgSkipRate: number; // 0-1
  recentSkipStreak: number;
}

function analyzeSkipPatterns(
  interactions: any[],
  likedMovies: any[]
): SkipPattern {
  const skips = interactions.filter(i => i.action_type === "skipped");
  const watches = interactions.filter(i => i.action_type === "watched");
  const opens = interactions.filter(i => i.action_type === "opened");

  // Skip rate = skips / (skips + watches)
  const decisionCount = skips.length + watches.length;
  const avgSkipRate = decisionCount > 0 ? skips.length / decisionCount : 0.5;

  // Recent skip streak (how many consecutive skips at the top)
  let recentSkipStreak = 0;
  for (const i of interactions) {
    if (i.action_type === "skipped") recentSkipStreak++;
    else if (i.action_type === "watched" || i.action_type === "liked") break;
  }

  // Skipped genres (from context if available — we don't have genre data on interactions, 
  // so we track the context moods that get skipped)
  const skippedGenres: Record<string, number> = {};
  for (const s of skips) {
    const ctx = s.context || {};
    if (ctx.mood) {
      skippedGenres[ctx.mood] = (skippedGenres[ctx.mood] || 0) + 1;
    }
  }

  return { skippedGenres, avgSkipRate, recentSkipStreak };
}

// ── Confidence score ──
// Low data = low confidence = more discovery
// High data = high confidence = more precision
function computeConfidence(totalInteractions: number, likeCount: number): {
  score: number;  // 0-100
  discoveryRatio: number; // 0-1, how much discovery to inject
} {
  // Confidence grows with sqrt of interactions (diminishing returns)
  const rawConfidence = Math.min(100, Math.sqrt(totalInteractions) * 15);
  
  // Discovery ratio: inverse of confidence, clamped between 5% and 40%
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

// ── Main taste profile builder ──
export async function getUserTasteProfile() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  // Get liked movies with genres and timestamps
  const { data: likedMovies } = await supabase
    .from("liked_movies")
    .select("tmdb_id, genres, title, liked_at")
    .eq("user_id", userId);

  // Get all interactions (larger window for pattern analysis)
  const { data: interactions } = await supabase
    .from("user_interactions" as any)
    .select("tmdb_id, action_type, context, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500) as any;

  // Get profile preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("favorite_genres, preferred_platforms")
    .eq("id", userId)
    .single();

  // ── Temporally weighted genre counts ──
  const genreCounts: Record<string, number> = {};
  (likedMovies || []).forEach(m => {
    const weight = recencyWeight(m.liked_at);
    (m.genres || []).forEach((g: string) => {
      genreCounts[g] = (genreCounts[g] || 0) + weight;
    });
  });

  // Round for readability
  const roundedGenreCounts: Record<string, number> = {};
  for (const [g, c] of Object.entries(genreCounts)) {
    roundedGenreCounts[g] = Math.round(c * 100) / 100;
  }

  // ── Micro-genre clusters ──
  const clusters = inferClusters(roundedGenreCounts);
  const topClusters = Object.entries(clusters)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([c]) => c);

  // ── Interaction counts ──
  const allInteractions = interactions || [];
  const skipCount = allInteractions.filter((i: any) => i.action_type === "skipped").length;
  const watchCount = allInteractions.filter((i: any) => i.action_type === "watched").length;
  const openCount = allInteractions.filter((i: any) => i.action_type === "opened").length;
  const likeCount = (likedMovies || []).length;

  // ── Skip pattern analysis ──
  const skipPatterns = analyzeSkipPatterns(allInteractions, likedMovies || []);

  // ── Confidence & discovery ratio ──
  const totalSignals = likeCount + watchCount + skipCount;
  const confidence = computeConfidence(totalSignals, likeCount);

  // ── ID sets ──
  const skippedIds = allInteractions
    .filter((i: any) => i.action_type === "skipped")
    .map((i: any) => i.tmdb_id);

  const watchedIds = allInteractions
    .filter((i: any) => i.action_type === "watched")
    .map((i: any) => i.tmdb_id);

  const alreadySeenIds = allInteractions
    .filter((i: any) => i.action_type === "already_seen")
    .map((i: any) => i.tmdb_id);

  const likedIds = (likedMovies || []).map(m => m.tmdb_id);

  const topGenres = Object.entries(roundedGenreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([g]) => g);

  // ── Session context (from recent interactions) ──
  const recentContexts = allInteractions
    .slice(0, 5)
    .map((i: any) => i.context)
    .filter(Boolean);
  
  const sessionMood = recentContexts.find((c: any) => c.mood)?.mood || null;
  const sessionContext = recentContexts.find((c: any) => c.context)?.context || null;
  const sessionTime = recentContexts.find((c: any) => c.time)?.time || null;

  // ── Acceptance rate ──
  const decisionCount = watchCount + skipCount;
  const acceptanceRate = decisionCount > 0
    ? Math.round((watchCount / decisionCount) * 100)
    : 0;

  return {
    // Core taste
    topGenres,
    genreCounts: roundedGenreCounts,
    tasteClusters: topClusters,

    // Titles
    likedTitles: (likedMovies || []).map(m => m.title).slice(0, 20),

    // IDs for exclusion
    likedIds,
    skippedIds,
    watchedIds,
    alreadySeenIds,
    excludeIds: [...new Set([...skippedIds, ...watchedIds, ...likedIds, ...alreadySeenIds])],

    // Preferences
    preferredPlatforms: profile?.preferred_platforms || [],

    // Stats
    stats: {
      likeCount,
      watchCount,
      skipCount,
      openCount,
      acceptanceRate,
    },

    // Intelligence
    confidence,
    skipPatterns,

    // Session
    session: {
      mood: sessionMood,
      context: sessionContext,
      time: sessionTime,
    },

    // Scoring weights (can be tuned)
    scoringWeights: {
      taste_match: 0.35,
      context_match: 0.25,
      behaviour_match: 0.15,
      rating_score: 0.10,
      availability: 0.10,
      novelty: 0.05,
    },
  };
}
