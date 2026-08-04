import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

/**
 * Outillage commun de la suite d'intégration.
 *
 * Les tests parlent à la vraie base : ils créent leurs propres soirées et les
 * suppriment systématiquement, pour ne jamais laisser de trace.
 */

export interface TestEnv {
  url: string;
  key: string;
  email: string;
  password: string;
}

/** Lit .env.test. Renvoie null si le fichier ou une clé manque. */
export function readTestEnv(): TestEnv | null {
  if (!existsSync(".env.test")) return null;
  const raw = Object.fromEntries(
    readFileSync(".env.test", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
  const url = raw.VITE_SUPABASE_URL;
  const key = raw.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = raw.E2E_TEST_EMAIL;
  const password = raw.E2E_TEST_PASSWORD;
  if (!url || !key || !email || !password) return null;
  return { url, key, email, password };
}

export async function signIn(env: TestEnv): Promise<{ client: SupabaseClient; userId: string } | null> {
  const client = createClient(env.url, env.key);
  const { data, error } = await client.auth.signInWithPassword({
    email: env.email,
    password: env.password,
  });
  if (error || !data?.user) return null;
  return { client, userId: data.user.id };
}

/** Vecteur neutre de dimension 32, au format attendu par pgvector. */
export const NEUTRAL_VECTOR = "[" + new Array(32).fill(0.5).join(",") + "]";

export interface CreatedEvent {
  id: string;
  inviteToken: string;
}

export async function createEvent(
  client: SupabaseClient,
  organizerId: string,
  context: "famille" | "amis" | "duo" | "solo",
): Promise<CreatedEvent> {
  const { data, error } = await client
    .from("events")
    .insert({
      organizer_id: organizerId,
      // Préfixe reconnaissable : si un nettoyage échouait, la trace est claire.
      title: "[TNR] soirée de test",
      event_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      context,
      status: "planning",
      media_type: "movie",
    } as any)
    .select("id, invite_link_token")
    .single();
  if (error || !data) throw new Error(`création de soirée impossible : ${error?.message}`);
  return { id: (data as any).id, inviteToken: (data as any).invite_link_token };
}

export async function addMembers(client: SupabaseClient, eventId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  await client.from("event_participants" as any).insert(
    userIds.map((id) => ({ event_id: eventId, user_id: id, status: "confirmed" })),
  );
}

export async function addGuest(
  client: SupabaseClient,
  inviteToken: string,
  name: string,
  ageRange: string | null,
  genres: string[] | null,
) {
  await client.rpc("join_event_as_guest" as any, {
    _token: inviteToken,
    _guest_name: name,
    _guest_email: null,
    _age_range: ageRange,
    _genres: genres,
  });
}

export async function deleteEvent(client: SupabaseClient, eventId: string) {
  await client.from("events").delete().eq("id", eventId);
}

export async function groupProfile(client: SupabaseClient, eventId: string) {
  const { data, error } = await client.functions.invoke("group-taste-profile", {
    body: { eventId },
  });
  return { data: data as any, error };
}

/** Niveaux de certification des titres renvoyés, pour vérifier le filtre. */
export async function certificationLevelsOf(
  client: SupabaseClient,
  tmdbIds: number[],
): Promise<(number | null)[]> {
  if (tmdbIds.length === 0) return [];
  const { data } = await client
    .from("movie_embeddings")
    .select("certification_level")
    .in("tmdb_id", tmdbIds);
  return (data ?? []).map((r: any) => r.certification_level);
}
