import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getInteractionStateBatch,
  EMPTY_INTERACTION_STATE,
  type MovieInteractionState,
} from "@/lib/feedback";
import { useAuth } from "@/hooks/use-auth";

/**
 * Single source of truth for movie interaction state across the whole app.
 *
 * Returns a structured state per tmdb id covering primary status (like/love/seen/not_for_me)
 * AND additive watchlist membership. Reactive to any mutation broadcast on the
 * `pick-feedback-changed` / `pick-watchlist-added` window events.
 */
export function useMovieInteractions(
  tmdbIds: number[]
): Record<number, MovieInteractionState> {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<number, MovieInteractionState>>({});
  const key = tmdbIds.join(",");

  const refresh = useCallback(() => {
    if (!user || !tmdbIds.length) {
      setMap({});
      return;
    }
    getInteractionStateBatch(tmdbIds)
      .then(setMap)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ids = new Set(tmdbIds);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tmdbId?: number } | undefined;
      if (!detail?.tmdbId || ids.has(detail.tmdbId)) refresh();
    };
    window.addEventListener("pick-feedback-changed", onChange);
    window.addEventListener("pick-watchlist-added", refresh);
    return () => {
      window.removeEventListener("pick-feedback-changed", onChange);
      window.removeEventListener("pick-watchlist-added", refresh);
    };
  }, [key, user?.id, refresh]);

  return map;
}

/** Convenience: state for a single movie (never null — empty state if unknown). */
export function useMovieInteraction(tmdbId: number | null | undefined): MovieInteractionState {
  const ids = useMemo(() => (tmdbId ? [tmdbId] : []), [tmdbId]);
  const map = useMovieInteractions(ids);
  if (!tmdbId) return EMPTY_INTERACTION_STATE;
  return map[tmdbId] ?? EMPTY_INTERACTION_STATE;
}
