import { supabase } from "@/integrations/supabase/client";

export type PreferenceCategory = "genre" | "platform" | "mood" | "duration" | "rating_threshold" | "context";

export interface PreferenceTag {
  id: string;
  category: string;
  key: string;
  label: string;
  metadata: Record<string, unknown>;
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

/** Find or create a preference tag (admin-only insert; will fail silently for non-admins). */
export async function ensurePreferenceTag(
  category: PreferenceCategory,
  key: string,
  label: string,
  metadata: Record<string, unknown> = {}
): Promise<PreferenceTag | null> {
  const { data: existing } = await supabase
    .from("preference_tags")
    .select("*")
    .eq("category", category)
    .eq("key", key)
    .maybeSingle();
  if (existing) return existing as PreferenceTag;

  const { data: created } = await supabase
    .from("preference_tags")
    .insert({ category, key, label, metadata } as any)
    .select("*")
    .single();
  return (created as PreferenceTag) ?? null;
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
    .delete()
    .eq("user_id", userId)
    .eq("tag_id", tagId);

  await supabase
    .from("user_preferences")
    .insert({ user_id: userId, tag_id: tagId, weight: clamped, source } as any);
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
