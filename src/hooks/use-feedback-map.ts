import { useEffect, useState, useCallback } from "react";
import { getFeedbackBatch, type FeedbackType } from "@/lib/feedback";
import { useAuth } from "@/hooks/use-auth";

/**
 * Batch-fetch latest feedback for a list of tmdb ids.
 * Refreshes when the id list changes OR when any item's feedback is mutated
 * (via the global `pick-feedback-changed` event).
 */
export function useFeedbackMap(tmdbIds: number[]): Record<number, FeedbackType> {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<number, FeedbackType>>({});
  const key = tmdbIds.join(",");

  const refresh = useCallback(() => {
    if (!user || !tmdbIds.length) { setMap({}); return; }
    getFeedbackBatch(tmdbIds).then(res => {
      const out: Record<number, FeedbackType> = {};
      for (const [id, fb] of Object.entries(res)) out[Number(id)] = fb.feedback_type;
      setMap(out);
    }).catch(() => {});
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
      // If we don't know which id changed, refresh anyway.
      if (!detail?.tmdbId || ids.has(detail.tmdbId)) refresh();
    };
    window.addEventListener("pick-feedback-changed", onChange);
    return () => window.removeEventListener("pick-feedback-changed", onChange);
  }, [key, user?.id, refresh]);

  return map;
}
