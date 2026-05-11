import { useEffect, useState } from "react";
import { getFeedbackBatch, type FeedbackType } from "@/lib/feedback";
import { useAuth } from "@/hooks/use-auth";

/**
 * Batch-fetch latest feedback for a list of tmdb ids.
 * Refreshes when the id list changes.
 */
export function useFeedbackMap(tmdbIds: number[]): Record<number, FeedbackType> {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<number, FeedbackType>>({});
  const key = tmdbIds.join(",");

  useEffect(() => {
    if (!user || !tmdbIds.length) { setMap({}); return; }
    let cancelled = false;
    getFeedbackBatch(tmdbIds).then(res => {
      if (cancelled) return;
      const out: Record<number, FeedbackType> = {};
      for (const [id, fb] of Object.entries(res)) out[Number(id)] = fb.feedback_type;
      setMap(out);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [key, user?.id]);

  return map;
}
