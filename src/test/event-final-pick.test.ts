import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MovieDetail } from "@/lib/tmdb";

const mockGetMovieDetailsWithCredits = vi.fn();
const mockSearchMovies = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  getDisplayTitle: (movie: MovieDetail) => movie.title ?? movie.name ?? "Sans titre",
  getYear: (movie: MovieDetail) =>
    (movie.release_date ?? movie.first_air_date ?? "").substring(0, 4),
  getMovieDetailsWithCredits: (...args: unknown[]) => mockGetMovieDetailsWithCredits(...args),
  searchMovies: (...args: unknown[]) => mockSearchMovies(...args),
}));

import {
  titlesMatch,
  pickMediaTypesToTry,
  resolvePickMediaType,
  loadFinalPickDetail,
  detectPickMediaType,
  resolveFinalPickTmdbId,
} from "@/lib/event-final-pick";

describe("titlesMatch", () => {
  it("accepte les variantes avec accents", () => {
    expect(titlesMatch("Farscape", "Farscape")).toBe(true);
    expect(titlesMatch("Été", "Ete")).toBe(true);
  });

  it("rejette des titres différents", () => {
    expect(titlesMatch("Farscape", "La vie est un long fleuve tranquille")).toBe(false);
  });
});

describe("pickMediaTypesToTry", () => {
  it("utilise final_pick_media_type quand présent", () => {
    expect(
      pickMediaTypesToTry({
        final_pick_media_type: "tv",
        media_type: "both",
        final_pick_title: "Farscape",
        final_pick_poster: null,
        final_pick_tmdb_id: 5262,
      }),
    ).toEqual(["tv"]);
  });

  it("essaie tv puis movie pour une soirée both sans final_pick_media_type", () => {
    expect(
      pickMediaTypesToTry({
        media_type: "both",
        final_pick_title: "Farscape",
        final_pick_poster: null,
        final_pick_tmdb_id: 5262,
      }),
    ).toEqual(["tv", "movie"]);
  });
});

describe("resolvePickMediaType", () => {
  it("détecte une série via first_air_date", () => {
    expect(
      resolvePickMediaType({ id: 1, title: "Farscape", first_air_date: "1999-03-19" } as MovieDetail),
    ).toBe("tv");
  });
});

describe("loadFinalPickDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("charge Farscape via /tv quand l'id est une série sur une soirée both", async () => {
    const farscape = {
      id: 5262,
      name: "Farscape",
      first_air_date: "1999-03-19",
      poster_path: "/farscape.jpg",
      overview: "Sci-fi",
      backdrop_path: null,
      vote_average: 8,
      genre_ids: [],
      runtime: 0,
      episode_run_time: [60],
      genres: [],
    };
    const wrongMovie = {
      id: 5262,
      title: "La vie est un long fleuve tranquille",
      release_date: "1988-01-01",
      poster_path: "/wrong.jpg",
      overview: "",
      backdrop_path: null,
      vote_average: 7,
      genre_ids: [],
      runtime: 95,
      episode_run_time: [],
      genres: [],
    };

    mockGetMovieDetailsWithCredits.mockImplementation((id: number, mt: string) => {
      if (mt === "tv") return Promise.resolve(farscape);
      return Promise.resolve(wrongMovie);
    });

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "both",
    });

    expect(mockGetMovieDetailsWithCredits).toHaveBeenCalledWith(5262, "tv");
    expect(result.mediaType).toBe("tv");
    expect(result.movie.name ?? result.movie.title).toBe("Farscape");
    expect(result.titleMismatch).toBeFalsy();
  });

  it("n'utilise pas la recherche par titre quand final_pick_tmdb_id est présent", async () => {
    mockGetMovieDetailsWithCredits.mockResolvedValue({
      id: 42,
      title: "Inception",
      release_date: "2010-07-16",
      poster_path: null,
      overview: "",
      backdrop_path: null,
      vote_average: 8,
      genre_ids: [],
      runtime: 148,
      episode_run_time: [],
      genres: [],
    });

    await loadFinalPickDetail({
      final_pick_title: "Inception",
      final_pick_poster: null,
      final_pick_tmdb_id: 42,
      final_pick_media_type: "movie",
    });

    expect(mockSearchMovies).not.toHaveBeenCalled();
  });

  it("retourne un stub si l'id TMDB ne correspond pas au titre", async () => {
    mockGetMovieDetailsWithCredits.mockResolvedValue({
      id: 5262,
      title: "La vie est un long fleuve tranquille",
      release_date: "1988-01-01",
      poster_path: "/wrong.jpg",
      overview: "",
      backdrop_path: null,
      vote_average: 7,
      genre_ids: [],
      runtime: 95,
      episode_run_time: [],
      genres: [],
    });

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "both",
    });

    expect(result.titleMismatch).toBe(true);
    expect(result.movie.title).toBe("Farscape");
    expect(result.movie.poster_path).toBe("/farscape.jpg");
  });
});

describe("detectPickMediaType", () => {
  beforeEach(() => vi.clearAllMocks());

  it("choisit tv quand le titre correspond sur /tv", async () => {
    mockGetMovieDetailsWithCredits.mockImplementation((_id: number, mt: string) => {
      if (mt === "tv") {
        return Promise.resolve({ id: 5262, name: "Farscape", first_air_date: "1999-03-19" });
      }
      return Promise.resolve({ id: 5262, title: "Autre film", release_date: "1988-01-01" });
    });

    const mt = await detectPickMediaType(5262, "Farscape");
    expect(mt).toBe("tv");
  });
});

describe("resolveFinalPickTmdbId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtre par media_type et année", async () => {
    mockSearchMovies.mockResolvedValue([
      { id: 1, title: "Farscape", media_type: "movie", release_date: "1988-01-01", poster_path: "/a" },
      { id: 5262, name: "Farscape", media_type: "tv", first_air_date: "1999-03-19", poster_path: "/b" },
    ]);

    const id = await resolveFinalPickTmdbId("Farscape", "tv", 1999);
    expect(id).toBe(5262);
  });
});
