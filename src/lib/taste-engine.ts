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
    // Check cached vector
    const { data: cached } = await supabase
      .from("user_taste_vectors" as any)
      .select("taste_vector, liked_count, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Get liked movies count
    const { count } = await supabase
      .from("liked_movies")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // If cache is fresh (same liked count), return it
    if (cached && (cached as any).liked_count === count) {
      const vec = (cached as any).taste_vector;
      if (typeof vec === "string") {
        return JSON.parse(vec.replace(/^\[/, "[").replace(/\]$/, "]"));
      }
      return vec;
    }

    // Get all liked movies with their tmdb_ids
    const { data: likedMovies } = await supabase
      .from("liked_movies")
      .select("tmdb_id, title, genres, liked_at")
      .eq("user_id", userId)
      .order("liked_at", { ascending: false });

    if (!likedMovies || likedMovies.length === 0) return null;

    // Get embeddings for liked movies
    const tmdbIds = likedMovies.map((m) => m.tmdb_id);
    const { data: embeddings } = await supabase
      .from("movie_embeddings" as any)
      .select("tmdb_id, embedding")
      .in("tmdb_id", tmdbIds);

    if (!embeddings || embeddings.length === 0) return null;

    // Build weighted average (recency-weighted)
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

    likedMovies.forEach((movie, index) => {
      const vec = embMap.get(movie.tmdb_id);
      if (!vec) return;

      // Recency weight: most recent = 1.0, oldest = 0.3
      const recencyWeight = 1.0 - (index / likedMovies.length) * 0.7;
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

    // Cache the vector
    const vectorStr = `[${tasteVector.join(",")}]`;
    await supabase
      .from("user_taste_vectors" as any)
      .upsert(
        {
          user_id: userId,
          taste_vector: vectorStr,
          liked_count: count || likedMovies.length,
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
