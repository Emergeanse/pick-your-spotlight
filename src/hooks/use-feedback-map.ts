import { useMemo } from "react";
import type { FeedbackType } from "@/lib/feedback";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";

/**
 * @deprecated Use `useMovieInteractions` from `@/hooks/use-movie-interactions`
 * for full structured state (primary status + watchlist + flags).
 *
 * Kept for backward compat: returns only the primary status per tmdb id
 * (watchlist is NOT surfaced here — callers should switch to the unified hook).
 */
export function useFeedbackMap(tmdbIds: number[]): Record<number, FeedbackType> {
  const states = useMovieInteractions(tmdbIds);
  return useMemo(() => {
    const out: Record<number, FeedbackType> = {};
    for (const [id, s] of Object.entries(states)) {
      if (s.primaryStatus) out[Number(id)] = s.primaryStatus;
      else if (s.watchlist) out[Number(id)] = "watchlist";
    }
    return out;
  }, [states]);
}
