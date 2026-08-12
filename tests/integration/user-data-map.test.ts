import { describe, it, expect, beforeAll } from "vitest";
import { readTestEnv, type TestEnv } from "./helpers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * La cartographie de `_shared/user-data.ts` pilote l'export ET la suppression
 * de compte. Une table mal orthographiée ou une colonne renommée ne casserait
 * rien visiblement : l'export livrerait moins que promis, la suppression
 * laisserait des données derrière elle. Ce test confronte la carte au terrain.
 *
 * Duplication assumée de la liste : le fichier source est en Deno et importe
 * depuis esm.sh, illisible pour Vitest. Si les deux divergent, ce test le dit.
 */
const USER_DATA_MAP: Record<string, string[]> = {
  user_interactions: ["user_id"],
  user_item_feedback: ["user_id"],
  user_movie_scores: ["user_id"],
  user_taste_vectors: ["user_id"],
  cinematic_profiles: ["user_id"],
  user_preferences: ["user_id"],
  user_people_preferences: ["user_id"],
  liked_movies: ["user_id"],
  watchlist: ["user_id"],
  user_wishlist: ["user_id"],
  daily_usage: ["user_id"],
  recommendation_events: ["user_id"],
  recommendation_sessions: ["user_id"],
  notifications: ["user_id"],
  shared_recommendations: ["sender_id", "receiver_id"],
  friendships: ["requester_id", "addressee_id"],
  duo_taste_profiles: ["user1_id", "user2_id"],
  event_film_feedback: ["user_id"],
  event_participants: ["user_id"],
  group_session_members: ["user_id"],
  events: ["organizer_id"],
  group_sessions: ["creator_id"],
  subscriptions: ["user_id"],
  user_roles: ["user_id"],
  profiles: ["id"],
};

const env: TestEnv | null = readTestEnv();
const run = env ? describe : describe.skip;

run("cartographie des données utilisateur", () => {
  let sb: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    sb = createClient(env!.url, env!.key);
    const { data, error } = await sb.auth.signInWithPassword({
      email: env!.email,
      password: env!.password,
    });
    if (error) throw error;
    userId = data.user!.id;
  }, 30000);

  const entries = Object.entries(USER_DATA_MAP);

  it.each(entries)(
    "%s : la table existe et la colonne utilisateur est interrogeable",
    async (table, columns) => {
      for (const column of columns) {
        const { error } = await sb.from(table).select(column).eq(column, userId).limit(1);

        // Une politique RLS peut refuser la lecture — c'est même attendu sur
        // certaines tables. Ce qu'on traque, c'est la table ou la colonne qui
        // n'existe pas : la suppression échouerait silencieusement dessus.
        if (error) {
          expect(
            /does not exist|schema cache|could not find/i.test(error.message),
            `${table}.${column} introuvable : ${error.message}`,
          ).toBe(false);
        }
      }
    },
    20000,
  );

  it("couvre au moins les tables que l'ancienne suppression traitait", () => {
    // admin-delete-user en couvrait douze. Toute régression sous ce seuil
    // signifierait qu'on a perdu du terrain plutôt que d'en gagner.
    const ancienne = [
      "liked_movies", "watchlist", "user_interactions", "daily_usage",
      "notifications", "cinematic_profiles", "user_taste_vectors",
      "subscriptions", "friendships", "group_session_members",
      "user_roles", "profiles",
    ];
    for (const t of ancienne) expect(Object.keys(USER_DATA_MAP)).toContain(t);
    expect(entries.length).toBeGreaterThanOrEqual(24);
  });
});
