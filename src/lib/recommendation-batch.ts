import type { MovieDetail } from "@/lib/tmdb";
import { getSurpriseRecommendation } from "@/lib/tmdb";

export const RECOMMENDATION_BATCH_SIZE = 5;

type RecommendationBatchOptions = {
  excludeIds?: number[];
  platformIds?: number[];
  minRating?: number;
  excludedGenres?: string[];
  size?: number;
};

const MOCK_BATCH: MovieDetail[] = [
  {
    id: -101,
    title: "Midnight Runaway",
    overview: "Un thriller nerveux sur une fuite nocturne qui dérape, entre tension, émotion et rebondissements.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2023-09-18",
    vote_average: 7.8,
    genre_ids: [53, 18],
    runtime: 108,
    episode_run_time: [],
    genres: [
      { id: 53, name: "Thriller" },
      { id: 18, name: "Drame" },
    ],
  },
  {
    id: -102,
    title: "Les étoiles de demain",
    overview: "Une aventure lumineuse sur un groupe d'amis qui vise grand et transforme une petite idée en odyssée collective.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2022-05-11",
    vote_average: 7.4,
    genre_ids: [35, 12],
    runtime: 101,
    episode_run_time: [],
    genres: [
      { id: 35, name: "Comédie" },
      { id: 12, name: "Aventure" },
    ],
  },
  {
    id: -103,
    title: "Verre & Tempête",
    overview: "Un drame élégant où les secrets familiaux remontent à la surface pendant un week-end qui semblait paisible.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2021-11-03",
    vote_average: 7.6,
    genre_ids: [18],
    runtime: 114,
    episode_run_time: [],
    genres: [{ id: 18, name: "Drame" }],
  },
  {
    id: -104,
    title: "Cosmos Avenue",
    overview: "Une science-fiction accessible et généreuse, portée par une quête pleine de mystère et d'émerveillement.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2024-01-26",
    vote_average: 7.9,
    genre_ids: [878, 12],
    runtime: 116,
    episode_run_time: [],
    genres: [
      { id: 878, name: "Science-Fiction" },
      { id: 12, name: "Aventure" },
    ],
  },
  {
    id: -105,
    title: "La dernière répétition",
    overview: "Une romance musicale délicate sur deux artistes qui se retrouvent au moment précis où tout peut basculer.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2020-02-14",
    vote_average: 7.3,
    genre_ids: [10749, 10402],
    runtime: 97,
    episode_run_time: [],
    genres: [
      { id: 10749, name: "Romance" },
      { id: 10402, name: "Musique" },
    ],
  },
];

const dedupeMovies = (movies: MovieDetail[]) => {
  const seen = new Set<number>();
  return movies.filter((movie) => {
    if (!movie?.id || seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
};

export const extractRecommendationMovies = (payload: any): MovieDetail[] => {
  if (!payload) return [];

  const moviesFromArray = Array.isArray(payload.movies)
    ? payload.movies
        .map((entry: any) => (entry?.movie ? entry.movie : entry))
        .filter(Boolean)
    : [];

  const movies = payload.movie ? [...moviesFromArray, payload.movie] : moviesFromArray;
  return dedupeMovies(movies as MovieDetail[]);
};

export async function ensureRecommendationBatch(
  initialMovies: MovieDetail[],
  options: RecommendationBatchOptions = {},
): Promise<MovieDetail[]> {
  const size = options.size ?? RECOMMENDATION_BATCH_SIZE;
  const batch = dedupeMovies(initialMovies);
  const usedIds = new Set<number>([...(options.excludeIds ?? []), ...batch.map((movie) => movie.id)]);

  let attempts = 0;
  while (batch.length < size && attempts < size * 4) {
    attempts += 1;
    try {
      const movie = await getSurpriseRecommendation(Array.from(usedIds), {
        platformIds: options.platformIds,
        minRating: options.minRating,
        excludedGenres: options.excludedGenres,
      });

      if (!usedIds.has(movie.id)) {
        batch.push(movie);
        usedIds.add(movie.id);
      }
    } catch {
      break;
    }
  }

  if (batch.length < size) {
    for (const movie of MOCK_BATCH) {
      if (batch.length >= size) break;
      if (usedIds.has(movie.id)) continue;
      batch.push(movie);
      usedIds.add(movie.id);
    }
  }

  return batch.slice(0, size);
}
