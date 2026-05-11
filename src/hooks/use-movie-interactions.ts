import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getInteractionStateBatch,
  EMPTY_INTERACTION_STATE,
  type MovieInteractionState,
} from "@/lib/feedback";
import { useAuth } from "@/hooks/use-auth";

const interactionCache = new Map<number, MovieInteractionState>();

function readCachedState(tmdbIds: number[]): Record<number, MovieInteractionState> {
  const out: Record<number, MovieInteractionState> = {};
  for (const id of tmdbIds) {
    const cached = interactionCache.get(id);
    if (cached) out[id] = cached;
  }
  return out;
}

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
  const key = useMemo(() => Array.from(new Set(tmdbIds.filter(Boolean))).sort((a, b) => a - b).join(","), [tmdbIds.join(",")]);
  const ids = useMemo(() => key ? key.split(",").map(Number) : [], [key]);
  const [map, setMap] = useState<Record<number, MovieInteractionState>>(() => readCachedState(ids));

  const refresh = useCallback(async () => {
    if (!user || !ids.length) {
      setMap({});
      return;
    }
    setMap(readCachedState(ids));
    try {
      const fresh = await getInteractionStateBatch(ids);
      const hydrated: Record<number, MovieInteractionState> = {};
      for (const id of ids) {
        const state = fresh[id] ?? EMPTY_INTERACTION_STATE;
        interactionCache.set(id, state);
        hydrated[id] = state;
      }
      setMap(hydrated);
    } catch {
      // Keep the cached state visible instead of flashing a neutral card.
    }
  }, [ids, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const watchedIds = new Set(ids);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tmdbId?: number } | undefined;
      if (!detail?.tmdbId || watchedIds.has(detail.tmdbId)) refresh();
    };
    window.addEventListener("pick-feedback-changed", onChange);
    window.addEventListener("pick-watchlist-added", refresh);
    return () => {
      window.removeEventListener("pick-feedback-changed", onChange);
      window.removeEventListener("pick-watchlist-added", refresh);
    };
  }, [ids, user?.id, refresh]);

  return map;
}

/** Convenience: state for a single movie (never null — empty state if unknown). */
export function useMovieInteraction(tmdbId: number | null | undefined): MovieInteractionState {
  const ids = useMemo(() => (tmdbId ? [tmdbId] : []), [tmdbId]);
  const map = useMovieInteractions(ids);
  if (!tmdbId) return EMPTY_INTERACTION_STATE;
  return map[tmdbId] ?? EMPTY_INTERACTION_STATE;
}
