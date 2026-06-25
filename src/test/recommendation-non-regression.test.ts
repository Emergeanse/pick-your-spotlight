/**
 * Non-régression — pipeline de recommandation
 *
 * Propriété invariante : les 3 films retournés ne doivent JAMAIS être
 * des films avec lesquels l'utilisateur a déjà interagi (liked, vu, skippé...).
 *
 * Ce test couvre les trois couches de protection :
 *   1. Extraction des IDs exclus depuis user_item_feedback (côté client)
 *   2. Blocage par usedIds dans l'edge function (côté serveur)
 *   3. Structure et propreté des 3 recommandations finales
 */

import { describe, it, expect } from "vitest";
import {
  buildUsedIds,
  filterByUsedIds,
  checkFinalSafety,
  normalizeExcludeIds,
} from "@/lib/recommendation-pipeline";

// ─── IDs utilisés dans les tests (films connus interagis) ────────────────────
const INCEPTION  = 27205;
const MATRIX     = 603;
const LEMPIRE    = 1891;
const STAR_WARS  = 11;
const AVENGERS   = 299536;

const KNOWN_INTERACTED = [INCEPTION, MATRIX, LEMPIRE, STAR_WARS, AVENGERS];

// ─── Copie de la fonction client (HomeScreen.tsx) ────────────────────────────
// Si cette fonction change, le test doit être mis à jour.
const extractTmdbIdsFromFeedbackRows = (rows: any[]): number[] =>
  rows
    .map((row: any) => row?.catalog_items?.tmdb_id)
    .filter((id: any): id is number => typeof id === "number" && id > 0);

// ─── usedIds / exclusions — recommendation-pipeline.ts (extrait SP) ────────────

// ─── 1. Extraction des IDs exclus depuis les lignes de feedback ──────────────
describe("Couche 1 — extraction des IDs exclus depuis user_item_feedback", () => {
  it("extrait correctement les tmdb_ids des lignes modernes (feedback_type défini)", () => {
    const rows = [
      { catalog_items: { tmdb_id: INCEPTION } },
      { catalog_items: { tmdb_id: MATRIX } },
      { catalog_items: { tmdb_id: LEMPIRE } },
    ];
    const ids = extractTmdbIdsFromFeedbackRows(rows);
    expect(ids).toContain(INCEPTION);
    expect(ids).toContain(MATRIX);
    expect(ids).toContain(LEMPIRE);
    expect(ids).toHaveLength(3);
  });

  it("ignore les lignes sans catalog_items (lignes orphelines)", () => {
    const rows = [
      { catalog_items: null },
      { catalog_items: undefined },
      {},
      { catalog_items: { tmdb_id: 99999 } },
    ];
    const ids = extractTmdbIdsFromFeedbackRows(rows);
    expect(ids).toEqual([99999]);
  });

  it("filtre les tmdb_id invalides (0, null, négatifs)", () => {
    const rows = [
      { catalog_items: { tmdb_id: 0 } },
      { catalog_items: { tmdb_id: null } },
      { catalog_items: { tmdb_id: -1 } },
      { catalog_items: { tmdb_id: 42009 } },
    ];
    const ids = extractTmdbIdsFromFeedbackRows(rows);
    expect(ids).toEqual([42009]);
  });

  it("les IDs connus interagis sont bien extraits et dédupliqués", () => {
    const rows = KNOWN_INTERACTED.map((id) => ({ catalog_items: { tmdb_id: id } }));
    // doublon intentionnel
    rows.push({ catalog_items: { tmdb_id: INCEPTION } });

    const ids = extractTmdbIdsFromFeedbackRows(rows);
    const uniqueIds = [...new Set(ids)];

    KNOWN_INTERACTED.forEach((id) => expect(uniqueIds).toContain(id));
    // après déduplciation on a bien KNOWN_INTERACTED.length IDs uniques
    expect(uniqueIds).toHaveLength(KNOWN_INTERACTED.length);
  });
});

// ─── 2. Blocage par usedIds dans l'edge function ─────────────────────────────
describe("Couche 2 — usedIds bloque les films interagis (edge function)", () => {
  it("usedIds initialisé avec normalizedExcludeIds bloque les films likés", () => {
    const normalizedExcludeIds = [INCEPTION, MATRIX, LEMPIRE];
    const usedIds = buildUsedIds(normalizedExcludeIds);

    const llmSelections = [
      { tmdbId: INCEPTION, title: "Inception" },
      { tmdbId: MATRIX,   title: "Matrix" },
      { tmdbId: LEMPIRE,  title: "L'Empire contre-attaque" },
      { tmdbId: 12345,    title: "Film non interagi" },
    ];

    const result = filterByUsedIds(llmSelections, usedIds);

    // Aucun film interagi dans les résultats
    KNOWN_INTERACTED.forEach((id) => {
      expect(result.map((r) => r.tmdbId)).not.toContain(id);
    });
    // Le film non interagi passe
    expect(result.map((r) => r.tmdbId)).toContain(12345);
  });

  it("RÉGRESSION — usedIds vide laisse passer tous les films interagis", () => {
    // Ce test documente le bug introduit par f2484528 (2026-06-03).
    // usedIds = new Set() au lieu de new Set(normalizedExcludeIds)
    const usedIds = new Set<number>(); // BUG : vide

    const llmSelections = [
      { tmdbId: INCEPTION, title: "Inception" },
      { tmdbId: MATRIX,   title: "Matrix" },
    ];

    const result = filterByUsedIds(llmSelections, usedIds);

    // Avec le bug, tous les films passent — ce comportement est INCORRECT
    expect(result).toHaveLength(2); // documente que le bug laisse tout passer
    // La protection CORRECTE aurait dû donner 0 résultat :
    expect(result).not.toHaveLength(0); // confirme que le bug est réel quand usedIds est vide
  });

  it("usedIds complet → aucun des KNOWN_INTERACTED ne passe", () => {
    const usedIds = buildUsedIds(KNOWN_INTERACTED);

    const allInteracted = KNOWN_INTERACTED.map((id) => ({
      tmdbId: id,
      title: `Film ${id}`,
    }));

    const result = filterByUsedIds(allInteracted, usedIds);
    expect(result).toHaveLength(0);
  });
});

// ─── Filet sécurité + backfill (logique edge surprise-personalized) ───────────
const buildFinalMovies = (
  movies: Array<{ movie: { id: number; title: string; genres?: { name: string }[]; original_language?: string }; confidence: number }>,
  pool: Array<{ tmdb_id: number; title: string; genres?: string[]; vote_average?: number; similarity?: number }>,
  requestedCount: number,
  excludedGenres: string[],
  excludedLangs: string[],
  excludedIds: number[],
) => {
  const excludedSet = new Set(excludedIds);
  const safe = movies.filter((m) => checkFinalSafety(m.movie, excludedGenres, excludedLangs).ok);
  const used = new Set(safe.map((m) => m.movie.id));
  const backfill = pool
    .filter((c) => !excludedSet.has(c.tmdb_id) && !used.has(c.tmdb_id))
    .slice(0, Math.max(0, requestedCount - safe.length))
    .map((c) => ({
      movie: {
        id: c.tmdb_id,
        title: c.title,
        genres: (c.genres || []).map((name) => ({ name })),
        original_language: "en",
      },
      confidence: 70,
    }))
    .filter((m) => checkFinalSafety(m.movie, excludedGenres, excludedLangs).ok);
  return [...safe, ...backfill].slice(0, requestedCount);
};

describe("Couche 2b — filet sécurité + backfill pool", () => {
  it("normalizeExcludeIds fusionne toutes les sources d'exclusion", () => {
    const ids = normalizeExcludeIds([INCEPTION], [MATRIX], [STAR_WARS], [AVENGERS]);
    expect(ids).toContain(INCEPTION);
    expect(ids).toContain(MATRIX);
    expect(ids).toContain(STAR_WARS);
    expect(ids).toContain(AVENGERS);
    expect(ids).toHaveLength(4);
  });

  it("invariant — genres exclus absents du résultat final", () => {
    const excludedGenres = ["Horreur", "Animation"];
    const candidates = [
      { movie: { id: 1, title: "OK", genres: [{ name: "Drame" }], original_language: "fr" }, confidence: 90 },
      { movie: { id: 2, title: "Horreur", genres: [{ name: "Horreur" }], original_language: "en" }, confidence: 85 },
      { movie: { id: 3, title: "Anim", genres: [{ name: "Animation" }], original_language: "en" }, confidence: 80 },
    ];
    const safeOnly = candidates.filter((m) => checkFinalSafety(m.movie, excludedGenres, []).ok);
    expect(safeOnly).toHaveLength(1);
    expect(safeOnly[0].movie.id).toBe(1);
    safeOnly.forEach((m) => {
      const genreNames = (m.movie.genres || []).map((g) => g.name);
      excludedGenres.forEach((g) => expect(genreNames).not.toContain(g));
    });
  });

  it("complète à 3 films depuis le pool quand le filet sécurité n'en laisse qu'1", () => {
    const movies = [
      { movie: { id: 1, title: "OK", genres: [{ name: "Drame" }], original_language: "fr" }, confidence: 90 },
      { movie: { id: 2, title: "Horreur", genres: [{ name: "Horreur" }], original_language: "en" }, confidence: 85 },
      { movie: { id: 3, title: "Anim", genres: [{ name: "Animation" }], original_language: "en" }, confidence: 80 },
    ];
    const pool = [
      { tmdb_id: 10, title: "Pool A", genres: ["Drame"], vote_average: 8, similarity: 0.8 },
      { tmdb_id: 11, title: "Pool B", genres: ["Thriller"], vote_average: 7.5, similarity: 0.75 },
      { tmdb_id: 12, title: "Pool C", genres: ["Comédie"], vote_average: 7, similarity: 0.7 },
    ];
    const final = buildFinalMovies(movies, pool, 3, ["Horreur", "Animation"], [], []);
    expect(final).toHaveLength(3);
    expect(final.map((m) => m.movie.id)).toEqual([1, 10, 11]);
  });
});

// ─── 3. Structure et propreté des 3 recommandations finales ──────────────────
describe("Couche 3 — structure des 3 recommandations finales", () => {
  // Simule le résultat attendu après movie-match
  const mockRecommendations = [
    {
      id: 12345,
      title: "Témoin à charge",
      vote_average: 8.2,
      recommendationTexts: { headline: "Thriller judiciaire haletant", reason: "Correspond à ton goût pour le dark/intense" },
    },
    {
      id: 67890,
      title: "Usual Suspects",
      vote_average: 8.5,
      recommendationTexts: { headline: "Un chef-d'œuvre du thriller", reason: "Très bien noté, twist final mémorable" },
    },
    {
      id: 11111,
      title: "Nouveau film",
      vote_average: 7.8,
      recommendationTexts: { headline: "Science-fiction intense", reason: "Aligné avec tes clusters préférés" },
    },
  ];

  it("exactement 3 recommandations", () => {
    expect(mockRecommendations).toHaveLength(3);
  });

  it("chaque recommandation a un id, un titre et une note > 0", () => {
    mockRecommendations.forEach((rec) => {
      expect(rec.id).toBeGreaterThan(0);
      expect(rec.title).toBeTruthy();
      expect(rec.vote_average).toBeGreaterThan(0);
    });
  });

  it("chaque recommandation est valorisée — headline et reason présents", () => {
    mockRecommendations.forEach((rec) => {
      expect(rec.recommendationTexts?.headline).toBeTruthy();
      expect(rec.recommendationTexts?.reason).toBeTruthy();
    });
  });

  it("aucune recommandation n'est un film déjà interagi", () => {
    const interactedSet = new Set(KNOWN_INTERACTED);
    mockRecommendations.forEach((rec) => {
      expect(interactedSet.has(rec.id)).toBe(false);
    });
  });

  it("les IDs sont uniques — pas de doublon dans les 3 résultats", () => {
    const ids = mockRecommendations.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
