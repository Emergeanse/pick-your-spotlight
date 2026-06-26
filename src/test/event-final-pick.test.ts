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
  buildStubFromEvent,
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

  it("n'utilise pas media_type soirée quand final_pick_media_type est renseigné", () => {
    expect(
      pickMediaTypesToTry({
        final_pick_media_type: "tv",
        media_type: "movie",
        final_pick_title: "Farscape",
        final_pick_poster: null,
        final_pick_tmdb_id: 5262,
      }),
    ).toEqual(["tv"]);
  });

  it("essaie movie puis tv pour une soirée films uniquement (legacy)", () => {
    expect(
      pickMediaTypesToTry({
        media_type: "movie",
        final_pick_title: "Inception",
        final_pick_poster: null,
        final_pick_tmdb_id: 27205,
      }),
    ).toEqual(["movie", "tv"]);
  });

  it("essaie tv puis movie pour une soirée séries uniquement (legacy)", () => {
    expect(
      pickMediaTypesToTry({
        media_type: "tv",
        final_pick_title: "Farscape",
        final_pick_poster: null,
        final_pick_tmdb_id: 5262,
      }),
    ).toEqual(["tv", "movie"]);
  });
});

describe("buildStubFromEvent", () => {
  it("préfère final_pick_media_type au filtre media_type de la soirée", () => {
    const stub = buildStubFromEvent(
      {
        final_pick_media_type: "tv",
        media_type: "movie",
        final_pick_title: "Farscape",
        final_pick_poster: "/farscape.jpg",
        final_pick_tmdb_id: 5262,
      },
      5262,
    );

    expect(stub.media_type).toBe("tv");
    expect(stub.first_air_date).toBe("2000-01-01");
    expect(stub.title).toBe("Farscape");
  });
});

describe("resolvePickMediaType", () => {
  it("détecte une série via first_air_date", () => {
    expect(
      resolvePickMediaType({ id: 1, title: "Farscape", first_air_date: "1999-03-19" } as MovieDetail),
    ).toBe("tv");
  });

  it("détecte une série via media_type tv", () => {
    expect(
      resolvePickMediaType({ id: 5262, name: "Farscape", media_type: "tv" } as MovieDetail),
    ).toBe("tv");
  });

  it("détecte un film via release_date", () => {
    expect(
      resolvePickMediaType({
        id: 38,
        title: "Eternal Sunshine",
        release_date: "2004-03-19",
      } as MovieDetail),
    ).toBe("movie");
  });
});

describe("TNR — régression soirée pick (Farscape TV vs film)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("résout tmdb_id 5262 + soirée both comme série TV, pas le film homonyme", async () => {
    const farscapeTv = {
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
      if (mt === "tv") return Promise.resolve(farscapeTv);
      return Promise.resolve(wrongMovie);
    });

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "both",
    });

    expect(mockGetMovieDetailsWithCredits).toHaveBeenCalledWith(5262, "tv");
    expect(mockGetMovieDetailsWithCredits).not.toHaveBeenCalledWith(5262, "movie");
    expect(result.mediaType).toBe("tv");
    expect(result.movie.name).toBe("Farscape");
    expect(result.titleMismatch).toBeFalsy();
  });

  it("essaie /tv après échec titre sur /movie pour un id partagé (legacy)", async () => {
    const farscapeTv = {
      id: 5262,
      name: "Farscape",
      first_air_date: "1999-03-19",
      poster_path: "/farscape.jpg",
      overview: "",
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
      if (mt === "tv") return Promise.resolve(farscapeTv);
      return Promise.resolve(wrongMovie);
    });

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "movie",
    });

    expect(mockGetMovieDetailsWithCredits.mock.calls.map((c) => c[1])).toEqual(["movie", "tv"]);
    expect(result.mediaType).toBe("tv");
    expect(result.movie.name).toBe("Farscape");
  });

  it("utilise final_pick_media_type tv même si la soirée filtre films uniquement", async () => {
    mockGetMovieDetailsWithCredits.mockResolvedValue({
      id: 5262,
      name: "Farscape",
      first_air_date: "1999-03-19",
      poster_path: "/farscape.jpg",
      overview: "",
      backdrop_path: null,
      vote_average: 8,
      genre_ids: [],
      runtime: 0,
      episode_run_time: [60],
      genres: [],
    });

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      final_pick_media_type: "tv",
      media_type: "movie",
    });

    expect(mockGetMovieDetailsWithCredits).toHaveBeenCalledTimes(1);
    expect(mockGetMovieDetailsWithCredits).toHaveBeenCalledWith(5262, "tv");
    expect(result.mediaType).toBe("tv");
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
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockGetMovieDetailsWithCredits.mockImplementation((_id: number, mt: string) =>
      Promise.resolve({
        id: 5262,
        title: mt === "movie" ? "La vie est un long fleuve tranquille" : "Autre série",
        release_date: "1988-01-01",
        poster_path: "/wrong.jpg",
        overview: "",
        backdrop_path: null,
        vote_average: 7,
        genre_ids: [],
        runtime: 95,
        episode_run_time: [],
        genres: [],
      }),
    );

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "both",
    });

    expect(result.titleMismatch).toBe(true);
    expect(result.movie.title).toBe("Farscape");
    expect(result.movie.poster_path).toBe("/farscape.jpg");
    expect(result.mediaType).toBe("tv");
    expect(warnSpy).toHaveBeenCalledWith(
      "[event-final-pick] TMDB title mismatch for id",
      5262,
      "— expected",
      "Farscape",
    );

    warnSpy.mockRestore();
  });

  it("signale titleMismatch sur recherche par titre sans tmdb_id", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockSearchMovies.mockResolvedValue([
      { id: 99, title: "Autre titre", media_type: "movie", release_date: "2000-01-01", poster_path: null },
    ]);
    mockGetMovieDetailsWithCredits.mockResolvedValue({
      id: 99,
      title: "Autre titre",
      release_date: "2000-01-01",
      poster_path: null,
      overview: "",
      backdrop_path: null,
      vote_average: 6,
      genre_ids: [],
      runtime: 90,
      episode_run_time: [],
      genres: [],
    });

    const result = await loadFinalPickDetail({
      final_pick_title: "Farscape",
      final_pick_poster: null,
      final_pick_tmdb_id: null,
      media_type: "both",
    });

    expect(result.titleMismatch).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      "[event-final-pick] title search mismatch — expected",
      "Farscape",
      "got",
      "Autre titre",
    );

    warnSpy.mockRestore();
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

  it("retombe sur movie si aucun endpoint ne matche le titre", async () => {
    mockGetMovieDetailsWithCredits.mockImplementation((_id: number, mt: string) => {
      if (mt === "tv") {
        return Promise.resolve({ id: 5262, name: "Autre série", first_air_date: "1999-03-19" });
      }
      return Promise.resolve({ id: 5262, title: "Autre film", release_date: "1988-01-01" });
    });

    const mt = await detectPickMediaType(5262, "Farscape");
    expect(mt).toBe("movie");
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
