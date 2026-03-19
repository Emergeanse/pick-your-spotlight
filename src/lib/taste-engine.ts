import { supabase } from "@/integrations/supabase/client";

const VECTOR_DIM = 32;

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
 * Computes the user's taste vector as a weighted average of their liked movies' embeddings.
 * More recent likes have higher weight.
 */
export async function computeUserTasteVector(
  userId: string
): Promise<number[] | null> {
  try {
    // Fetch liked movies, watchlist, and cached vector in parallel
    const [
      { data: cached },
      { count: likedCount },
      { count: watchlistCount },
      { data: likedMovies },
      { data: watchlistItems },
    ] = await Promise.all([
      supabase
        .from("user_taste_vectors" as any)
        .select("taste_vector, liked_count, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("liked_movies")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("watchlist")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
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
    ]);

    const totalCount = (likedCount || 0) + (watchlistCount || 0);

    // Build a fingerprint from the actual IDs to detect any change (adds or removes)
    const likedIdsSorted = (likedMovies || []).map((m: any) => m.tmdb_id).sort().join(",");
    const watchlistIdsSorted = (watchlistItems || []).map((w: any) => w.tmdb_id).sort().join(",");
    const fingerprint = `${likedIdsSorted}|${watchlistIdsSorted}`;
    const fingerprintHash = fingerprint.length; // Simple length-based check + count

    // If cache is fresh (same count AND same fingerprint length), return it
    if (cached && (cached as any).liked_count === totalCount + fingerprintHash) {
      const vec = (cached as any).taste_vector;
      if (typeof vec === "string") {
        return JSON.parse(vec.replace(/^\[/, "[").replace(/\]$/, "]"));
      }
      return vec;
    }

    if ((!likedMovies || likedMovies.length === 0) && (!watchlistItems || watchlistItems.length === 0)) {
      return null;
    }

    // Build a set of liked tmdb_ids for deduplication
    const likedTmdbIds = new Set((likedMovies || []).map((m) => m.tmdb_id));

    // Deduplicated watchlist items (exclude those already liked)
    const uniqueWatchlist = (watchlistItems || []).filter(
      (w) => !likedTmdbIds.has(w.tmdb_id)
    );

    // Collect all unique tmdb_ids for embedding lookup
    const allTmdbIds = [
      ...(likedMovies || []).map((m) => m.tmdb_id),
      ...uniqueWatchlist.map((w) => w.tmdb_id),
    ];

    if (allTmdbIds.length === 0) return null;

    const { data: embeddings } = await supabase
      .from("movie_embeddings" as any)
      .select("tmdb_id, embedding")
      .in("tmdb_id", allTmdbIds);

    if (!embeddings || embeddings.length === 0) return null;

    // Parse embeddings into a map
    const embMap = new Map<number, number[]>();
    for (const emb of embeddings as any[]) {
      let vec = emb.embedding;
      if (typeof vec === "string") {
        vec = JSON.parse(vec.replace(/^\[/, "[").replace(/\]$/, "]"));
      }
      embMap.set(emb.tmdb_id, vec);
    }

    const tasteVector = new Array(VECTOR_DIM).fill(0);
    let totalWeight = 0;

    // Liked movies: base weight 1.0, recency decay
    const likedList = likedMovies || [];
    likedList.forEach((movie, index) => {
      const vec = embMap.get(movie.tmdb_id);
      if (!vec) return;
      const recencyWeight = 1.0 - (index / Math.max(likedList.length, 1)) * 0.7;
      totalWeight += recencyWeight;
      for (let i = 0; i < VECTOR_DIM; i++) {
        tasteVector[i] += vec[i] * recencyWeight;
      }
    });

    // Watchlist items: base weight 0.4, recency decay
    uniqueWatchlist.forEach((item, index) => {
      const vec = embMap.get(item.tmdb_id);
      if (!vec) return;
      const recencyWeight = 0.4 * (1.0 - (index / Math.max(uniqueWatchlist.length, 1)) * 0.7);
      totalWeight += recencyWeight;
      for (let i = 0; i < VECTOR_DIM; i++) {
        tasteVector[i] += vec[i] * recencyWeight;
      }
    });

    if (totalWeight === 0) return null;

    // Normalize
    for (let i = 0; i < VECTOR_DIM; i++) {
      tasteVector[i] /= totalWeight;
    }

    // Cache the vector (store combined count for invalidation)
    const vectorStr = `[${tasteVector.join(",")}]`;
    await supabase
      .from("user_taste_vectors" as any)
      .upsert(
        {
          user_id: userId,
          taste_vector: vectorStr,
          liked_count: totalCount + fingerprintHash,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );

    return tasteVector;
  } catch (e) {
    console.error("Failed to compute taste vector:", e);
    return null;
  }
}

/**
 * Triggers embedding generation for a movie in the background.
 * Call this when a movie is liked or displayed.
 */
export function ensureMovieEmbedding(
  tmdbId: number,
  title: string,
  overview: string,
  genres: string[]
): void {
  // Fire and forget
  getMovieEmbedding(tmdbId, title, overview, genres).catch(() => {});
}
