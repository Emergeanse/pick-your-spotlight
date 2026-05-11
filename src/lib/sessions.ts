import { supabase } from "@/integrations/supabase/client";
import { getOrCreateCatalogItem, type CatalogMeta } from "@/lib/catalog";

export type AudienceType = "solo" | "group";
export type DecisionMode = "instant" | "planned";
export type SessionStatus = "active" | "completed" | "abandoned";

export interface CreateSessionInput {
  audience_type?: AudienceType;
  decision_mode?: DecisionMode;
  group_session_id?: string | null;
  prompt_text?: string | null;
  scheduled_for?: string | null; // ISO
  filters_snapshot?: Record<string, unknown>;
  taste_snapshot?: Record<string, unknown>;
  source?: string;
}

/** Create a new recommendation_sessions row. Returns its id. */
export async function createRecommendationSession(input: CreateSessionInput = {}) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("recommendation_sessions")
    .insert({
      user_id: userId,
      audience_type: input.audience_type ?? "solo",
      decision_mode: input.decision_mode ?? "instant",
      group_session_id: input.group_session_id ?? null,
      prompt_text: input.prompt_text ?? null,
      scheduled_for: input.scheduled_for ?? null,
      source: input.source ?? "surprise",
      status: "active",
      filters_snapshot: input.filters_snapshot ?? {},
      taste_snapshot: input.taste_snapshot ?? {},
    } as any)
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

/** Log a recommendation event (movie shown to user inside a session). */
export async function logRecommendationEvent(params: {
  session_id?: string | null;
  tmdb_id: number;
  title: string;
  rank_position?: number;
  source?: string;
  context?: Record<string, unknown>;
  score_breakdown?: Record<string, unknown>;
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  await supabase.from("recommendation_events").insert({
    user_id: userId,
    session_id: params.session_id ?? null,
    tmdb_id: params.tmdb_id,
    title: params.title,
    rank_position: params.rank_position ?? 1,
    source: params.source ?? "surprise",
    context: params.context ?? {},
    score_breakdown: params.score_breakdown ?? null,
  } as any);
}

/** Mark session completed and store the chosen film. */
export async function completeSession(
  sessionId: string,
  selectedTmdbId: number,
  meta: CatalogMeta
) {
  const itemId = await getOrCreateCatalogItem(selectedTmdbId, meta);
  await supabase
    .from("recommendation_sessions")
    .update({
      status: "completed",
      selected_catalog_item_id: itemId,
    } as any)
    .eq("id", sessionId);
  return itemId;
}

export async function abandonSession(sessionId: string) {
  await supabase
    .from("recommendation_sessions")
    .update({ status: "abandoned" } as any)
    .eq("id", sessionId);
}

export async function listMySessions(limit = 50) {
  const { data } = await supabase
    .from("recommendation_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
