import { supabase } from "@/integrations/supabase/client";

export type CatalogMediaType = "movie" | "tv" | "person";

export interface CatalogItemLookup {
  tmdbId: number;
  mediaType: CatalogMediaType;
}

export function normalizeCatalogMediaType(mediaType?: string | null): CatalogMediaType {
  return mediaType === "tv" || mediaType === "person" ? mediaType : "movie";
}

export function inferCatalogMediaType(
  item?: { media_type?: string | null; first_air_date?: string | null } | null,
): CatalogMediaType {
  if (item?.media_type) return normalizeCatalogMediaType(item.media_type);
  return item?.first_air_date ? "tv" : "movie";
}

export function catalogLookupKey(tmdbId: number, mediaType: CatalogMediaType = "movie"): string {
  return `${tmdbId}:${mediaType}`;
}

export interface CatalogMeta {
  title?: string;
  poster_path?: string | null;
  media_type?: CatalogMediaType;
  year?: number | null;
  overview?: string | null;
  vote_average?: number | null;
  popularity?: number | null;
  runtime?: number | null;
}

const DEBUG_CATALOG = true;

function catalogLog(message: string, payload?: unknown) {
  if (!DEBUG_CATALOG) return;
  console.log(`[catalog] ${message}`, payload ?? "");
}

function catalogError(message: string, payload?: unknown) {
  console.error(`[catalog] ${message}`, payload ?? "");
}

/**
 * Single source of truth for resolving (and creating) a catalog_items row from a tmdb_id.
 * Returns the catalog_items.id (uuid) or null if it cannot be resolved/created.
 */
export async function getOrCreateCatalogItem(tmdbId: number, meta?: CatalogMeta): Promise<string | null> {
  if (!tmdbId) {
    catalogError("getOrCreateCatalogItem aborted: invalid tmdbId", { tmdbId });
    return null;
  }

  const mediaType = normalizeCatalogMediaType(meta?.media_type);

  catalogLog("getOrCreateCatalogItem:start", {
    tmdbId,
    mediaType,
    meta,
  });

  const { data: existing, error: existingError } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();

  if (existingError) {
    catalogError("getOrCreateCatalogItem read existing failed", {
      tmdbId,
      mediaType,
      existingError,
    });
    return null;
  }

  if (existing?.id) {
    catalogLog("getOrCreateCatalogItem found existing", {
      tmdbId,
      mediaType,
      itemId: existing.id,
    });
    return existing.id;
  }

  if (!meta?.title) {
    catalogError("getOrCreateCatalogItem aborted: missing title", {
      tmdbId,
      mediaType,
      meta,
    });
    return null;
  }

  const payload = {
    tmdb_id: tmdbId,
    media_type: mediaType,
    title: meta.title,
    poster_path: meta.poster_path ?? null,
    year: meta.year ?? null,
    overview: meta.overview ?? null,
    vote_average: meta.vote_average ?? null,
    popularity: meta.popularity ?? null,
    runtime: meta.runtime ?? null,
  };

  catalogLog("getOrCreateCatalogItem:create attempt", payload);

  const { data: created, error: createError } = await supabase
    .from("catalog_items")
    .insert(payload as any)
    .select("id")
    .single();

  if (!createError && created?.id) {
    catalogLog("getOrCreateCatalogItem created", {
      tmdbId,
      mediaType,
      itemId: created.id,
    });
    return created.id;
  }

  catalogError("getOrCreateCatalogItem create failed, trying fallback read", {
    tmdbId,
    mediaType,
    createError,
  });

  const { data: fallback, error: fallbackError } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();

  if (fallbackError) {
    catalogError("getOrCreateCatalogItem fallback read failed", {
      tmdbId,
      mediaType,
      fallbackError,
    });
    return null;
  }

  if (fallback?.id) {
    catalogLog("getOrCreateCatalogItem fallback resolved", {
      tmdbId,
      mediaType,
      itemId: fallback.id,
    });
    return fallback.id;
  }

  catalogError("getOrCreateCatalogItem final failure", {
    tmdbId,
    mediaType,
    meta,
  });
  return null;
}

/** Batch lookup: tmdb_id -> catalog_items.id for one explicit media type. Does not create missing items. */
export async function getCatalogItemIds(
  tmdbIds: number[],
  mediaType: CatalogMediaType = "movie",
): Promise<Record<number, string>> {
  if (!tmdbIds.length) return {};

  const normalizedMediaType = normalizeCatalogMediaType(mediaType);

  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, tmdb_id")
    .in("tmdb_id", tmdbIds)
    .eq("media_type", normalizedMediaType);

  if (error) {
    catalogError("getCatalogItemIds failed", {
      tmdbIds,
      mediaType: normalizedMediaType,
      error,
    });
    return {};
  }

  const map: Record<number, string> = {};
  for (const row of data ?? []) map[row.tmdb_id] = row.id;
  return map;
}

/** Batch lookup: `${tmdb_id}:${media_type}` -> catalog_items.id. Does not create missing items. */
export async function getCatalogItemIdsByLookup(lookups: CatalogItemLookup[]): Promise<Record<string, string>> {
  const normalized = Array.from(
    new Map(
      lookups
        .filter((lookup) => lookup.tmdbId > 0)
        .map((lookup) => {
          const mediaType = normalizeCatalogMediaType(lookup.mediaType);
          return [catalogLookupKey(lookup.tmdbId, mediaType), { tmdbId: lookup.tmdbId, mediaType }] as const;
        }),
    ).values(),
  );

  if (!normalized.length) return {};

  const tmdbIds = Array.from(new Set(normalized.map((lookup) => lookup.tmdbId)));
  const mediaTypes = Array.from(new Set(normalized.map((lookup) => lookup.mediaType)));

  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, tmdb_id, media_type")
    .in("tmdb_id", tmdbIds)
    .in("media_type", mediaTypes);

  if (error) {
    catalogError("getCatalogItemIdsByLookup failed", {
      lookups: normalized,
      error,
    });
    return {};
  }

  const wanted = new Set(normalized.map((lookup) => catalogLookupKey(lookup.tmdbId, lookup.mediaType)));

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const key = catalogLookupKey(row.tmdb_id, normalizeCatalogMediaType(row.media_type));
    if (wanted.has(key)) map[key] = row.id;
  }

  return map;
}
