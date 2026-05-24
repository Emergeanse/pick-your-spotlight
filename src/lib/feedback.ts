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
import { trackInteraction, type ActionType, type InteractionContext } from "@/lib/interactions";


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
  /** Optional interaction payload — when present, an entry is also written to user_interactions. */
  interaction?: InteractionContext;
}

function mapFeedbackToAction(type: FeedbackType): ActionType | null {
  switch (type) {
    case "love":
    case "like":
      return "liked";
    case "watchlist":
      return "saved";
    case "seen":
      return "already_seen";
    case "skip":
      return "skipped";
    case "not_for_me":
    case "dislike":
      return "skipped";
    case "unknown":
      return "unsure";
    default:
      return null;
  }
}

function mapClearToAction(type: FeedbackType): ActionType | null {
  switch (type) {
    case "love":
    case "like":
      return "unliked";
    case "watchlist":
      return "unsaved";
    default:
      return null;
  }
}

function fireInteraction(
  tmdbId: number,
  action: ActionType | null,
  ctx?: FeedbackContext,
  extra?: Partial<InteractionContext>,
) {
  if (!action) return;
  const interaction: InteractionContext = {
    ...(ctx?.interaction ?? {}),
    ...(extra ?? {}),
  };
  if (ctx?.source && !interaction.source) interaction.source = ctx.source;
  if (ctx?.context_id && !interaction.session_id) interaction.session_id = ctx.context_id;
  // Fire-and-forget; trackInteraction already swallows its own errors.
  void trackInteraction(tmdbId, action, interaction);
}


const DEBUG_FEEDBACK = false;

function feedbackLog(message: string, payload?: unknown) {
  if (!DEBUG_FEEDBACK) return;
  console.log(`[feedback] ${message}`, payload ?? "");
}

function feedbackError(message: string, payload?: unknown) {
  console.error(`[feedback] ${message}`, payload ?? "");
}

function toLegacyAction(type: FeedbackType): string {
  switch (type) {
    case "love":
    case "like":
      return "liked";
    case "watchlist":
      return "saved";
    case "seen":
      return "watched";
    case "not_for_me":
    case "dislike":
    case "skip":
      return "skipped";
    case "unknown":
    default:
      return "skipped";
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

  if (error) {
    feedbackError("getFeedback failed", { tmdbId, itemId, mediaType, error });
    return null;
  }

  if (!data) return null;

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

  if (error) {
    feedbackError("getFeedbackBatch failed", { tmdbIds, mediaType, error });
    return {};
  }

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

export type PrimaryStatus = "love" | "like" | "not_for_me" | "dislike" | "skip" | "unknown";

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
  love: 6,
  like: 5,
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

  if (error) {
    feedbackError("getInteractionStateBatch failed", {
      lookups,
      itemIds,
      error,
    });
    return {};
  }

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
    } else if (type === "seen") {
      state.seen = true;
    } else {
      const candidate = type as PrimaryStatus;
      const currentRank = state.primaryStatus ? PRIMARY_RANK[state.primaryStatus] : 0;
      const newRank = PRIMARY_RANK[candidate] ?? 0;
      if (newRank > currentRank) state.primaryStatus = candidate;
    }

    state.loved = state.primaryStatus === "love";
    state.liked = state.primaryStatus === "like" || state.primaryStatus === "love";
    state.notForMe = state.primaryStatus === "not_for_me";
    state.hasInteraction = !!state.primaryStatus || state.watchlist || state.seen;

    out[tmdbId] = state;
  }

  return out;
}

function emitFeedbackChange(tmdbId: number, type: FeedbackType | null, mediaType?: CatalogMediaType) {
  if (typeof window === "undefined") return;

  feedbackLog("emitFeedbackChange", { tmdbId, type, mediaType });

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
  if (!userId) {
    feedbackError("setFeedback aborted: no user", { tmdbId, type });
    throw new Error("No authenticated user");
  }

  const normalizedMeta = meta
    ? { ...meta, media_type: normalizeCatalogMediaType(meta.media_type) }
    : { media_type: "movie" as CatalogMediaType };

  const itemId = await getOrCreateCatalogItem(tmdbId, normalizedMeta);
  if (!itemId) {
    feedbackError("setFeedback aborted: no catalog item", {
      tmdbId,
      type,
      normalizedMeta,
    });
    throw new Error(`Unable to resolve catalog item for tmdbId=${tmdbId} mediaType=${normalizedMeta.media_type}`);
  }

  const score = SCORE_MAP[type];
  const legacyAction = toLegacyAction(type);

  feedbackLog("setFeedback:start", {
    userId,
    tmdbId,
    itemId,
    type,
    legacyAction,
    mediaType: normalizedMeta.media_type,
    ctx,
  });

  const exclusive: FeedbackType[] = ["like", "love", "not_for_me", "skip", "unknown", "dislike"];

  if (exclusive.includes(type)) {
    const { error: deleteExclusiveError } = await supabase
      .from("user_item_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .in("feedback_type", exclusive);

    if (deleteExclusiveError) {
      feedbackError("setFeedback delete exclusive failed", {
        tmdbId,
        itemId,
        exclusive,
        deleteExclusiveError,
      });
      throw deleteExclusiveError;
    }

    if (type === "not_for_me") {
      const { error: deleteWatchlistError } = await supabase
        .from("user_item_feedback")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .eq("feedback_type", "watchlist");

      if (deleteWatchlistError) {
        feedbackError("setFeedback delete watchlist failed", {
          tmdbId,
          itemId,
          deleteWatchlistError,
        });
        throw deleteWatchlistError;
      }
    }
  } else {
    const { error: deleteSameTypeError } = await supabase
      .from("user_item_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("feedback_type", type);

    if (deleteSameTypeError) {
      feedbackError("setFeedback delete same type failed", {
        tmdbId,
        itemId,
        type,
        deleteSameTypeError,
      });
      throw deleteSameTypeError;
    }
  }

  const payload = {
    user_id: userId,
    item_id: itemId,
    action: legacyAction,
    label: type,
    feedback_type: type,
    score,
    source: ctx?.source ?? "manual",
    context_type: ctx?.context_type ?? "browse",
    context_id: ctx?.context_id ?? null,
  };

  feedbackLog("setFeedback:insert payload", payload);

  const { error: insertError } = await supabase.from("user_item_feedback").insert(payload as any);

  if (insertError) {
    feedbackError("setFeedback insert failed", {
      tmdbId,
      itemId,
      type,
      payload,
      insertError,
    });
    throw insertError;
  }

  feedbackLog("setFeedback:success", {
    tmdbId,
    itemId,
    type,
    mediaType: normalizedMeta.media_type,
  });

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

  if (error) {
    feedbackError("clearFeedbackType failed", {
      tmdbId,
      itemId,
      types,
      mediaType,
      error,
    });
    throw error;
  }

  emitFeedbackChange(tmdbId, null, mediaType);
}

export async function clearFeedback(tmdbId: number, mediaType: CatalogMediaType = "movie"): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const ids = await getCatalogItemIds([tmdbId], mediaType);
  const itemId = ids[tmdbId];
  if (!itemId) return;

  const { error } = await supabase.from("user_item_feedback").delete().eq("user_id", userId).eq("item_id", itemId);

  if (error) {
    feedbackError("clearFeedback failed", {
      tmdbId,
      itemId,
      mediaType,
      error,
    });
    throw error;
  }

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

  if (error) {
    feedbackError("hasFeedbackType failed", { tmdbId, itemId, type, error });
    return false;
  }

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

  if (error) {
    feedbackError("listFeedbackByType failed", { type, error });
    return [];
  }

  return data ?? [];
}
