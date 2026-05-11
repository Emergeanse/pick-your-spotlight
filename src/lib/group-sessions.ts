import { supabase } from "@/integrations/supabase/client";
import { getOrCreateCatalogItem, type CatalogMeta } from "@/lib/catalog";
import type { DecisionMode } from "@/lib/sessions";

export interface CreateGroupSessionInput {
  title?: string;
  decision_mode?: DecisionMode;
  scheduled_for?: string | null;
  context_json?: Record<string, unknown>;
  mood?: string | null;
  context?: string | null;
  time_available?: string | null;
}

export async function createGroupSession(input: CreateGroupSessionInput = {}) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("group_sessions")
    .insert({
      creator_id: userId,
      name: input.title ?? "Soirée ciné",
      title: input.title ?? null,
      decision_mode: input.decision_mode ?? "instant",
      scheduled_for: input.scheduled_for ?? null,
      context_json: input.context_json ?? {},
      mood: input.mood ?? null,
      context: input.context ?? null,
      time_available: input.time_available ?? null,
      status: "active",
    } as any)
    .select("*")
    .single();

  if (error) throw error;

  // Auto-add creator as member
  await supabase.from("group_session_members").insert({
    session_id: data.id,
    user_id: userId,
  });

  return data;
}

export interface GuestInput {
  name: string;
  age_range?: string;
  profile_text?: string;
  preferences?: Record<string, unknown>;
}

export async function addGuestMember(sessionId: string, guest: GuestInput) {
  const { error } = await supabase.from("group_session_members").insert({
    session_id: sessionId,
    user_id: null,
    guest_name: guest.name,
    guest_age_range: guest.age_range ?? null,
    guest_profile_text: guest.profile_text ?? null,
    guest_preferences_json: guest.preferences ?? {},
  } as any);
  if (error) throw error;
}

export async function addRegisteredMember(sessionId: string, userId: string) {
  const { data: existing } = await supabase
    .from("group_session_members")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase
    .from("group_session_members")
    .insert({ session_id: sessionId, user_id: userId });
  if (error) throw error;
}

export async function listMembers(sessionId: string) {
  const { data } = await supabase
    .from("group_session_members")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });
  return data ?? [];
}

export async function selectGroupSessionFilm(
  sessionId: string,
  tmdbId: number,
  meta: CatalogMeta
) {
  const itemId = await getOrCreateCatalogItem(tmdbId, meta);
  await supabase
    .from("group_sessions")
    .update({
      selected_catalog_item_id: itemId,
      status: "completed",
    } as any)
    .eq("id", sessionId);
  return itemId;
}
