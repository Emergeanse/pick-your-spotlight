import { useCallback, useEffect, useRef, useState } from "react";

type ItemWithId = { id: number };

type Options<T extends ItemWithId> = {
  fetchPage: (excludeIds: number[]) => Promise<T[]>;
  initialProposedIds: number[];
  pageSize: number;
  enabled?: boolean;
  /** Persistance silencieuse (ex. Supabase) — ne doit pas mettre à jour le state parent. */
  onPersistProposed?: (ids: number[]) => void;
  onLoadError?: (error: unknown) => void;
};

export function useOnboardingInfiniteScroll<T extends ItemWithId>({
  fetchPage,
  initialProposedIds,
  pageSize,
  enabled = true,
  onPersistProposed,
  onLoadError,
}: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const proposedIdsRef = useRef<Set<number>>(new Set(initialProposedIds));
  const busyRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const persistProposed = useCallback(() => {
    onPersistProposed?.([...proposedIdsRef.current]);
  }, [onPersistProposed]);

  const appendPage = useCallback(
    (page: T[]) => {
      if (!page.length) {
        setExhausted(true);
        return;
      }
      page.forEach((x) => proposedIdsRef.current.add(x.id));
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const novel = page.filter((x) => !seen.has(x.id));
        return novel.length ? [...prev, ...novel] : prev;
      });
      if (page.length < pageSize) setExhausted(true);
      persistProposed();
    },
    [pageSize, persistProposed],
  );

  const loadMore = useCallback(
    async (opts?: { initial?: boolean }) => {
      if (!enabled || busyRef.current) return;
      if (!opts?.initial && exhausted) return;
      busyRef.current = true;
      if (opts?.initial) setLoading(true);
      else setLoadingMore(true);
      try {
        const page = await fetchPageRef.current([...proposedIdsRef.current]);
        appendPage(page);
      } catch (error) {
        onLoadError?.(error);
        if (opts?.initial) setExhausted(true);
      } finally {
        busyRef.current = false;
        if (opts?.initial) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [appendPage, enabled, exhausted, onLoadError],
  );

  const markProposed = useCallback((ids: number[]) => {
    ids.forEach((id) => proposedIdsRef.current.add(id));
    persistProposed();
  }, [persistProposed]);

  const getProposedIds = useCallback(() => [...proposedIdsRef.current], []);

  const replaceItem = useCallback(
    (failedId: number, replacement: T) => {
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === failedId);
        if (idx === -1) return prev;
        if (prev.some((x) => x.id === replacement.id)) return prev;
        const next = [...prev];
        next[idx] = replacement;
        return next;
      });
      proposedIdsRef.current.delete(failedId);
      proposedIdsRef.current.add(replacement.id);
      persistProposed();
    },
    [persistProposed],
  );

  // Reset uniquement quand fetchPage change (genres / type) — pas à chaque persistance
  useEffect(() => {
    proposedIdsRef.current = new Set(initialProposedIds);
    setItems([]);
    setExhausted(false);
    busyRef.current = false;
    void loadMore({ initial: true });
  }, [fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled || exhausted || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, exhausted, loadMore, loading, items.length]);

  return {
    items,
    loading,
    loadingMore,
    exhausted,
    sentinelRef,
    markProposed,
    getProposedIds,
    replaceItem,
    proposedIdsRef,
    reload: () => loadMore({ initial: true }),
  };
}
