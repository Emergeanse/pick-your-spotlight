import type { FinalPickEvent } from "@/lib/event-final-pick";
import type { MovieDetail } from "@/lib/tmdb";

const baseDetail = (overrides: Partial<MovieDetail>): MovieDetail => ({
  id: 0,
  title: "",
  poster_path: null,
  overview: "",
  backdrop_path: null,
  vote_average: 0,
  genre_ids: [],
  runtime: 0,
  episode_run_time: [],
  genres: [],
  ...overrides,
});

export const TV_SHOWS = {
  farscape: () =>
    baseDetail({
      id: 5262,
      name: "Farscape",
      first_air_date: "1999-03-19",
      poster_path: "/farscape.jpg",
      episode_run_time: [60],
    }),
  stargate: () =>
    baseDetail({
      id: 4629,
      name: "Stargate SG-1",
      first_air_date: "1997-07-27",
      poster_path: "/stargate.jpg",
      episode_run_time: [44],
    }),
  breakingBad: () =>
    baseDetail({
      id: 1396,
      name: "Breaking Bad",
      first_air_date: "2008-01-20",
      poster_path: "/breaking-bad.jpg",
      episode_run_time: [47],
    }),
};

export const MOVIES = {
  fleuveTranquille: () =>
    baseDetail({
      id: 5262,
      title: "La vie est un long fleuve tranquille",
      release_date: "1988-01-01",
      poster_path: "/fleuve.jpg",
      runtime: 95,
    }),
  indianaJones: () =>
    baseDetail({
      id: 85,
      title: "Les Aventuriers de l'arche perdue",
      release_date: "1981-06-12",
      poster_path: "/indiana.jpg",
      runtime: 115,
    }),
  inception: () =>
    baseDetail({
      id: 27205,
      title: "Inception",
      release_date: "2010-07-16",
      poster_path: null,
      runtime: 148,
    }),
};

export type TmdbMockResolver = (id: number, mt: string) => Promise<MovieDetail>;

/** Same numeric TMDB id, different content on /tv vs /movie (classic collision). */
export function sharedIdResolver(id: number, tv: MovieDetail, movie: MovieDetail): TmdbMockResolver {
  return (requestedId, mt) => {
    if (requestedId !== id) return Promise.reject(new Error(`TMDB ${mt}/${requestedId} not found`));
    return Promise.resolve(mt === "tv" ? tv : movie);
  };
}

/** Single-type resolver — other endpoint rejects. */
export function singleTypeResolver(detail: MovieDetail, type: "movie" | "tv"): TmdbMockResolver {
  return (requestedId, mt) => {
    if (requestedId !== detail.id || mt !== type) {
      return Promise.reject(new Error(`TMDB ${mt}/${requestedId} not found`));
    }
    return Promise.resolve(detail);
  };
}

/** Both endpoints return non-matching titles (title mismatch stub path). */
export function mismatchResolver(id: number): TmdbMockResolver {
  return (_id, mt) =>
    Promise.resolve(
      baseDetail({
        id,
        title: mt === "movie" ? "La vie est un long fleuve tranquille" : "Autre série",
        release_date: "1988-01-01",
        first_air_date: mt === "tv" ? "1990-01-01" : undefined,
        poster_path: "/wrong.jpg",
        runtime: 95,
      }),
    );
}

export type LoadFinalPickFixture = {
  name: string;
  event: FinalPickEvent;
  mockResolver: TmdbMockResolver;
  searchResults?: Array<Partial<MovieDetail> & { media_type?: string }>;
  expect: {
    mediaType: "movie" | "tv";
    displayTitle: string;
    tmdbCalls: Array<[number, "movie" | "tv"]>;
    titleMismatch?: boolean;
    searchCalled?: boolean;
    stubFromEvent?: boolean;
  };
};

export const LOAD_FINAL_PICK_FIXTURES: LoadFinalPickFixture[] = [
  {
    name: "Farscape — soirée both, legacy (id partagé → /tv)",
    event: {
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "both",
    },
    mockResolver: sharedIdResolver(5262, TV_SHOWS.farscape(), MOVIES.fleuveTranquille()),
    expect: {
      mediaType: "tv",
      displayTitle: "Farscape",
      tmdbCalls: [[5262, "tv"]],
    },
  },
  {
    name: "Farscape — soirée films, legacy (essaie /movie puis /tv)",
    event: {
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "movie",
    },
    mockResolver: sharedIdResolver(5262, TV_SHOWS.farscape(), MOVIES.fleuveTranquille()),
    expect: {
      mediaType: "tv",
      displayTitle: "Farscape",
      tmdbCalls: [
        [5262, "movie"],
        [5262, "tv"],
      ],
    },
  },
  {
    name: "Farscape — final_pick_media_type tv prime sur media_type soirée",
    event: {
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      final_pick_media_type: "tv",
      media_type: "movie",
    },
    mockResolver: singleTypeResolver(TV_SHOWS.farscape(), "tv"),
    expect: {
      mediaType: "tv",
      displayTitle: "Farscape",
      tmdbCalls: [[5262, "tv"]],
    },
  },
  {
    name: "Stargate SG-1 — soirée both, legacy",
    event: {
      final_pick_title: "Stargate SG-1",
      final_pick_poster: "/stargate.jpg",
      final_pick_tmdb_id: 4629,
      media_type: "both",
    },
    mockResolver: singleTypeResolver(TV_SHOWS.stargate(), "tv"),
    expect: {
      mediaType: "tv",
      displayTitle: "Stargate SG-1",
      tmdbCalls: [[4629, "tv"]],
    },
  },
  {
    name: "Breaking Bad — soirée séries uniquement",
    event: {
      final_pick_title: "Breaking Bad",
      final_pick_poster: "/breaking-bad.jpg",
      final_pick_tmdb_id: 1396,
      media_type: "tv",
    },
    mockResolver: singleTypeResolver(TV_SHOWS.breakingBad(), "tv"),
    expect: {
      mediaType: "tv",
      displayTitle: "Breaking Bad",
      tmdbCalls: [[1396, "tv"]],
    },
  },
  {
    name: "Indiana Jones — soirée both, legacy (fallback /movie)",
    event: {
      final_pick_title: "Les Aventuriers de l'arche perdue",
      final_pick_poster: "/indiana.jpg",
      final_pick_tmdb_id: 85,
      media_type: "both",
    },
    mockResolver: (id, mt) => {
      if (id !== 85) return Promise.reject(new Error("not found"));
      if (mt === "tv") return Promise.reject(new Error("no tv"));
      return Promise.resolve(MOVIES.indianaJones());
    },
    expect: {
      mediaType: "movie",
      displayTitle: "Les Aventuriers de l'arche perdue",
      tmdbCalls: [
        [85, "tv"],
        [85, "movie"],
      ],
    },
  },
  {
    name: "Indiana Jones — final_pick_media_type movie explicite",
    event: {
      final_pick_title: "Les Aventuriers de l'arche perdue",
      final_pick_poster: "/indiana.jpg",
      final_pick_tmdb_id: 85,
      final_pick_media_type: "movie",
      media_type: "both",
    },
    mockResolver: singleTypeResolver(MOVIES.indianaJones(), "movie"),
    expect: {
      mediaType: "movie",
      displayTitle: "Les Aventuriers de l'arche perdue",
      tmdbCalls: [[85, "movie"]],
    },
  },
  {
    name: "Fleuve tranquille — soirée films, id partagé résolu en film",
    event: {
      final_pick_title: "La vie est un long fleuve tranquille",
      final_pick_poster: "/fleuve.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "movie",
    },
    mockResolver: sharedIdResolver(5262, TV_SHOWS.farscape(), MOVIES.fleuveTranquille()),
    expect: {
      mediaType: "movie",
      displayTitle: "La vie est un long fleuve tranquille",
      tmdbCalls: [[5262, "movie"]],
    },
  },
  {
    name: "Inception — pas de recherche titre quand tmdb_id présent",
    event: {
      final_pick_title: "Inception",
      final_pick_poster: null,
      final_pick_tmdb_id: 27205,
      final_pick_media_type: "movie",
    },
    mockResolver: singleTypeResolver(MOVIES.inception(), "movie"),
    expect: {
      mediaType: "movie",
      displayTitle: "Inception",
      tmdbCalls: [[27205, "movie"]],
      searchCalled: false,
    },
  },
  {
    name: "Titre incompatible — stub event + titleMismatch",
    event: {
      final_pick_title: "Farscape",
      final_pick_poster: "/farscape.jpg",
      final_pick_tmdb_id: 5262,
      media_type: "both",
    },
    mockResolver: mismatchResolver(5262),
    expect: {
      mediaType: "tv",
      displayTitle: "Farscape",
      tmdbCalls: [
        [5262, "tv"],
        [5262, "movie"],
      ],
      titleMismatch: true,
      stubFromEvent: true,
    },
  },
  {
    name: "Sans tmdb_id — recherche titre (série TV)",
    event: {
      final_pick_title: "Breaking Bad",
      final_pick_poster: "/breaking-bad.jpg",
      final_pick_tmdb_id: null,
      media_type: "tv",
    },
    searchResults: [
      {
        id: 1396,
        name: "Breaking Bad",
        media_type: "tv",
        first_air_date: "2008-01-20",
        poster_path: "/breaking-bad.jpg",
      },
    ],
    mockResolver: singleTypeResolver(TV_SHOWS.breakingBad(), "tv"),
    expect: {
      mediaType: "tv",
      displayTitle: "Breaking Bad",
      tmdbCalls: [[1396, "tv"]],
      searchCalled: true,
    },
  },
  {
    name: "Sans tmdb_id — recherche titre mismatch",
    event: {
      final_pick_title: "Farscape",
      final_pick_poster: null,
      final_pick_tmdb_id: null,
      media_type: "both",
    },
    searchResults: [
      { id: 99, title: "Autre titre", media_type: "movie", release_date: "2000-01-01", poster_path: null },
    ],
    mockResolver: () =>
      Promise.resolve(
        baseDetail({
          id: 99,
          title: "Autre titre",
          release_date: "2000-01-01",
          poster_path: null,
          runtime: 90,
        }),
      ),
    expect: {
      mediaType: "tv",
      displayTitle: "Autre titre",
      tmdbCalls: [[99, "tv"]],
      titleMismatch: true,
      searchCalled: true,
    },
  },
];

export type DetectMediaTypeFixture = {
  name: string;
  tmdbId: number;
  expectedTitle: string;
  mockResolver: TmdbMockResolver;
  expect: "movie" | "tv";
};

export const DETECT_MEDIA_TYPE_FIXTURES: DetectMediaTypeFixture[] = [
  {
    name: "Farscape — titre sur /tv",
    tmdbId: 5262,
    expectedTitle: "Farscape",
    mockResolver: sharedIdResolver(5262, TV_SHOWS.farscape(), MOVIES.fleuveTranquille()),
    expect: "tv",
  },
  {
    name: "Stargate — titre sur /tv",
    tmdbId: 4629,
    expectedTitle: "Stargate SG-1",
    mockResolver: singleTypeResolver(TV_SHOWS.stargate(), "tv"),
    expect: "tv",
  },
  {
    name: "Indiana Jones — titre sur /movie",
    tmdbId: 85,
    expectedTitle: "Les Aventuriers de l'arche perdue",
    mockResolver: singleTypeResolver(MOVIES.indianaJones(), "movie"),
    expect: "movie",
  },
  {
    name: "Aucun endpoint ne matche — fallback movie",
    tmdbId: 5262,
    expectedTitle: "Farscape",
    mockResolver: mismatchResolver(5262),
    expect: "movie",
  },
];

export type ResolveTmdbIdFixture = {
  name: string;
  title: string;
  mediaType: "movie" | "tv";
  year?: string | number | null;
  searchResults: Array<Partial<MovieDetail> & { media_type?: string }>;
  expectId: number | null;
};

export const RESOLVE_TMDB_ID_FIXTURES: ResolveTmdbIdFixture[] = [
  {
    name: "Farscape — filtre tv + année 1999",
    title: "Farscape",
    mediaType: "tv",
    year: 1999,
    searchResults: [
      { id: 1, title: "Farscape", media_type: "movie", release_date: "1988-01-01", poster_path: "/a" },
      { id: 5262, name: "Farscape", media_type: "tv", first_air_date: "1999-03-19", poster_path: "/b" },
    ],
    expectId: 5262,
  },
  {
    name: "Indiana Jones — filtre movie",
    title: "Les Aventuriers de l'arche perdue",
    mediaType: "movie",
    searchResults: [
      { id: 85, title: "Les Aventuriers de l'arche perdue", media_type: "movie", release_date: "1981-06-12" },
      { id: 4629, name: "Stargate SG-1", media_type: "tv", first_air_date: "1997-07-27" },
    ],
    expectId: 85,
  },
  {
    name: "Breaking Bad — sans année, match exact tv",
    title: "Breaking Bad",
    mediaType: "tv",
    searchResults: [
      { id: 1396, name: "Breaking Bad", media_type: "tv", first_air_date: "2008-01-20" },
    ],
    expectId: 1396,
  },
  {
    name: "Recherche vide — null",
    title: "Titre introuvable",
    mediaType: "movie",
    searchResults: [],
    expectId: null,
  },
];

/** Mulberry32 — PRNG déterministe pour échantillonnage de fixtures. */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandomFixtures<T>(pool: T[], count: number, seed: number): T[] {
  const rng = mulberry32(seed);
  const copy = [...pool];
  const picked: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    picked.push(copy.splice(idx, 1)[0]);
  }
  return picked;
}

/** Fixtures avec tmdb_id (hors recherche titre) — pool pour tirage aléatoire seedé. */
export const LOAD_FINAL_PICK_ID_FIXTURES = LOAD_FINAL_PICK_FIXTURES.filter(
  (f) => f.event.final_pick_tmdb_id != null && f.searchResults === undefined,
);
