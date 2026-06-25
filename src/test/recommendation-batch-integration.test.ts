/**
 * TNR phase 2 — ensureRecommendationBatch avec mocks SP / movie-match
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import spResponseFull from "./fixtures/sp-response-full.json";
import spResponseSafetyNet from "./fixtures/sp-response-safety-net-1.json";
import mmResponse from "./fixtures/mm-response.json";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  getRecommendationScore,
} from "@/lib/recommendation-batch";
import { mergeRecommendationScores } from "@/lib/recommendation-pipeline";

const getSurpriseRecommendation = vi.fn();
const movieMatchInvoke = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  getSurpriseRecommendation: (...args: unknown[]) => getSurpriseRecommendation(...args),
  getWatchProviders: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {
      eq: () => c,
      select: () => c,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (fn: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(fn),
    };
    return c;
  };
  return {
    supabase: {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "test-user", email: "t@test.com" } } }),
      },
      from: () => chain(),
      functions: {
        invoke: (...args: unknown[]) => movieMatchInvoke(...args),
      },
    },
  };
});

vi.mock("@/lib/interactions", () => ({
  getUserTasteProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/liked-movies", () => ({
  getLikedMovies: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/taste-engine", () => ({
  computeMultiVectorProfile: vi.fn().mockResolvedValue(null),
}));

describe("fixtures SP — extractRecommendationMovies", () => {
  it("sp-response-full.json → 3 films avec recommendationTexts", () => {
    const movies = extractRecommendationMovies(spResponseFull);
    expect(movies).toHaveLength(3);
    expect(movies[0].title).toBe("Pulp Fiction");
    expect(getRecommendationScore(movies[0].recommendationTexts)).toBe(88);
    expect(movies[0].recommendationTexts?.whyItMatches).toBeTruthy();
  });

  it("sp-response-safety-net-1.json — 3 entrées dont 2 genres exclus", () => {
    const movies = extractRecommendationMovies(spResponseSafetyNet);
    expect(movies).toHaveLength(3);
    expect(movies.map((m) => m.id)).toEqual([101, 102, 103]);
  });
});

describe("ensureRecommendationBatch — filtres client", () => {
  beforeEach(() => {
    getSurpriseRecommendation.mockReset();
    movieMatchInvoke.mockReset();
  });

  it("retire les films dont le genre est exclu (invariant)", async () => {
    const movies = extractRecommendationMovies(spResponseSafetyNet);
    const batch = await ensureRecommendationBatch(movies, {
      size: 3,
      excludedGenres: ["Horreur", "Animation"],
    });
    expect(batch).toHaveLength(1);
    expect(batch[0].id).toBe(101);
    batch.forEach((m) => {
      const names = (m.genres || []).map((g) => g.name);
      expect(names).not.toContain("Horreur");
      expect(names).not.toContain("Animation");
    });
  });

  it("retire excludeIds même si SP les renvoie", async () => {
    const movies = extractRecommendationMovies(spResponseFull);
    const batch = await ensureRecommendationBatch(movies, {
      size: 3,
      excludeIds: [680, 155],
    });
    expect(batch.map((m) => m.id)).toEqual([424]);
  });

  it("scoreAllWithMovieMatch — pas de backfill TMDB aveugle", async () => {
    const single = extractRecommendationMovies(spResponseFull).slice(0, 1);
    getSurpriseRecommendation.mockResolvedValue({
      id: 99999,
      title: "Backfill TMDB",
      vote_average: 7,
      genres: [{ name: "Comédie" }],
    });

    movieMatchInvoke.mockResolvedValue({
      data: mmResponse,
      error: null,
    });

    const batch = await ensureRecommendationBatch(single, {
      size: 3,
      scoreAllWithMovieMatch: true,
      preloadMatchTexts: true,
    });

    expect(getSurpriseRecommendation).not.toHaveBeenCalled();
    expect(batch.length).toBeLessThanOrEqual(1);
  });

  it("backfill TMDB autorisé hors mode scoreAllWithMovieMatch", async () => {
    const single = extractRecommendationMovies(spResponseFull).slice(0, 1);
    getSurpriseRecommendation.mockResolvedValue({
      id: 77777,
      title: "Complément TMDB",
      vote_average: 7.5,
      genres: [{ name: "Comédie" }],
    });

    const batch = await ensureRecommendationBatch(single, {
      size: 3,
      scoreAllWithMovieMatch: false,
    });

    expect(getSurpriseRecommendation).toHaveBeenCalled();
    expect(batch.length).toBeGreaterThan(1);
    expect(batch.some((m) => m.id === 77777)).toBe(true);
  });
});

describe("ensureRecommendationBatch — fusion scores SP + movie-match", () => {
  beforeEach(() => {
    getSurpriseRecommendation.mockReset();
    movieMatchInvoke.mockReset();
    movieMatchInvoke.mockResolvedValue({
      data: { ...mmResponse, matchScore: 92, score: 92 },
      error: null,
    });
  });

  it("fusionne max(SP≥60, MM) via onMovieEnriched", async () => {
    const movies = extractRecommendationMovies(spResponseFull).slice(1, 2);
    // Sans headline/MM rich texts → movie-match est invoqué
    expect(movies[0].recommendationTexts?.headline).toBeFalsy();

    const enrichedScores: number[] = [];

    await ensureRecommendationBatch(movies, {
      size: 1,
      preloadMatchTexts: true,
      scoreAllWithMovieMatch: true,
      onMovieEnriched: (m) => {
        const score = getRecommendationScore(m.recommendationTexts);
        if (score != null) enrichedScores.push(score);
      },
    });

    expect(movieMatchInvoke).toHaveBeenCalled();
    expect(enrichedScores.length).toBeGreaterThan(0);
    expect(enrichedScores[0]).toBe(
      mergeRecommendationScores(
        getRecommendationScore(movies[0].recommendationTexts),
        mmResponse.matchScore,
      ),
    );
    expect(enrichedScores[0]).toBe(92);
  });

  it("SP aberrant 8% ignoré — MM 85% conservé", () => {
    expect(mergeRecommendationScores(8, 85)).toBe(85);
  });
});
