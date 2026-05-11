import { supabase } from "@/integrations/supabase/client";

export interface CatalogMeta {
  title?: string;
  poster_path?: string | null;
  media_type?: "movie" | "tv" | "person";
  year?: number | null;
  overview?: string | null;
  vote_average?: number | null;
  popularity?: number | null;
  runtime?: number | null;
}

/**
 * Single source of truth for resolving (and creating) a catalog_items row from a tmdb_id.
 * Returns the catalog_items.id (uuid) or null if it cannot be resolved/created.
 */
export async function getOrCreateCatalogItem(
  tmdbId: number,
  meta?: CatalogMeta
): Promise<string | null> {
  if (!tmdbId) return null;

  const mediaType = meta?.media_type ?? "movie";

  const { data: existing } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();

  if (existing?.id) return existing.id;

  if (!meta?.title) return null;

  const { data: created, error } = await supabase
    .from("catalog_items")
    .insert({
      tmdb_id: tmdbId,
      media_type: mediaType,
      title: meta.title,
      poster_path: meta.poster_path ?? null,
      year: meta.year ?? null,
      overview: meta.overview ?? null,
      vote_average: meta.vote_average ?? null,
      popularity: meta.popularity ?? null,
      runtime: meta.runtime ?? null,
    } as any)
    .select("id")
    .single();

  if (error || !created) {
    // Race: another insert may have won. Re-read.
    const { data: fallback } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    return fallback?.id ?? null;
  }

  return created.id;
}

/** Batch lookup: tmdb_id -> catalog_items.id. Does not create missing items. */
export async function getCatalogItemIds(
  tmdbIds: number[],
  mediaType?: "movie" | "tv" | "person"
): Promise<Record<number, string>> {
  if (!tmdbIds.length) return {};
  let query = supabase
    .from("catalog_items")
    .select("id, tmdb_id")
    .in("tmdb_id", tmdbIds);
  if (mediaType) query = query.eq("media_type", mediaType);
  const { data } = await query;
  const map: Record<number, string> = {};
  for (const row of data ?? []) map[row.tmdb_id] = row.id;
  return map;
}
