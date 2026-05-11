import { supabase } from "@/integrations/supabase/client";
import { removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { getOrCreateCatalogItem, getCatalogItemIds, type CatalogMeta } from "@/lib/catalog";

export type FeedbackType =
  | "like"
  | "love"
  | "seen"
  | "not_for_me"
  | "watchlist"
  | "skip"
  | "dislike"
  | "unknown";

// Legacy alias for callers still importing FeedbackLabel
export type FeedbackLabel = FeedbackType;

export interface FeedbackState {
  label: FeedbackType;
  feedback_type: FeedbackType;
  score: number;
}

const SCORE_MAP: Record<FeedbackType, number> = {
  love: 100,
  like: 50,
  watchlist: 25,
  seen: 0,
  unknown: 0,
  skip: -25,
  not_for_me: -50,
  dislike: -100,
};

export interface FeedbackContext {
  context_type?: "solo_session" | "group_session" | "browse";
  context_id?: string | null;
  source?: string;
}

/**
 * Get latest feedback for a movie by tmdb_id.
 */
export async function getFeedback(tmdbId: number): Promise<FeedbackState | null> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const ids = await getCatalogItemIds([tmdbId]);
  const itemId = ids[tmdbId];
  if (!itemId) return null;

  const { data } = await supabase
    .from("user_item_feedback")
    .select("feedback_type, label, score")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const type = (data.feedback_type ?? data.label) as FeedbackType;
  return { label: type, feedback_type: type, score: data.score ?? 0 };
}

/**
 * Batch feedback lookup. Returns latest feedback per tmdb_id.
 */
export async function getFeedbackBatch(
  tmdbIds: number[]
): Promise<Record<number, FeedbackState>> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId || !tmdbIds.length) return {};

  const idMap = await getCatalogItemIds(tmdbIds);
  const itemIds = Object.values(idMap);
  if (!itemIds.length) return {};

  const reverse: Record<string, number> = {};
  for (const [tmdb, itemId] of Object.entries(idMap)) reverse[itemId] = Number(tmdb);

  const { data } = await supabase
    .from("user_item_feedback")
    .select("item_id, feedback_type, label, score, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  const result: Record<number, FeedbackState> = {};
  const seen = new Set<string>();
  for (const fb of data ?? []) {
    if (seen.has(fb.item_id)) continue;
    seen.add(fb.item_id);
    const tmdbId = reverse[fb.item_id];
    if (tmdbId === undefined) continue;
    const type = (fb.feedback_type ?? fb.label) as FeedbackType;
    result[tmdbId] = { label: type, feedback_type: type, score: fb.score ?? 0 };
  }
  return result;
}

/**
 * Set feedback. Idempotent per (user, item, feedback_type).
 * Side-effects: marking 'seen' removes from watchlist.
 */
export async function setFeedback(
  tmdbId: number,
  type: FeedbackType,
  meta?: CatalogMeta,
  ctx?: FeedbackContext
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const itemId = await getOrCreateCatalogItem(tmdbId, meta);
  if (!itemId) return;

  const score = SCORE_MAP[type];

  // Remove other exclusive feedback types for this item (one canonical state at a time)
  const exclusive: FeedbackType[] = ["like", "love", "seen", "not_for_me", "skip", "unknown", "dislike"];
  if (exclusive.includes(type)) {
    await supabase
      .from("user_item_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .in("feedback_type", exclusive);
  } else {
    // For 'watchlist' (additive), just delete same-type
    await supabase
      .from("user_item_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("feedback_type", type);
  }

  await supabase.from("user_item_feedback").insert({
    user_id: userId,
    item_id: itemId,
    action: type,
    label: type,
    feedback_type: type,
    score,
    source: ctx?.source ?? "manual",
    context_type: ctx?.context_type ?? "browse",
    context_id: ctx?.context_id ?? null,
  } as any);

  // Side effect: 'seen' removes from watchlist
  if (type === "seen") {
    try {
      if (await isInWatchlist(tmdbId)) await removeFromWatchlist(tmdbId);
    } catch {
      /* ignore */
    }
  }
}

/** Clear all feedback for an item (toggle off). */
export async function clearFeedback(tmdbId: number): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const ids = await getCatalogItemIds([tmdbId]);
  const itemId = ids[tmdbId];
  if (!itemId) return;

  await supabase
    .from("user_item_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);
}

/** List all items with a given feedback_type for the current user. */
export async function listFeedbackByType(type: FeedbackType) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  const { data } = await supabase
    .from("user_item_feedback")
    .select("item_id, score, created_at, catalog_items:item_id(id, tmdb_id, title, poster_path, media_type, year)")
    .eq("user_id", userId)
    .eq("feedback_type", type)
    .order("created_at", { ascending: false });

  return data ?? [];
}
