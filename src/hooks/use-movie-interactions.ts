import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getInteractionStateBatch,
  EMPTY_INTERACTION_STATE,
  type MovieInteractionState,
} from "@/lib/feedback";
import { useAuth } from "@/hooks/use-auth";
import { catalogLookupKey, normalizeCatalogMediaType, type CatalogItemLookup, type CatalogMediaType } from "@/lib/catalog";

const CACHE_MAX = 500;

// LRU cache: Map preserves insertion order; on access, entry is moved to end.
// When size exceeds CACHE_MAX, the oldest (first) entry is evicted.
const interactionCache = {
  _map: new Map<string, MovieInteractionState>(),
  get(key: string): MovieInteractionState | undefined {
    const value = this._map.get(key);
    if (value === undefined) return undefined;
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  },
  set(key: string, value: MovieInteractionState): void {
    this._map.delete(key);
    this._map.set(key, value);
    if (this._map.size > CACHE_MAX) this._map.delete(this._map.keys().next().value!);
  },
  delete(key: string): void { this._map.delete(key); },
  has(key: string): boolean { return this._map.has(key); },
  keys(): IterableIterator<string> { return this._map.keys(); },
};

function normalizeInput(input: number[] | CatalogItemLookup[], fallbackMediaType: CatalogMediaType): CatalogItemLookup[] {
  const mediaType = normalizeCatalogMediaType(fallbackMediaType);
  return (input as Array<number | CatalogItemLookup>)
    .map((item) => typeof item === "number" ? { tmdbId: item, mediaType } : { tmdbId: item.tmdbId, mediaType: normalizeCatalogMediaType(item.mediaType) })
    .filter((lookup) => lookup.tmdbId > 0);
}

function readCachedState(lookups: CatalogItemLookup[]): Record<string, MovieInteractionState> {
  const out: Record<string, MovieInteractionState> = {};
  for (const lookup of lookups) {
    const key = catalogLookupKey(lookup.tmdbId, lookup.mediaType);
    const cached = interactionCache.get(key);
    if (cached) {
      out[key] = cached;
      out[lookup.tmdbId] = cached;
    }
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
  input: number[] | CatalogItemLookup[],
  fallbackMediaType: CatalogMediaType = "movie"
): Record<string, MovieInteractionState> {
  const { user } = useAuth();
  const lookups = useMemo(() => normalizeInput(input, fallbackMediaType), [JSON.stringify(input), fallbackMediaType]);
  const key = useMemo(() => Array.from(new Set(lookups.map((lookup) => catalogLookupKey(lookup.tmdbId, lookup.mediaType)))).sort().join(","), [lookups]);
  const uniqueLookups = useMemo(() => key ? key.split(",").map((entry) => {
    const [tmdbId, mediaType] = entry.split(":");
    return { tmdbId: Number(tmdbId), mediaType: normalizeCatalogMediaType(mediaType) };
  }) : [], [key]);
  const [map, setMap] = useState<Record<string, MovieInteractionState>>(() => readCachedState(uniqueLookups));

  const refresh = useCallback(async () => {
    if (!user || !uniqueLookups.length) {
      setMap({});
      return;
    }
    setMap(readCachedState(uniqueLookups));
    try {
      const fresh = await getInteractionStateBatch(uniqueLookups);
      const hydrated: Record<string, MovieInteractionState> = {};
      for (const lookup of uniqueLookups) {
        const cacheKey = catalogLookupKey(lookup.tmdbId, lookup.mediaType);
        if (fresh[lookup.tmdbId]) {
          // Real interaction found → refresh cache + UI.
          interactionCache.set(cacheKey, fresh[lookup.tmdbId]);
          hydrated[cacheKey] = fresh[lookup.tmdbId];
          hydrated[lookup.tmdbId] = fresh[lookup.tmdbId];
        } else {
          // No row returned. Could mean "never interacted" OR transient miss
          // (catalog row not yet linked, network blip). Prefer cached truth
          // when present so a known badge never disappears between renders.
          const cached = interactionCache.get(cacheKey);
          hydrated[cacheKey] = cached ?? EMPTY_INTERACTION_STATE;
          hydrated[lookup.tmdbId] = cached ?? EMPTY_INTERACTION_STATE;
        }
      }
      setMap(hydrated);
    } catch {
      // Keep the cached state visible instead of flashing a neutral card.
    }
  }, [uniqueLookups, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const watchedKeys = new Set(uniqueLookups.map((lookup) => catalogLookupKey(lookup.tmdbId, lookup.mediaType)));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tmdbId?: number; mediaType?: CatalogMediaType } | undefined;
      // Invalidate cache for the mutated id so post-mutation truth wins
      // (e.g. an "unlike" must clear a stale cached "liked" badge).
      if (detail?.tmdbId && detail.mediaType) interactionCache.delete(catalogLookupKey(detail.tmdbId, normalizeCatalogMediaType(detail.mediaType)));
      else if (detail?.tmdbId) Array.from(interactionCache.keys()).filter((cacheKey) => cacheKey.startsWith(`${detail.tmdbId}:`)).forEach((cacheKey) => interactionCache.delete(cacheKey));
      const changedKey = detail?.tmdbId && detail.mediaType ? catalogLookupKey(detail.tmdbId, normalizeCatalogMediaType(detail.mediaType)) : null;
      if (!detail?.tmdbId || (changedKey ? watchedKeys.has(changedKey) : uniqueLookups.some((lookup) => lookup.tmdbId === detail.tmdbId))) refresh();
    };
    window.addEventListener("pick-feedback-changed", onChange);
    window.addEventListener("pick-watchlist-added", refresh);
    return () => {
      window.removeEventListener("pick-feedback-changed", onChange);
      window.removeEventListener("pick-watchlist-added", refresh);
    };
  }, [uniqueLookups, user?.id, refresh]);

  return map;
}

/** Convenience: state for a single movie (never null — empty state if unknown). */
export function useMovieInteraction(tmdbId: number | null | undefined, mediaType: CatalogMediaType = "movie"): MovieInteractionState {
  const ids = useMemo(() => (tmdbId ? [{ tmdbId, mediaType: normalizeCatalogMediaType(mediaType) }] : []), [tmdbId, mediaType]);
  const map = useMovieInteractions(ids);
  if (!tmdbId) return EMPTY_INTERACTION_STATE;
  return map[tmdbId] ?? EMPTY_INTERACTION_STATE;
}
