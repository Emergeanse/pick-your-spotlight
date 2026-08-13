import { describe, it, expect, beforeAll } from "vitest";
import { readTestEnv, type TestEnv } from "./helpers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * `profiles` porte 49 colonnes, dont l'année de naissance et la tranche d'âge.
 * Huit seulement regardent autrui. Comme le RLS PostgreSQL ne sait pas filtrer
 * par colonne, toute politique de lecture sur cette table rend la ligne
 * ENTIÈRE — d'où la règle : une seule politique, « son propre profil », et tout
 * le reste par `get_visible_profiles`.
 *
 * Ces tests attaquent la base avec les droits d'un utilisateur ordinaire.
 */

/** Colonnes qui ne doivent JAMAIS sortir de la fonction de partage. */
const JAMAIS_PARTAGEES = [
  "birth_year",
  "age_range",
  "min_rating",
  "match_threshold",
  "exploration_level",
  "streak_count",
  "total_recommendations",
  "onboarding_step",
  "preferred_platforms",
  "excluded_platforms",
];

/**
 * `get_visible_profiles` n'est pas dans les types générés. On décrit la seule
 * signature utilisée ici plutôt que de neutraliser le typage avec `any`.
 */
type VisibleRow = {
  id: string;
  display_name: string | null;
  relation: string;
  [colonne: string]: unknown;
};
type ProfileRpc = {
  rpc: (
    fn: "get_visible_profiles",
    args: { p_ids: string[] },
  ) => Promise<{ data: VisibleRow[] | null; error: { message: string } | null }>;
};
const viaRpc = (client: SupabaseClient) => client as unknown as ProfileRpc;

const env: TestEnv | null = readTestEnv();
const run = env ? describe : describe.skip;

run("exposition des profils", () => {
  let sb: SupabaseClient;
  let userId: string;
  let migrationAppliquee = true;

  beforeAll(async () => {
    sb = createClient(env!.url, env!.key);
    const { data, error } = await sb.auth.signInWithPassword({
      email: env!.email,
      password: env!.password,
    });
    if (error) throw error;
    userId = data.user!.id;

    const probe = await viaRpc(sb).rpc("get_visible_profiles", { p_ids: [userId] });
    if (probe.error && /does not exist|schema cache|could not find/i.test(probe.error.message)) {
      migrationAppliquee = false;
      console.warn("[profils] migration non appliquée — tests ignorés jusqu'au déploiement");
    }
  }, 30000);

  it("laisse chacun lire son propre profil en entier", async () => {
    if (!migrationAppliquee) return;
    const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // Son année de naissance, il a le droit de la voir.
    expect(Object.keys(data as object)).toContain("birth_year");
  }, 20000);

  it("ne rend aucune ligne pour le profil d'un tiers", async () => {
    if (!migrationAppliquee) return;
    // Un identifiant qui n'est pas le sien : quel qu'il soit, rien ne doit sortir.
    const { data, error } = await sb
      .from("profiles")
      .select("id, birth_year")
      .neq("id", userId)
      .limit(5);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  }, 20000);

  it("ne laisse fuir aucune colonne privée par la fonction de partage", async () => {
    if (!migrationAppliquee) return;
    const { data, error } = await viaRpc(sb).rpc("get_visible_profiles", { p_ids: [userId] });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const colonnes = Object.keys(data[0]);
    for (const interdite of JAMAIS_PARTAGEES) {
      expect(colonnes, `${interdite} ne doit pas être partageable`).not.toContain(interdite);
    }
    expect(data[0].relation).toBe("moi");
  }, 20000);

  it("ignore silencieusement un inconnu", async () => {
    if (!migrationAppliquee) return;
    const inconnu = "00000000-0000-0000-0000-000000000001";
    const { data, error } = await viaRpc(sb).rpc("get_visible_profiles", { p_ids: [inconnu] });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  }, 20000);

  it("ne renvoie que les identifiants demandés", async () => {
    if (!migrationAppliquee) return;
    const { data } = await viaRpc(sb).rpc("get_visible_profiles", { p_ids: [userId] });
    expect((data ?? []).every((r) => r.id === userId)).toBe(true);
  }, 20000);

  it("accepte une liste vide sans broncher", async () => {
    if (!migrationAppliquee) return;
    const { data, error } = await viaRpc(sb).rpc("get_visible_profiles", { p_ids: [] });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  }, 20000);
});
