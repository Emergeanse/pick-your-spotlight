import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MovieDetail } from "@/lib/tmdb";
import {
  LOAD_FINAL_PICK_FIXTURES,
  LOAD_FINAL_PICK_ID_FIXTURES,
  DETECT_MEDIA_TYPE_FIXTURES,
  RESOLVE_TMDB_ID_FIXTURES,
  pickRandomFixtures,
} from "@/test/fixtures/event-final-pick-tnr";

const mockGetMovieDetailsWithCredits = vi.fn();
const mockSearchMovies = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  getDisplayTitle: (movie: MovieDetail) => movie.title || movie.name || "Sans titre",
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

describe.each(LOAD_FINAL_PICK_FIXTURES)("TNR loadFinalPickDetail — $name", (fixture) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("résout le pick attendu", async () => {
    const warnSpy = fixture.expect.titleMismatch
      ? vi.spyOn(console, "warn").mockImplementation(() => {})
      : null;

    mockGetMovieDetailsWithCredits.mockImplementation(fixture.mockResolver);
    if (fixture.searchResults) {
      mockSearchMovies.mockResolvedValue(fixture.searchResults);
    }

    const result = await loadFinalPickDetail(fixture.event);

    for (const [id, mt] of fixture.expect.tmdbCalls) {
      expect(mockGetMovieDetailsWithCredits).toHaveBeenCalledWith(id, mt);
    }

    if (fixture.expect.searchCalled === false) {
      expect(mockSearchMovies).not.toHaveBeenCalled();
    } else if (fixture.expect.searchCalled) {
      expect(mockSearchMovies).toHaveBeenCalled();
    }

    expect(result.mediaType).toBe(fixture.expect.mediaType);
    const displayTitle = result.movie.name ?? result.movie.title;
    if (fixture.expect.stubFromEvent) {
      expect(displayTitle).toBe(fixture.event.final_pick_title);
      expect(result.movie.poster_path).toBe(fixture.event.final_pick_poster);
    } else {
      expect(displayTitle).toBe(fixture.expect.displayTitle);
    }

    if (fixture.expect.titleMismatch) {
      expect(result.titleMismatch).toBe(true);
    } else {
      expect(result.titleMismatch).toBeFalsy();
    }

    warnSpy?.mockRestore();
  });
});

describe("TNR — échantillon aléatoire seedé (cas variés)", () => {
  const SEED = 42;
  const SAMPLE_SIZE = 5;
  const sampled = pickRandomFixtures(LOAD_FINAL_PICK_ID_FIXTURES, SAMPLE_SIZE, SEED);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(`exécute ${SAMPLE_SIZE} cas tirés du pool (${LOAD_FINAL_PICK_ID_FIXTURES.length} fixtures, seed ${SEED})`, async () => {
    for (const fixture of sampled) {
      mockGetMovieDetailsWithCredits.mockImplementation(fixture.mockResolver);

      const result = await loadFinalPickDetail(fixture.event);

      expect(result.mediaType).toBe(fixture.expect.mediaType);
      const displayTitle = result.movie.name ?? result.movie.title;
      if (fixture.expect.stubFromEvent) {
        expect(displayTitle).toBe(fixture.event.final_pick_title);
      } else {
        expect(displayTitle).toBe(fixture.expect.displayTitle);
      }
    }
  });
});

describe.each(DETECT_MEDIA_TYPE_FIXTURES)("detectPickMediaType — $name", (fixture) => {
  beforeEach(() => vi.clearAllMocks());

  it("détecte le bon media_type", async () => {
    mockGetMovieDetailsWithCredits.mockImplementation(fixture.mockResolver);

    const mt = await detectPickMediaType(fixture.tmdbId, fixture.expectedTitle);
    expect(mt).toBe(fixture.expect);
  });
});

describe.each(RESOLVE_TMDB_ID_FIXTURES)("resolveFinalPickTmdbId — $name", (fixture) => {
  beforeEach(() => vi.clearAllMocks());

  it("résout l'id TMDB attendu", async () => {
    mockSearchMovies.mockResolvedValue(fixture.searchResults);

    const id = await resolveFinalPickTmdbId(fixture.title, fixture.mediaType, fixture.year);
    expect(id).toBe(fixture.expectId);
  });
});
