/**
 * Pick V1 — wrapper around `lib/feedback.ts` (single source of truth).
 * Legacy table `watchlist` is no longer written/read here.
 */
import type { MovieDetail } from "@/lib/tmdb";
import { setFeedback, clearFeedbackType, hasFeedbackType, listFeedbackByType } from "@/lib/feedback";
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

export async function addToWatchlist(movie: MovieDetail) {
  await setFeedback(movie.id, "watchlist", metaFromMovie(movie));
}

export async function removeFromWatchlist(tmdbId: number) {
  await clearFeedbackType(tmdbId, ["watchlist"]);
}

export async function isInWatchlist(tmdbId: number): Promise<boolean> {
  return hasFeedbackType(tmdbId, "watchlist");
}

/** Returns watchlist items in the legacy shape expected by callers. */
export async function getWatchlist() {
  const rows = await listFeedbackByType("watchlist");
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
        overview: ci.overview,
        vote_average: ci.vote_average,
        genres: [] as string[],
        added_at: row.created_at,
      };
    })
    .filter(Boolean) as any[];
}
