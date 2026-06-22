import { supabase } from "@/integrations/supabase/client";

export type PreferenceCategory = "genre" | "platform" | "mood" | "duration" | "rating_threshold" | "context" | "media_type";

export interface PreferenceTag {
  id: string;
  category: string;
  key: string;
  label: string;
  metadata: Record<string, any>;
}

export interface UserPreference {
  tag: PreferenceTag;
  weight: number;
  source: string;
}

/** List all known preference tags, optionally filtered by category. */
export async function listPreferenceTags(category?: PreferenceCategory): Promise<PreferenceTag[]> {
  let q = supabase.from("preference_tags").select("*");
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return (data ?? []) as PreferenceTag[];
}

/** Get current user's preferences (joined with tag info). */
export async function getMyPreferences(): Promise<UserPreference[]> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  const { data } = await supabase
    .from("user_preferences")
    .select("weight, source, tag:tag_id(id, category, key, label, metadata)")
    .eq("user_id", userId);

  return (data ?? [])
    .filter((r: any) => r.tag)
    .map((r: any) => ({ tag: r.tag, weight: Number(r.weight), source: r.source }));
}

/** Snapshot of preferences grouped by category — convenient for the engine. */
export interface PreferencesSnapshot {
  genres: { liked: string[]; excluded: string[] };
  platforms: { liked: number[]; excluded: number[] };
  mediaType: "movie" | "tv" | "both";
  maxDuration: number | null;
  minRating: number;
}

export async function getPreferencesSnapshot(): Promise<PreferencesSnapshot> {
  const prefs = await getMyPreferences();
  const snap: PreferencesSnapshot = {
    genres: { liked: [], excluded: [] },
    platforms: { liked: [], excluded: [] },
    mediaType: "both",
    maxDuration: null,
    minRating: 0,
  };
  for (const p of prefs) {
    const { tag, weight } = p;
    if (tag.category === "genre") {
      if (weight >= 0) snap.genres.liked.push(tag.label);
      else snap.genres.excluded.push(tag.label);
    } else if (tag.category === "platform") {
      const pid = Number(tag.metadata?.provider_id);
      if (!Number.isFinite(pid)) continue;
      if (weight >= 0) snap.platforms.liked.push(pid);
      else snap.platforms.excluded.push(pid);
    } else if (tag.category === "media_type" && weight > 0) {
      snap.mediaType = (tag.key as any) || "both";
    } else if (tag.category === "duration" && weight > 0) {
      const m = tag.metadata?.max_minutes;
      snap.maxDuration = m === null || m === undefined ? null : Number(m);
    } else if (tag.category === "rating_threshold" && weight > 0) {
      snap.minRating = Number(tag.metadata?.min_rating ?? 0);
    }
  }
  return snap;
}

/** Upsert a preference (weight in [-100, 100]). */
export async function setPreference(
  tagId: string,
  weight: number,
  source: "explicit" | "inferred" | "onboarding" = "explicit"
) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const clamped = Math.max(-100, Math.min(100, weight));

  await supabase
    .from("user_preferences")
    .upsert(
      { user_id: userId, tag_id: tagId, weight: clamped, source } as any,
      { onConflict: "user_id,tag_id" } as any
    );
}

export async function removePreference(tagId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;
  await supabase
    .from("user_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("tag_id", tagId);
}

/** Replace the current set of preferences for one category with `keys`.
 *  Used by Onboarding & Profile for genre/platform multi-select.
 */
export async function setCategoryPreferences(
  category: PreferenceCategory,
  keys: string[],
  source: "explicit" | "onboarding" = "explicit"
) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  // Resolve tag ids for this category
  const { data: tags } = await supabase
    .from("preference_tags")
    .select("id, key")
    .eq("category", category);
  if (!tags) return;

  const wantedIds = (tags as any[])
    .filter((t) => keys.includes(t.key))
    .map((t) => t.id);
  const allIds = (tags as any[]).map((t) => t.id);

  // Remove all existing prefs in this category for the user
  if (allIds.length) {
    await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", userId)
      .in("tag_id", allIds);
  }

  if (!wantedIds.length) return;

  const rows = wantedIds.map((id) => ({
    user_id: userId,
    tag_id: id,
    weight: 1,
    source,
  }));
  await supabase.from("user_preferences").insert(rows as any);
}

/** Replace single-pick preferences (media_type, duration, rating_threshold). */
export async function setSinglePreference(
  category: PreferenceCategory,
  key: string | null,
  source: "explicit" | "onboarding" = "explicit"
) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const { data: tags } = await supabase
    .from("preference_tags")
    .select("id, key")
    .eq("category", category);
  const all = (tags ?? []) as any[];
  const allIds = all.map((t) => t.id);
  if (allIds.length) {
    await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", userId)
      .in("tag_id", allIds);
  }
  if (!key) return;
  const tag = all.find((t) => t.key === key);
  if (!tag) return;
  await supabase
    .from("user_preferences")
    .insert({ user_id: userId, tag_id: tag.id, weight: 1, source } as any);
}

/** Replace genre prefs in one shot (liked + excluded). */
export async function setGenrePreferences(
  likedLabels: string[],
  excludedLabels: string[],
  source: "explicit" | "onboarding" = "explicit",
) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const { data: tags } = await supabase
    .from("preference_tags")
    .select("id, key, label")
    .eq("category", "genre");
  if (!tags?.length) return;

  const allIds = (tags as any[]).map((t) => t.id);
  await supabase.from("user_preferences").delete().eq("user_id", userId).in("tag_id", allIds);

  const rows: { user_id: string; tag_id: string; weight: number; source: string }[] = [];
  const likedSet = new Set(likedLabels);
  for (const label of likedLabels) {
    const tag = (tags as any[]).find((t) => t.label === label);
    if (tag) rows.push({ user_id: userId, tag_id: tag.id, weight: 1, source });
  }
  for (const label of excludedLabels) {
    if (likedSet.has(label)) continue;
    const tag = (tags as any[]).find((t) => t.label === label);
    if (tag) rows.push({ user_id: userId, tag_id: tag.id, weight: -1, source });
  }
  if (rows.length) await supabase.from("user_preferences").insert(rows as any);
}

/** Helpers used by onboarding/profile UI. */
export async function setLikedGenres(genreLabels: string[], source: "explicit" | "onboarding" = "explicit") {
  // Map labels back to keys (slug-style stored in preference_tags.key)
  const { data: tags } = await supabase
    .from("preference_tags")
    .select("key, label")
    .eq("category", "genre");
  const wanted = (tags ?? [])
    .filter((t: any) => genreLabels.includes(t.label))
    .map((t: any) => t.key);
  await setCategoryPreferences("genre", wanted, source);
}

export async function setLikedPlatforms(providerIds: number[], source: "explicit" | "onboarding" = "explicit") {
  const { data: tags } = await supabase
    .from("preference_tags")
    .select("key, metadata")
    .eq("category", "platform");
  const wanted = (tags ?? [])
    .filter((t: any) => providerIds.includes(Number(t.metadata?.provider_id)))
    .map((t: any) => t.key);
  await setCategoryPreferences("platform", wanted, source);
}
