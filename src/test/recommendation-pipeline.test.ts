/**
 * TNR phase 2 — fonctions pures pipeline surprise-personalized
 */

import { describe, it, expect } from "vitest";
import {
  normalizeExcludeIds,
  buildUsedIds,
  compositeScore,
  parseLlmSelectionsJson,
  resolveLlmSelections,
  buildSqlRpcParams,
  buildCascadeLevelParams,
  checkFinalSafety,
  mergeRecommendationScores,
  filterByUsedIds,
  CASCADE_LEVEL_LABELS,
  resolveEffectiveExclusions,
  type RpcParamsInput,
  type SqlCandidate,
} from "@/lib/recommendation-pipeline";

const baseRpcInput = (): RpcParamsInput => ({
  userTasteVector: new Array(32).fill(0.1),
  normalizedExcludeIds: [27205, 603],
  effectiveFilterMediaType: "movie",
  minRating: 6,
  effectiveExcludedGenres: ["Horreur"],
  likedGenresForSQL: ["Thriller", "Drame"],
  effectiveLikedGenresSQL: null,
  effectiveMaxDuration: null,
  userId: "user-abc",
  partnerUserId: null,
  voiceOriginalLanguage: "fr",
  voiceDecade: 1990,
  effectiveExcludedLangsArr: ["ja"],
  rejectedClusters: ["gore"],
  expandedPlatformIds: [8, 119],
});

describe("normalizeExcludeIds", () => {
  it("fusionne session, profil, duo et historique serveur sans doublons", () => {
    const ids = normalizeExcludeIds(
      [27205, 603, "invalid"],
      [603, 1891],
      [11],
      [27205, 42009],
    );
    expect(ids.sort((a, b) => a - b)).toEqual([11, 603, 1891, 27205, 42009]);
  });

  it("tableau vide si aucune source", () => {
    expect(normalizeExcludeIds([], [], [], [])).toEqual([]);
  });
});

describe("buildUsedIds — régression 2026-06-03", () => {
  it("initialise usedIds depuis normalizedExcludeIds", () => {
    const normalized = [27205, 603];
    const usedIds = buildUsedIds(normalized);
    expect(usedIds.has(27205)).toBe(true);
    expect(usedIds.has(99999)).toBe(false);
  });

  it("usedIds vide laisse passer les films interagis (bug documenté)", () => {
    const bugUsedIds = new Set<number>();
    const selections = [
      { tmdbId: 27205, title: "Inception" },
      { tmdbId: 12345, title: "Nouveau" },
    ];
    expect(filterByUsedIds(selections, bugUsedIds)).toHaveLength(2);
    expect(filterByUsedIds(selections, buildUsedIds([27205]))).toEqual([
      { tmdbId: 12345, title: "Nouveau" },
    ]);
  });
});

describe("compositeScore", () => {
  const candidate: SqlCandidate = {
    tmdb_id: 1,
    similarity: 0.82,
    vote_average: 8.1,
    original_language: "fr",
  };

  it("sim×100 + note TMDB", () => {
    expect(compositeScore(candidate)).toBeCloseTo(90.1, 5);
  });

  it("+15 si langue préférée", () => {
    expect(compositeScore(candidate, new Set(["fr"]))).toBeCloseTo(105.1, 5);
    expect(compositeScore(candidate, new Set(["en"]))).toBeCloseTo(90.1, 5);
  });

  it("tri top pool — meilleur score en tête", () => {
    const pool: SqlCandidate[] = [
      { tmdb_id: 1, similarity: 0.7, vote_average: 7 },
      { tmdb_id: 2, similarity: 0.9, vote_average: 8.5 },
      { tmdb_id: 3, similarity: 0.5, vote_average: 9 },
    ];
    const sorted = [...pool].sort((a, b) => compositeScore(b) - compositeScore(a));
    expect(sorted[0].tmdb_id).toBe(2);
  });
});

describe("parseLlmSelectionsJson + resolveLlmSelections", () => {
  const pool: SqlCandidate[] = [
    { tmdb_id: 680, title: "Pulp Fiction" },
    { tmdb_id: 155, title: "The Dark Knight" },
    { tmdb_id: 424, title: "Le Parrain" },
  ];

  it("parse JSON propre avec reason non-null", () => {
    const raw = JSON.stringify({
      selections: [
        { rank: 1, matchScore: 88, reason: "Thriller culte parfait pour toi." },
        { rank: 2, matchScore: 85, reason: "Action sombre intense." },
      ],
    });
    const parsed = parseLlmSelectionsJson(raw);
    expect(parsed?.selections).toHaveLength(2);
    const resolved = resolveLlmSelections(parsed!.selections, pool);
    expect(resolved[0].tmdb_id).toBe(680);
    expect(resolved[0].reason).toBe("Thriller culte parfait pour toi.");
    expect(resolved[0].matchScore).toBe(88);
  });

  it("parse JSON entouré de markdown", () => {
    const raw = '```json\n{"selections":[{"rank":3,"matchScore":82,"reason":"Classique"}]}\n```';
    const parsed = parseLlmSelectionsJson(raw);
    expect(parsed?.selections[0].rank).toBe(3);
    const resolved = resolveLlmSelections(parsed!.selections, pool);
    expect(resolved[0].tmdb_id).toBe(424);
    expect(resolved[0].reason).toBe("Classique");
  });

  it("fallback regex si JSON cassé", () => {
    const raw = 'broken { "rank": 2, "matchScore": 91, "reason": "Via regex" } trailing';
    const parsed = parseLlmSelectionsJson(raw);
    expect(parsed?.selections[0].matchScore).toBe(91);
    const resolved = resolveLlmSelections(parsed!.selections, pool);
    expect(resolved[0].tmdb_id).toBe(155);
  });

  it("reason null autorisé (retry qualité / fallback déterministe)", () => {
    const parsed = parseLlmSelectionsJson(
      JSON.stringify({ selections: [{ rank: 1, matchScore: 72 }] }),
    );
    const resolved = resolveLlmSelections(parsed!.selections, pool);
    expect(resolved[0].reason).toBeNull();
    expect(resolved[0].matchScore).toBe(72);
  });
});

describe("buildSqlRpcParams / cascade niveaux", () => {
  const input = baseRpcInput();

  it("niveau 0 — lang + année + plateforme actifs", () => {
    const p = buildCascadeLevelParams(input, 0);
    expect(p.p_original_language).toBe("fr");
    expect(p.p_min_year).toBe(1990);
    expect(p.p_max_year).toBe(1999);
    expect(p.p_platform_ids).toEqual([8, 119]);
    expect(p.exclude_ids).toEqual([27205, 603]);
  });

  it("niveau 1 — sans lang/année, plateforme conservée", () => {
    const p = buildCascadeLevelParams(input, 1);
    expect(p.p_original_language).toBeNull();
    expect(p.p_min_year).toBeNull();
    expect(p.p_max_year).toBeNull();
    expect(p.p_platform_ids).toEqual([8, 119]);
  });

  it("niveau 2 — liked_genres = hardGenres voice", () => {
    const p = buildCascadeLevelParams(input, 2, ["Documentaire"]);
    expect(p.liked_genres).toEqual(["Documentaire"]);
    expect(p.min_rating).toBe(6);
  });

  it("niveau 3 — min_rating=0, p_min_popularity=null", () => {
    const p = buildCascadeLevelParams(input, 3, ["Thriller"]);
    expect(p.min_rating).toBe(0);
    expect(p.p_min_popularity).toBeNull();
    expect(p.liked_genres).toEqual(["Thriller"]);
  });

  it("4 libellés cascade documentés", () => {
    expect(CASCADE_LEVEL_LABELS).toHaveLength(4);
  });

  it("buildSqlRpcParams — exclude_ids jamais tronqués", () => {
    const manyIds = Array.from({ length: 500 }, (_, i) => i + 1);
    const p = buildSqlRpcParams({ ...input, normalizedExcludeIds: manyIds }, {
      withLang: true,
      withYear: true,
      withPlatform: true,
    });
    expect((p.exclude_ids as number[]).length).toBe(500);
  });
});

describe("resolveEffectiveExclusions — thème ce soir prime sur profil", () => {
  const profileExclusions = ["Horreur", "Thriller", "Animation", "Famille"];

  it("retire voiceGenres des exclusions profil", () => {
    const { effectiveExcludedGenres, removedFromExclusions } = resolveEffectiveExclusions(
      profileExclusions,
      ["Thriller"],
      null,
    );
    expect(effectiveExcludedGenres).toEqual(["Horreur", "Animation", "Famille"]);
    expect(removedFromExclusions).toEqual(["Thriller"]);
  });

  it("retire moodBoostGenres des exclusions profil", () => {
    const { effectiveExcludedGenres, removedFromExclusions } = resolveEffectiveExclusions(
      profileExclusions,
      null,
      ["Horreur"],
    );
    expect(effectiveExcludedGenres).toEqual(["Thriller", "Animation", "Famille"]);
    expect(removedFromExclusions).toEqual(["Horreur"]);
  });

  it("sans thème actif, conserve toutes les exclusions", () => {
    const { effectiveExcludedGenres, removedFromExclusions } = resolveEffectiveExclusions(
      profileExclusions,
      null,
      [],
    );
    expect(effectiveExcludedGenres).toEqual(profileExclusions);
    expect(removedFromExclusions).toEqual([]);
  });

  it("union voiceGenres + moodBoostGenres retire les deux", () => {
    const { effectiveExcludedGenres, removedFromExclusions } = resolveEffectiveExclusions(
      profileExclusions,
      ["Thriller"],
      ["Horreur"],
    );
    expect(effectiveExcludedGenres).toEqual(["Animation", "Famille"]);
    expect(removedFromExclusions.sort()).toEqual(["Horreur", "Thriller"]);
  });
});

describe("checkFinalSafety", () => {
  it("rejette genre exclu", () => {
    const r = checkFinalSafety(
      { genres: [{ name: "Horreur" }], original_language: "en" },
      ["Horreur", "Animation"],
      [],
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Horreur");
  });

  it("rejette langue exclue", () => {
    const r = checkFinalSafety(
      { genres: [{ name: "Drame" }], original_language: "ja" },
      [],
      ["ja", "ko"],
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("ja");
  });

  it("accepte film conforme", () => {
    expect(
      checkFinalSafety(
        { genres: [{ name: "Drame" }], original_language: "fr" },
        ["Horreur"],
        ["ja"],
      ).ok,
    ).toBe(true);
  });
});

describe("mergeRecommendationScores", () => {
  it("prend le max si SP ≥ 60 et MM présent", () => {
    expect(mergeRecommendationScores(88, 92)).toBe(92);
    expect(mergeRecommendationScores(95, 80)).toBe(95);
  });

  it("ignore SP aberrant < 60 — movie-match prévaut", () => {
    expect(mergeRecommendationScores(8, 85)).toBe(85);
    expect(mergeRecommendationScores(-4, 78)).toBe(78);
  });

  it("fallback SP seul ou MM seul", () => {
    expect(mergeRecommendationScores(72, null)).toBe(72);
    expect(mergeRecommendationScores(null, 88)).toBe(88);
    expect(mergeRecommendationScores(55, 88)).toBe(88);
  });
});
