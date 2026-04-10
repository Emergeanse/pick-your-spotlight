import { supabase } from "@/integrations/supabase/client";
import { removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";

export type FeedbackLabel = "like" | "love" | "seen" | "not_for_me" | "unknown" | "dislike";

export interface FeedbackState {
  label: FeedbackLabel;
  score: number;
}

const SCORE_MAP: Record<FeedbackLabel, number> = {
  love: 100,
  like: 50,
  seen: 0,
  unknown: 0,
  not_for_me: -50,
  dislike: -100,
};

/**
 * Get current feedback for a movie by tmdb_id.
 * Looks up catalog_items by tmdb_id, then queries user_item_feedback.
 */
export async function getFeedback(tmdbId: number): Promise<FeedbackState | null> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const itemId = await getOrCreateCatalogItemId(tmdbId);
  if (!itemId) return null;

  const { data } = await supabase
    .from("user_item_feedback")
    .select("label, score")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { label: data.label as FeedbackLabel, score: data.score ?? 0 };
}

/**
 * Get feedback for multiple tmdb_ids at once (batch).
 */
export async function getFeedbackBatch(tmdbIds: number[]): Promise<Record<number, FeedbackState>> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId || tmdbIds.length === 0) return {};

  // Get catalog item ids for all tmdb_ids
  const { data: items } = await supabase
    .from("catalog_items")
    .select("id, tmdb_id")
    .in("tmdb_id", tmdbIds);

  if (!items || items.length === 0) return {};

  const itemIdToTmdb: Record<string, number> = {};
  const itemIds: string[] = [];
  for (const it of items) {
    itemIdToTmdb[it.id] = it.tmdb_id;
    itemIds.push(it.id);
  }

  const { data: feedbacks } = await supabase
    .from("user_item_feedback")
    .select("item_id, label, score")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  if (!feedbacks) return {};

  const result: Record<number, FeedbackState> = {};
  // Only take latest feedback per item
  const seen = new Set<string>();
  for (const fb of feedbacks) {
    if (seen.has(fb.item_id)) continue;
    seen.add(fb.item_id);
    const tmdbId = itemIdToTmdb[fb.item_id];
    if (tmdbId !== undefined) {
      result[tmdbId] = { label: fb.label as FeedbackLabel, score: fb.score ?? 0 };
    }
  }
  return result;
}

/**
 * Set feedback for a movie. Handles wishlist side-effects.
 */
export async function setFeedback(
  tmdbId: number,
  label: FeedbackLabel,
  movieMeta?: { title?: string; poster_path?: string; media_type?: string }
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const itemId = await getOrCreateCatalogItemId(tmdbId, movieMeta);
  if (!itemId) return;

  const score = SCORE_MAP[label];

  // Upsert feedback (delete old + insert new for simplicity)
  await supabase
    .from("user_item_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  await supabase
    .from("user_item_feedback")
    .insert({
      user_id: userId,
      item_id: itemId,
      action: label,
      label,
      score,
    });

  // Wishlist side-effects
  if (label === "seen") {
    // Remove from watchlist if present
    try {
      const inWl = await isInWatchlist(tmdbId);
      if (inWl) await removeFromWatchlist(tmdbId);
    } catch { /* ignore */ }
  }
}

export async function clearFeedback(tmdbId: number): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const { data: existing } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (!existing?.id) return;

  await supabase
    .from("user_item_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", existing.id);
}

// ── Helpers ──

async function getOrCreateCatalogItemId(
  tmdbId: number,
  meta?: { title?: string; poster_path?: string; media_type?: string }
): Promise<string | null> {
  // Try to find existing
  const { data: existing } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing) return existing.id;

  // Only create if we have metadata
  if (!meta?.title) return null;

  const { data: created, error } = await supabase
    .from("catalog_items")
    .insert({
      tmdb_id: tmdbId,
      title: meta.title,
      poster_path: meta.poster_path || null,
      media_type: meta.media_type || "movie",
    } as any)
    .select("id")
    .single();

  if (error || !created) {
    const { data: fallback } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("tmdb_id", tmdbId)
      .maybeSingle();

    return fallback?.id ?? null;
  }

  return created.id;
}
