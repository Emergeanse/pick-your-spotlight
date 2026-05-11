/**
 * Pick V1 — wrapper around `lib/feedback.ts` (single source of truth).
 * Legacy table `liked_movies` is no longer written/read here.
 */
import type { MovieDetail } from "@/lib/tmdb";
import { ensureMovieEmbedding } from "@/lib/taste-engine";
import { setFeedback, clearFeedbackType, hasFeedbackType, listFeedbackByType, getFeedback } from "@/lib/feedback";
import type { CatalogMeta } from "@/lib/catalog";

function metaFromMovie(m: MovieDetail): CatalogMeta {
  const isTv = !!(m as any).first_air_date;
  const dateStr = (m as any).release_date || (m as any).first_air_date || "";
  const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
  const runtime = m.runtime || (m as any).episode_run_time?.[0] || null;
  return {
    title: m.title || (m as any).name || "Sans titre",
    poster_path: m.poster_path ?? null,
    media_type: isTv ? "tv" : "movie",
    year: Number.isFinite(year) ? year : null,
    overview: m.overview ?? null,
    vote_average: m.vote_average ?? null,
    popularity: (m as any).popularity ?? null,
    runtime,
  };
}

export async function likeMovie(movie: MovieDetail) {
  await setFeedback(movie.id, "like", metaFromMovie(movie));
  // Background embedding generation
  ensureMovieEmbedding(
    movie.id,
    movie.title || (movie as any).name || "",
    movie.overview || "",
    (movie.genres || []).map((g) => g.name)
  );
}

export async function unlikeMovie(tmdbId: number) {
  await clearFeedbackType(tmdbId, ["like", "love"]);
}

export async function isMovieLiked(tmdbId: number): Promise<boolean> {
  const fb = await getFeedback(tmdbId);
  return fb?.feedback_type === "like" || fb?.feedback_type === "love";
}

/** Returns liked + loved items in the legacy shape expected by callers. */
export async function getLikedMovies() {
  const [likes, loves] = await Promise.all([
    listFeedbackByType("like"),
    listFeedbackByType("love"),
  ]);
  const rows = [...loves, ...likes];
  return rows
    .map((row: any) => {
      const ci = row.catalog_items;
      if (!ci) return null;
      return {
        id: row.item_id,
        tmdb_id: ci.tmdb_id,
        title: ci.title,
        poster_path: ci.poster_path,
        media_type: ci.media_type,
        runtime: ci.runtime,
        genres: [] as string[], // genres are not denormalized in catalog_items
        liked_at: row.created_at,
      };
    })
    .filter(Boolean) as any[];
}

export async function isMovieLoved(tmdbId: number): Promise<boolean> {
  return hasFeedbackType(tmdbId, "love");
}
