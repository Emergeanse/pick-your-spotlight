/**
 * Tests unitaires — helpers exportés de recommendation-batch.ts (backlog 1.19)
 */

import { describe, it, expect } from "vitest";
import {
  extractRecommendationMovies,
  getRecommendationScore,
  RECOMMENDATION_BATCH_SIZE,
} from "@/lib/recommendation-batch";

describe("extractRecommendationMovies — parsing payload surprise-personalized", () => {
  it("payload null / undefined → []", () => {
    expect(extractRecommendationMovies(null)).toEqual([]);
    expect(extractRecommendationMovies(undefined)).toEqual([]);
  });

  it("movies[] plat avec recommendationTexts inline", () => {
    const payload = {
      movies: [
        {
          id: 100,
          title: "Film A",
          recommendationTexts: { headline: "Top pick", reason: "Thriller intense", matchScore: 85 },
        },
        { id: 200, title: "Film B" },
      ],
    };
    const movies = extractRecommendationMovies(payload);
    expect(movies).toHaveLength(2);
    expect(movies[0].recommendationTexts?.headline).toBe("Top pick");
    expect(movies[0].recommendationTexts?.matchScore).toBe(85);
  });

  it("movies[] avec wrapper { movie, reason }", () => {
    const payload = {
      movies: [{ movie: { id: 300, title: "Wrapped" }, reason: "Aligné avec ton profil" }],
    };
    const movies = extractRecommendationMovies(payload);
    expect(movies[0].id).toBe(300);
    expect(movies[0].recommendationTexts?.whyItMatches ?? movies[0].recommendationTexts?.summary).toBeTruthy();
  });

  it("déduplique par id", () => {
    const payload = {
      movies: [
        { id: 400, title: "Dup" },
        { id: 400, title: "Dup bis" },
        { id: 401, title: "Unique" },
      ],
    };
    expect(extractRecommendationMovies(payload)).toHaveLength(2);
  });

  it("payload.movie singleton + movies[] fusionnés sans doublon", () => {
    const payload = {
      movie: { id: 500, title: "Solo" },
      movies: [{ id: 501, title: "Liste" }],
      headline: "Teaser",
    };
    const movies = extractRecommendationMovies(payload);
    expect(movies.map((m) => m.id).sort()).toEqual([500, 501]);
  });
});

describe("getRecommendationScore — priorité matchScore > score > confidence", () => {
  it("matchScore prioritaire", () => {
    expect(getRecommendationScore({ matchScore: 88, score: 70, confidence: 60 })).toBe(88);
  });

  it("fallback score puis confidence", () => {
    expect(getRecommendationScore({ score: 72, confidence: 65 })).toBe(72);
    expect(getRecommendationScore({ confidence: 65 })).toBe(65);
  });

  it("null si aucun score", () => {
    expect(getRecommendationScore(null)).toBeNull();
    expect(getRecommendationScore({})).toBeNull();
  });
});

describe("RECOMMENDATION_BATCH_SIZE", () => {
  it("taille batch par défaut = 5", () => {
    expect(RECOMMENDATION_BATCH_SIZE).toBe(5);
  });
});
