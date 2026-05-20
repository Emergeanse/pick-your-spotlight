import { supabase } from "@/integrations/supabase/client";

const VECTOR_DIM = 32;

// ── Half-life constants (in days) ──
const STABLE_HALF_LIFE = 150; // ~5 months
const RECENT_HALF_LIFE = 21;  // ~3 weeks
const AVOIDANCE_HALF_LIFE = 60; // ~2 months

function decayWeight(dateStr: string, halfLifeDays: number): number {
  const daysAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-0.693 * daysAgo / halfLifeDays);
}

/**
 * Generates or retrieves a movie embedding from the cache.
 */
export async function getMovieEmbedding(
  tmdbId: number,
  title: string,
  overview: string,
  genres: string[]
): Promise<{ embedding: number[]; tasteTags: string[] } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-embedding", {
      body: { tmdbId, title, overview, genres },
    });
    if (error) {
      console.error("Embedding error:", error);
      return null;
    }
    return { embedding: data.embedding, tasteTags: data.tasteTags };
  } catch (e) {
    console.error("Failed to get embedding:", e);
    return null;
  }
}

/**
 * Triggers embedding generation for a movie in the background.
 */
export function ensureMovieEmbedding(
  tmdbId: number,
  title: string,
  overview: string,
  genres: string[]
): void {
  getMovieEmbedding(tmdbId, title, overview, genres).catch(() => {});
}

// ── Helper: weighted average vector ──
function weightedAverageVector(
  items: { vec: number[]; weight: number }[]
): number[] | null {
  if (items.length === 0) return null;
  const result = new Array(VECTOR_DIM).fill(0);
  let totalWeight = 0;
  for (const { vec, weight } of items) {
    if (!vec || vec.length !== VECTOR_DIM) continue;
    totalWeight += weight;
    for (let i = 0; i < VECTOR_DIM; i++) {
      result[i] += vec[i] * weight;
    }
  }
  if (totalWeight === 0) return null;
  for (let i = 0; i < VECTOR_DIM; i++) {
    result[i] /= totalWeight;
  }
  return result;
}

// ── Parse vector from DB string ──
function parseVector(vec: any): number[] | null {
  if (!vec) return null;
  if (Array.isArray(vec)) return vec;
  if (typeof vec === "string") {
    try {
      return JSON.parse(vec.replace(/^\[/, "[").replace(/\]$/, "]"));
    } catch {
      return null;
    }
  }
  return null;
}

// ── Cluster inference from genres ──
const GENRE_TO_CLUSTERS: Record<string, string[]> = {
  "Thriller":        ["dark / intense", "suspense", "twist ending"],
  "Horreur":         ["dark / intense", "tension", "visceral"],
  "Comédie":         ["feel good", "léger", "divertissant"],
  "Romance":         ["feel good", "cozy movie", "émotionnel"],
  "Drame":           ["émotionnel", "slow burn", "profond"],
  "Science-Fiction": ["mind blowing", "visually stunning", "cérébral"],
  "Fantastique":     ["visually stunning", "évasion", "imaginaire"],
  "Animation":       ["visually stunning", "feel good", "créatif"],
  "Action":          ["adrénaline", "spectaculaire", "intense"],
  "Aventure":        ["évasion", "spectaculaire", "épique"],
  "Documentaire":    ["intellectuel", "slow burn", "enrichissant"],
  "Crime":           ["dark / intense", "thriller psychologique", "procédural"],
  "Mystère":         ["thriller psychologique", "twist ending", "cérébral"],
  "Famille":         ["cozy movie", "feel good", "accessible"],
  "Guerre":          ["dark / intense", "émotionnel", "visceral"],
  "Western":         ["slow burn", "atmosphérique", "classique"],
  "Musique":         ["feel good", "émotionnel", "immersif"],
  "Histoire":        ["intellectuel", "émotionnel", "épique"],
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

export interface MultiVectorProfile {
  stableTasteVector: number[] | null;
  recentTasteVector: number[] | null;
  avoidanceVector: number[] | null;
  topClusters: string[];
  rejectedClusters: string[];
  stableConfidence: number;
  noveltyTolerance: number;
  fatigueState: Record<string, number>;
}

// Short-lived in-memory cache — avoids repeated 5-query DB round-trips within the same session.
const _profileCache = new Map<string, { data: MultiVectorProfile; ts: number }>();
const PROFILE_CACHE_TTL = 90_000; // 90 seconds

/**
 * Computes 3 separate taste vectors:
 * 1. Stable taste vector — full history, long decay
 * 2. Recent taste vector — last 30 days, short decay
 * 3. Avoidance vector — from skips/rejections, medium decay
 *
 * Also computes clusters, fatigue state, and confidence.
 */
export async function computeMultiVectorProfile(
  userId: string
): Promise<MultiVectorProfile | null> {
  const hit = _profileCache.get(userId);
  if (hit && Date.now() - hit.ts < PROFILE_CACHE_TTL) return hit.data;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all data in parallel
    const [
      { data: likedMovies },
      { data: watchlistItems },
      { data: interactions },
      { data: cached },
      { data: rejectedFeedback },
    ] = await Promise.all([
      supabase
        .from("liked_movies")
        .select("tmdb_id, title, genres, liked_at")
        .eq("user_id", userId)
        .order("liked_at", { ascending: false }),
      supabase
        .from("watchlist")
        .select("tmdb_id, title, genres, added_at")
        .eq("user_id", userId)
        .order("added_at", { ascending: false }),
      supabase
        .from("user_interactions" as any)
        .select("tmdb_id, action_type, context, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500) as any,
      supabase
        .from("user_taste_vectors" as any)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      // Explicit permanent rejections (not_for_me / dislike) — strongest avoidance signals
      supabase
        .from("user_item_feedback")
        .select("feedback_type, created_at, catalog_items:item_id(tmdb_id)")
        .eq("user_id", userId)
        .in("feedback_type", ["not_for_me", "dislike"]) as any,
    ]);

    const allLiked = likedMovies || [];
    const allWatchlist = watchlistItems || [];
    const allInteractions = (interactions || []) as any[];
    const allRejectedFeedback = ((rejectedFeedback || []) as any[]).filter(r => r?.catalog_items?.tmdb_id);

    // Check if cache is fresh (fingerprint-based)
    const likedIds = allLiked.map(m => m.tmdb_id).sort().join(",");
    const watchlistIds = allWatchlist.map(w => w.tmdb_id).sort().join(",");
    const interactionCount = allInteractions.length;
    const rejectedCount = allRejectedFeedback.length;
    const fingerprint = `${likedIds}|${watchlistIds}|${interactionCount}|${rejectedCount}`;
    // djb2 hash — much lower collision rate than fingerprint.length
    let fingerprintHash = 5381;
    for (let i = 0; i < fingerprint.length; i++) {
      fingerprintHash = (Math.imul(fingerprintHash, 33) ^ fingerprint.charCodeAt(i)) | 0;
    }
    fingerprintHash = Math.abs(fingerprintHash);
    const totalCount = allLiked.length + allWatchlist.length;

    if (cached && (cached as any).liked_count === totalCount + fingerprintHash) {
      // Return cached multi-vector profile
      return {
        stableTasteVector: parseVector((cached as any).taste_vector),
        recentTasteVector: parseVector((cached as any).recent_taste_vector),
        avoidanceVector: parseVector((cached as any).avoidance_vector),
        topClusters: (cached as any).top_clusters || [],
        rejectedClusters: (cached as any).rejected_clusters || [],
        stableConfidence: (cached as any).stable_confidence || 50,
        noveltyTolerance: (cached as any).novelty_tolerance || 0.2,
        fatigueState: (cached as any).fatigue_state || {},
      };
    }

    // ── Collect all tmdb_ids for embedding lookup ──
    const likedTmdbIds = new Set(allLiked.map(m => m.tmdb_id));
    const uniqueWatchlist = allWatchlist.filter(w => !likedTmdbIds.has(w.tmdb_id));

    // Interactions that carry avoidance signal (already_seen intentionally excluded)
    const avoidanceActionTypes = ["skipped", "unsure", "rejected_style", "rejected_too_long",
      "rejected_not_tonight", "rejected_too_slow", "rejected_too_intense"];
    const avoidanceInteractions = allInteractions.filter(
      (i: any) => avoidanceActionTypes.includes(i.action_type)
    );
    const rejectedFeedbackTmdbIds = allRejectedFeedback.map(r => r.catalog_items.tmdb_id);

    const allTmdbIds = [
      ...allLiked.map(m => m.tmdb_id),
      ...uniqueWatchlist.map(w => w.tmdb_id),
      ...avoidanceInteractions.map((i: any) => i.tmdb_id),
      ...rejectedFeedbackTmdbIds,
    ];

    if (allTmdbIds.length === 0) return null;

    const { data: embeddings } = await supabase
      .from("movie_embeddings" as any)
      .select("tmdb_id, embedding")
      .in("tmdb_id", [...new Set(allTmdbIds)]);

    const embMap = new Map<number, number[]>();
    for (const emb of (embeddings || []) as any[]) {
      const vec = parseVector(emb.embedding);
      if (vec) embMap.set(emb.tmdb_id, vec);
    }

    // ── 1. STABLE TASTE VECTOR (full history, long decay) ──
    const stableItems: { vec: number[]; weight: number }[] = [];
    
    allLiked.forEach(movie => {
      const vec = embMap.get(movie.tmdb_id);
      if (!vec) return;
      const w = decayWeight(movie.liked_at, STABLE_HALF_LIFE);
      stableItems.push({ vec, weight: w });
    });

    uniqueWatchlist.forEach(item => {
      const vec = embMap.get(item.tmdb_id);
      if (!vec) return;
      const w = 0.4 * decayWeight(item.added_at, STABLE_HALF_LIFE);
      stableItems.push({ vec, weight: w });
    });

    const stableTasteVector = weightedAverageVector(stableItems);

    // ── 2. RECENT TASTE VECTOR (last 30 days, short decay) ──
    const recentItems: { vec: number[]; weight: number }[] = [];
    
    allLiked
      .filter(m => m.liked_at >= thirtyDaysAgo)
      .forEach(movie => {
        const vec = embMap.get(movie.tmdb_id);
        if (!vec) return;
        const w = decayWeight(movie.liked_at, RECENT_HALF_LIFE);
        recentItems.push({ vec, weight: w });
      });

    uniqueWatchlist
      .filter(w => w.added_at >= thirtyDaysAgo)
      .forEach(item => {
        const vec = embMap.get(item.tmdb_id);
        if (!vec) return;
        const w = 0.5 * decayWeight(item.added_at, RECENT_HALF_LIFE);
        recentItems.push({ vec, weight: w });
      });

    // Also boost with recently watched (positive signal)
    const recentWatched = allInteractions.filter(
      (i: any) => i.action_type === "watched" && i.created_at >= thirtyDaysAgo
    );
    recentWatched.forEach((i: any) => {
      const vec = embMap.get(i.tmdb_id);
      if (!vec) return;
      recentItems.push({ vec, weight: 0.7 * decayWeight(i.created_at, RECENT_HALF_LIFE) });
    });

    const recentTasteVector = weightedAverageVector(recentItems);

    // ── 3. AVOIDANCE VECTOR ──
    // Weights reflect how strong and permanent the rejection signal is.
    // "already_seen" is intentionally excluded: seeing a film is neutral, not negative.
    const avoidanceWeights: Record<string, number> = {
      rejected_style: 1.5,       // "pas mon style" → fort signal de style
      skipped: 1.0,              // skip en session
      rejected_too_intense: 0.8, // trop intense → pénalise les films sombres/violents
      rejected_too_slow: 0.8,    // trop lent → pénalise slow-burn
      rejected_too_long: 0.6,    // durée, pas le style → signal plus faible
      rejected_not_tonight: 0.4, // temporaire, pas permanent
      unsure: 0.4,
    };

    const avoidanceItems: { vec: number[]; weight: number }[] = [];

    // Session-level rejections from user_interactions
    avoidanceInteractions.forEach((i: any) => {
      const vec = embMap.get(i.tmdb_id);
      if (!vec) return;
      const w = (avoidanceWeights[i.action_type] ?? 0.5) * decayWeight(i.created_at, AVOIDANCE_HALF_LIFE);
      avoidanceItems.push({ vec, weight: w });
    });

    // "unliked" = like retiré → signal fort
    allInteractions
      .filter((i: any) => i.action_type === "unliked")
      .forEach((i: any) => {
        const vec = embMap.get(i.tmdb_id);
        if (!vec) return;
        avoidanceItems.push({ vec, weight: 1.5 * decayWeight(i.created_at, AVOIDANCE_HALF_LIFE) });
      });

    // Explicit permanent rejections from user_item_feedback — strongest signals
    allRejectedFeedback.forEach((r: any) => {
      const vec = embMap.get(r.catalog_items.tmdb_id);
      if (!vec) return;
      const w = (r.feedback_type === "dislike" ? 2.0 : 1.8) * decayWeight(r.created_at, AVOIDANCE_HALF_LIFE);
      avoidanceItems.push({ vec, weight: w });
    });

    const avoidanceVector = weightedAverageVector(avoidanceItems);

    // ── 4. CLUSTER ANALYSIS ──
    const genreCounts: Record<string, number> = {};
    allLiked.forEach(m => {
      const w = decayWeight(m.liked_at, STABLE_HALF_LIFE);
      (m.genres || []).forEach((g: string) => {
        genreCounts[g] = (genreCounts[g] || 0) + w;
      });
    });

    const clusters = inferClusters(genreCounts);
    const topClusters = Object.entries(clusters)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([c]) => c);

    // Rejected clusters: from session rejections + explicit not_for_me/dislike feedback
    const rejectionGenreCounts: Record<string, number> = {};
    // Style/content rejections carry more genre signal than duration/timing ones
    const strongRejections = allInteractions.filter(
      (i: any) => ["rejected_style", "rejected_too_intense", "rejected_too_slow", "skipped"].includes(i.action_type)
    );
    strongRejections.forEach((i: any) => {
      const ctx = i.context || {};
      const weight = i.action_type === "rejected_style" ? 2 : 1;
      if (ctx.genres) {
        (ctx.genres as string[]).forEach((g: string) => {
          rejectionGenreCounts[g] = (rejectionGenreCounts[g] || 0) + weight;
        });
      }
      if (ctx.mood) {
        rejectionGenreCounts[ctx.mood] = (rejectionGenreCounts[ctx.mood] || 0) + weight;
      }
    });
    const rejectedClusters = Object.entries(rejectionGenreCounts)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([c]) => c);

    // ── 5. CONFIDENCE & NOVELTY TOLERANCE ──
    const totalSignals = allLiked.length + 
      allInteractions.filter((i: any) => ["watched", "skipped"].includes(i.action_type)).length;
    
    const stableConfidence = Math.min(100, Math.round(Math.sqrt(totalSignals) * 12));
    
    // Novelty tolerance: based on how often user accepts discoveries
    const totalDecisions = allInteractions.filter(
      (i: any) => ["watched", "liked", "skipped"].includes(i.action_type)
    ).length;
    const acceptedCount = allInteractions.filter(
      (i: any) => ["watched", "liked"].includes(i.action_type)
    ).length;
    const acceptanceRate = totalDecisions > 0 ? acceptedCount / totalDecisions : 0.5;
    
    // High acceptance → more novelty tolerance
    const noveltyTolerance = Math.max(0.05, Math.min(0.4, 
      acceptanceRate > 0.6 ? 0.35 
      : acceptanceRate > 0.4 ? 0.2 
      : 0.1
    ));

    // ── 6. FATIGUE STATE (genre exposure last 7 days) ──
    const recentLiked7d = allLiked.filter(m => m.liked_at >= sevenDaysAgo);
    const recentWatched7d = allInteractions.filter(
      (i: any) => i.action_type === "watched" && i.created_at >= sevenDaysAgo
    );
    const fatigueState: Record<string, number> = {};
    
    recentLiked7d.forEach(m => {
      (m.genres || []).forEach((g: string) => {
        fatigueState[`genre_${g}`] = (fatigueState[`genre_${g}`] || 0) + 1;
      });
    });
    recentWatched7d.forEach((i: any) => {
      const ctx = i.context || {};
      if (ctx.genres) {
        (ctx.genres as string[]).forEach((g: string) => {
          fatigueState[`genre_${g}`] = (fatigueState[`genre_${g}`] || 0) + 1;
        });
      }
    });

    // ── 7. CACHE EVERYTHING ──
    const vectorToStr = (v: number[] | null) => v ? `[${v.join(",")}]` : null;

    await supabase
      .from("user_taste_vectors" as any)
      .upsert(
        {
          user_id: userId,
          taste_vector: vectorToStr(stableTasteVector),
          recent_taste_vector: vectorToStr(recentTasteVector),
          avoidance_vector: vectorToStr(avoidanceVector),
          liked_count: totalCount + fingerprintHash,
          stable_confidence: stableConfidence,
          novelty_tolerance: noveltyTolerance,
          fatigue_state: fatigueState,
          top_clusters: topClusters,
          rejected_clusters: rejectedClusters,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );

    const profile: MultiVectorProfile = {
      stableTasteVector,
      recentTasteVector,
      avoidanceVector,
      topClusters,
      rejectedClusters,
      stableConfidence,
      noveltyTolerance,
      fatigueState,
    };
    _profileCache.set(userId, { data: profile, ts: Date.now() });
    return profile;
  } catch (e) {
    console.error("Failed to compute multi-vector profile:", e);
    return null;
  }
}

/**
 * Legacy wrapper — returns the stable taste vector for backward compatibility.
 */
export async function computeUserTasteVector(userId: string): Promise<number[] | null> {
  const profile = await computeMultiVectorProfile(userId);
  return profile?.stableTasteVector || null;
}
