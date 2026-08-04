import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readTestEnv, signIn, NEUTRAL_VECTOR, certificationLevelsOf,
} from "./helpers";

/**
 * Fonctions SQL de sélection des candidats.
 *
 * Deux régressions réelles sont figées ici :
 *
 *  1. La surcharge ambiguë du 4 août. La migration 20260803120000 devait
 *     remplacer les deux fonctions ; son DROP visait une signature écrite à la
 *     main qui ne correspondait pas à la base. Le CREATE a produit une seconde
 *     version, et tout appel sans le nouveau paramètre a commencé à échouer en
 *     PGRST203. Le premier bloc de tests rejouerait immédiatement ce cas.
 *
 *  2. Le filtre d'âge lui-même : un titre au-dessus du plafond, ou sans
 *     certification connue, ne doit jamais remonter.
 */

// La décision d'exécuter se prend au chargement du module : les gardes des
// `describe` sont évalués à la construction, donc bien avant `beforeAll`.
// Lire le fichier est synchrone et sans réseau, c'est le bon moment.
const env = readTestEnv();
const siConnecte = () => (env ? it : it.skip);

let sb: SupabaseClient | null = null;

beforeAll(async () => {
  if (!env) return;
  const session = await signIn(env);
  // .env.test est là mais la connexion échoue : c'est un vrai problème, pas
  // une raison de passer les tests sous silence.
  if (!session) throw new Error("connexion au compte de test impossible");
  sb = session.client;
});

describe("signatures des fonctions de candidats", () => {
  siConnecte()("count_movie_candidates répond sans le paramètre d'âge", async () => {
    // Une seconde signature en base rendrait cet appel ambigu (PGRST203).
    const { data, error } = await sb!.rpc("count_movie_candidates" as any, {
      filter_media_type: "movie",
    });
    expect(error, error ? `${error.code} ${error.message}` : "").toBeNull();
    expect(Number((data as any)?.[0]?.total_in_db)).toBeGreaterThan(0);
  });

  siConnecte()("match_movies_for_recommendation répond sans le paramètre d'âge", async () => {
    const { data, error } = await sb!.rpc("match_movies_for_recommendation" as any, {
      query_vector: NEUTRAL_VECTOR,
      match_count: 5,
    });
    expect(error, error ? `${error.code} ${error.message}` : "").toBeNull();
    expect((data as any[])?.length).toBeGreaterThan(0);
  });

  siConnecte()("les deux fonctions acceptent le paramètre d'âge", async () => {
    const count = await sb!.rpc("count_movie_candidates" as any, {
      filter_media_type: "movie",
      p_max_certification_level: 1,
    });
    expect(count.error).toBeNull();

    const match = await sb!.rpc("match_movies_for_recommendation" as any, {
      query_vector: NEUTRAL_VECTOR,
      match_count: 5,
      p_max_certification_level: 1,
    });
    expect(match.error).toBeNull();
  });
});

describe("filtre d'âge sur la sélection des candidats", () => {
  for (const plafond of [0, 1, 2, 3]) {
    siConnecte()(`plafond ${plafond} : aucun titre au-dessus, aucun sans certification`, async () => {
      const { data, error } = await sb!.rpc("match_movies_for_recommendation" as any, {
        query_vector: NEUTRAL_VECTOR,
        match_count: 60,
        filter_media_type: "movie",
        p_max_certification_level: plafond,
      });
      expect(error).toBeNull();

      const ids = (data as any[]).map((m) => m.tmdb_id);
      expect(ids.length).toBeGreaterThan(0);

      const niveaux = await certificationLevelsOf(sb!, ids);
      // Le silence n'est pas une autorisation : un titre sans certification
      // connue est écarté dès qu'une contrainte existe.
      expect(niveaux.every((n) => n !== null && n <= plafond), `niveaux obtenus : ${[...new Set(niveaux)].join(",")}`).toBe(true);
    });
  }

  siConnecte()("sans plafond, des titres de tous niveaux remontent", async () => {
    const { data } = await sb!.rpc("match_movies_for_recommendation" as any, {
      query_vector: NEUTRAL_VECTOR,
      match_count: 100,
      filter_media_type: "movie",
    });
    const niveaux = await certificationLevelsOf(sb!, (data as any[]).map((m) => m.tmdb_id));
    const distincts = new Set(niveaux.filter((n) => n !== null));
    // Sans contrainte, la sélection ne doit pas être bridée sur les seuls
    // titres tous publics.
    expect(distincts.size).toBeGreaterThan(1);
  });

  siConnecte()("un plafond plus bas réduit le vivier, jamais l'inverse", async () => {
    const compte = async (cap: number | null) => {
      const params: Record<string, unknown> = { filter_media_type: "movie" };
      if (cap !== null) params.p_max_certification_level = cap;
      const { data } = await sb!.rpc("count_movie_candidates" as any, params);
      return Number((data as any)?.[0]?.total_in_db ?? 0);
    };
    const [sans, c3, c1, c0] = await Promise.all([compte(null), compte(3), compte(1), compte(0)]);
    expect(sans).toBeGreaterThanOrEqual(c3);
    expect(c3).toBeGreaterThanOrEqual(c1);
    expect(c1).toBeGreaterThanOrEqual(c0);
    expect(c0).toBeGreaterThan(0); // il reste toujours de quoi proposer
  });
});
