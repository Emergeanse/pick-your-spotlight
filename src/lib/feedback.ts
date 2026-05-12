import { supabase } from "@/integrations/supabase/client";
import {
  catalogLookupKey,
  getCatalogItemIds,
  getCatalogItemIdsByLookup,
  getOrCreateCatalogItem,
  normalizeCatalogMediaType,
  type CatalogItemLookup,
  type CatalogMediaType,
  type CatalogMeta,
} from "@/lib/catalog";

export type FeedbackType = "like" | "love" | "seen" | "not_for_me" | "watchlist" | "skip" | "dislike" | "unknown";

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

function toLegacyAction(type: FeedbackType): string {
  switch (type) {
    case "love":
    case "like":
      return "liked";
    case "watchlist":
      return "saved";
    case "seen":
      return "already_seen";
    case "not_for_me":
    case "dislike":
    case "skip":
      return "skipped";
    case "unknown":
    default:
      return "unsure";
  }
}

function toCatalogLookups(
  input: number[] | CatalogItemLookup[],
  fallbackMediaType: CatalogMediaType = "movie",
): CatalogItemLookup[] {
  const normalizedFallback = normalizeCatalogMediaType(fallbackMediaType);

  return (input as Array<number | CatalogItemLookup>)
    .map((item) =>
      typeof item === "number"
        ? { tmdbId: item, mediaType: normalizedFallback }
        : {
            tmdbId: item.tmdbId,
            mediaType: normalizeCatalogMediaType(item.mediaType),
          },
    )
    .filter((lookup) => lookup.tmdbId > 0);
}

export async function getFeedback(
  tmdbId: number,
  mediaType: CatalogMediaType = "movie",
): Promise<FeedbackState | null> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const ids = await getCatalogItemIds([tmdbId], mediaType);
  const itemId = ids[tmdbId];
  if (!itemId) return null;

  const { data, error } = await supabase
    .from("user_item_feedback")
    .select("feedback_type, label, score")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const type = (data.feedback_type ?? data.label) as FeedbackType;
  return { label: type, feedback_type: type, score: data.score ?? 0 };
}

export async function getFeedbackBatch(
  tmdbIds: number[],
  mediaType: CatalogMediaType = "movie",
): Promise<Record<number, FeedbackState>> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId || !tmdbIds.length) return {};

  const lookups = toCatalogLookups(tmdbIds, mediaType);
  const idMap = await getCatalogItemIdsByLookup(lookups);
  const itemIds = Object.values(idMap);
  if (!itemIds.length) return {};

  const reverse: Record<string, number> = {};
  for (const lookup of lookups) {
    const itemId = idMap[catalogLookupKey(lookup.tmdbId, lookup.mediaType)];
    if (itemId) reverse[itemId] = lookup.tmdbId;
  }

  const { data, error } = await supabase
    .from("user_item_feedback")
    .select("item_id, feedback_type, label, score, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  if (error) return {};

  const result: Record<number, FeedbackState> = {};
  const seen = new Set<string>();

  for (const fb of data ?? []) {
    if (seen.has(fb.item_id)) continue;
    seen.add(fb.item_id);

    const tmdbId = reverse[fb.item_id];
    if (tmdbId === undefined) continue;

    const type = (fb.feedback_type ?? fb.label) as FeedbackType;
    result[tmdbId] = {
      label: type,
      feedback_type: type,
      score: fb.score ?? 0,
    };
  }

  return result;
}

export type PrimaryStatus = "love" | "like" | "seen" | "not_for_me" | "dislike" | "skip" | "unknown";

export interface MovieInteractionState {
  primaryStatus: PrimaryStatus | null;
  loved: boolean;
  liked: boolean;
  seen: boolean;
  notForMe: boolean;
  watchlist: boolean;
  hasInteraction: boolean;
}

const PRIMARY_RANK: Record<PrimaryStatus, number> = {
  love: 7,
  like: 6,
  seen: 5,
  not_for_me: 4,
  dislike: 3,
  skip: 2,
  unknown: 1,
};

export const EMPTY_INTERACTION_STATE: MovieInteractionState = {
  primaryStatus: null,
  loved: false,
  liked: false,
  seen: false,
  notForMe: false,
  watchlist: false,
  hasInteraction: false,
};

export async function getInteractionStateBatch(
  input: number[] | CatalogItemLookup[],
  fallbackMediaType: CatalogMediaType = "movie",
): Promise<Record<number, MovieInteractionState>> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const lookups = toCatalogLookups(input, fallbackMediaType);
  if (!userId || !lookups.length) return {};

  const idMap = await getCatalogItemIdsByLookup(lookups);
  const itemIds = Object.values(idMap);
  if (!itemIds.length) return {};

  const reverse: Record<string, CatalogItemLookup> = {};
  for (const lookup of lookups) {
    const itemId = idMap[catalogLookupKey(lookup.tmdbId, lookup.mediaType)];
    if (itemId) reverse[itemId] = lookup;
  }

  const { data, error } = await supabase
    .from("user_item_feedback")
    .select("item_id, feedback_type, label, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  if (error) return {};

  const out: Record<number, MovieInteractionState> = {};

  for (const row of data ?? []) {
    const lookup = reverse[row.item_id];
    if (!lookup) continue;

    const tmdbId = lookup.tmdbId;
    const type = (row.feedback_type ?? row.label) as FeedbackType;
    if (!type) continue;

    const state = out[tmdbId] ?? { ...EMPTY_INTERACTION_STATE };

    if (type === "watchlist") {
      state.watchlist = true;
    } else {
      const candidate = type as PrimaryStatus;
      const currentRank = state.primaryStatus ? PRIMARY_RANK[state.primaryStatus] : 0;
      const newRank = PRIMARY_RANK[candidate] ?? 0;
      if (newRank > currentRank) state.primaryStatus = candidate;
    }

    state.loved = state.primaryStatus === "love";
    state.liked = state.primaryStatus === "like" || state.primaryStatus === "love";
    state.seen = state.primaryStatus === "seen";
    state.notForMe = state.primaryStatus === "not_for_me";
    state.hasInteraction = !!state.primaryStatus || state.watchlist;

    out[tmdbId] = state;
  }

  return out;
}

function emitFeedbackChange(tmdbId: number, type: FeedbackType | null, mediaType?: CatalogMediaType) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("pick-feedback-changed", {
      detail: { tmdbId, type, mediaType },
    }),
  );
}

export async function setFeedback(
  tmdbId: number,
  type: FeedbackType,
  meta?: CatalogMeta,
  ctx?: FeedbackContext,
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No authenticated user");

  const normalizedMeta = meta
    ? { ...meta, media_type: normalizeCatalogMediaType(meta.media_type) }
    : { media_type: "movie" as CatalogMediaType };

  const itemId = await getOrCreateCatalogItem(tmdbId, normalizedMeta);
  if (!itemId) {
    throw new Error(`Unable to resolve catalog item for tmdbId=${tmdbId} mediaType=${normalizedMeta.media_type}`);
  }

  const score = SCORE_MAP[type];
  const legacyAction = toLegacyAction(type);

  const exclusive: FeedbackType[] = ["like", "love", "seen", "not_for_me", "skip", "unknown", "dislike"];

  if (exclusive.includes(type)) {
    const { error: deleteExclusiveError } = await supabase
      .from("user_item_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .in("feedback_type", exclusive);

    if (deleteExclusiveError) throw deleteExclusiveError;

    if (type === "seen" || type === "not_for_me") {
      const { error: deleteWatchlistError } = await supabase
        .from("user_item_feedback")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .eq("feedback_type", "watchlist");

      if (deleteWatchlistError) throw deleteWatchlistError;
    }
  } else {
    const { error: deleteSameTypeError } = await supabase
      .from("user_item_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("feedback_type", type);

    if (deleteSameTypeError) throw deleteSameTypeError;
  }

  const { error: insertError } = await supabase.from("user_item_feedback").insert({
    user_id: userId,
    item_id: itemId,
    action: legacyAction,
    label: type,
    feedback_type: type,
    score,
    source: ctx?.source ?? "manual",
    context_type: ctx?.context_type ?? "browse",
    context_id: ctx?.context_id ?? null,
  } as any);

  if (insertError) throw insertError;

  emitFeedbackChange(tmdbId, type, normalizedMeta.media_type);
}

export async function clearFeedbackType(
  tmdbId: number,
  types: FeedbackType[],
  mediaType: CatalogMediaType = "movie",
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId || !types.length) return;

  const ids = await getCatalogItemIds([tmdbId], mediaType);
  const itemId = ids[tmdbId];
  if (!itemId) return;

  const { error } = await supabase
    .from("user_item_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .in("feedback_type", types);

  if (error) throw error;

  emitFeedbackChange(tmdbId, null, mediaType);
}

export async function clearFeedback(tmdbId: number, mediaType: CatalogMediaType = "movie"): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const ids = await getCatalogItemIds([tmdbId], mediaType);
  const itemId = ids[tmdbId];
  if (!itemId) return;

  const { error } = await supabase.from("user_item_feedback").delete().eq("user_id", userId).eq("item_id", itemId);

  if (error) throw error;

  emitFeedbackChange(tmdbId, null, mediaType);
}

export async function hasFeedbackType(
  tmdbId: number,
  type: FeedbackType,
  mediaType: CatalogMediaType = "movie",
): Promise<boolean> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return false;

  const ids = await getCatalogItemIds([tmdbId], mediaType);
  const itemId = ids[tmdbId];
  if (!itemId) return false;

  const { data, error } = await supabase
    .from("user_item_feedback")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("feedback_type", type)
    .limit(1)
    .maybeSingle();

  if (error) return false;

  return !!data;
}

export async function listFeedbackByType(type: FeedbackType) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_item_feedback")
    .select(
      "item_id, score, created_at, catalog_items:item_id(id, tmdb_id, title, poster_path, media_type, year, runtime, overview, vote_average)",
    )
    .eq("user_id", userId)
    .eq("feedback_type", type)
    .order("created_at", { ascending: false });

  if (error) return [];

  return data ?? [];
}
