import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import type { Movie } from "@/lib/tmdb";
import { pickRandomOnboarding, shuffleOnboarding } from "@/lib/onboarding-random";

export const ONBOARDING_FILM_TARGET = 10;
/** Affiches proposées par tirage — toujours 10 titres non encore aimés. */
export const ONBOARDING_FILM_DISPLAY = 10;
export const CURATED_FR_TMDB_IDS = [
  77338, 9919, 82676, 10376, 406, 8290, 10649, 7345, 9603, 9423, 9746, 140078,
  11051, 11653, 11645, 11638, 10683, 11659, 11216, 6538, 146,
] as const;

export const CURATED_EN_TMDB_IDS = [
  27205, 155, 13, 680, 603, 278, 157336, 597, 19995, 550, 105, 671, 122, 11, 329, 98,
  76341, 299534, 238, 424, 769, 1891, 120, 181808, 177572,
] as const;
const FR_ID_SET = new Set<number>(CURATED_FR_TMDB_IDS);
const EN_ID_SET = new Set<number>(CURATED_EN_TMDB_IDS);

const GENRE_NAME_TO_ID: Record<string, number> = {
  Action: 28, Aventure: 12, Animation: 16, Comédie: 35, Crime: 80,
  Drame: 18, Famille: 10751, Fantastique: 14, Histoire: 36, Horreur: 27,
  Mystère: 9648, Romance: 10749, "Science-Fiction": 878, Thriller: 53,
};

function genreNamesToIds(names: string[]): number[] {
  return names.map((n) => GENRE_NAME_TO_ID[n]).filter(Boolean);
}

function hasExcludedGenre(movie: Movie, excludedGenreIds: number[]): boolean {
  if (!excludedGenreIds.length) return false;
  const ids = movie.genre_ids ?? [];
  return ids.some((id) => excludedGenreIds.includes(id));
}

function genreMatchScore(movie: Movie, likedGenreIds: number[]): number {
  if (!likedGenreIds.length) return 0;
  const ids = movie.genre_ids ?? [];
  return ids.filter((id) => likedGenreIds.includes(id)).length;
}

async function fetchCuratedByIds(ids: readonly number[]): Promise<Movie[]> {
  const results = await Promise.allSettled(
    ids.map((id) => fetchFromTMDB(`/movie/${id}`, { language: "fr-FR" })),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value as Movie)
    .filter((m) => m?.id && m.poster_path);
}

function interleaveFrEn(fr: Movie[], en: Movie[]): Movie[] {
  const out: Movie[] = [];
  const max = Math.max(fr.length, en.length);
  for (let i = 0; i < max; i++) {
    if (i < fr.length) out.push(fr[i]);
    if (i < en.length) out.push(en[i]);
  }
  return out;
}

function weightedShuffle(movies: Movie[], likedGenreIds: number[]): Movie[] {
  return shuffleOnboarding(
    movies.map((movie) => ({
      movie,
      weight: genreMatchScore(movie, likedGenreIds) + Math.random(),
    })),
  )
    .sort((a, b) => b.weight - a.weight)
    .map(({ movie }) => movie);
}

/** Pool curaté complet — classiques FR/US, léger bonus genres aimés. */
async function buildCandidatePool(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
): Promise<Movie[]> {
  const likedIds = genreNamesToIds(favoriteGenres);
  const excludedIds = genreNamesToIds(excludedGenres);

  const [curatedFr, curatedEn] = await Promise.all([
    fetchCuratedByIds(CURATED_FR_TMDB_IDS),
    fetchCuratedByIds(CURATED_EN_TMDB_IDS),
  ]);

  const candidates = [...curatedFr, ...curatedEn].filter((m) => !hasExcludedGenre(m, excludedIds));
  const frPool = weightedShuffle(candidates.filter((m) => FR_ID_SET.has(m.id)), likedIds);
  const enPool = weightedShuffle(candidates.filter((m) => EN_ID_SET.has(m.id)), likedIds);

  return interleaveFrEn(frPool, enPool);
}

export async function fetchMoviesByIds(ids: number[]): Promise<Movie[]> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return [];
  return fetchCuratedByIds(unique);
}

/** Tirage aléatoire — exclut les ids déjà proposés (likés ou passés). */
export async function buildOnboardingFilmDisplayPool(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
  excludeIds: number[] = [],
): Promise<Movie[]> {
  const candidates = await buildCandidatePool(favoriteGenres, excludedGenres);
  const excludeSet = new Set(excludeIds);
  const available = candidates.filter((m) => !excludeSet.has(m.id));
  return pickRandomOnboarding(available, ONBOARDING_FILM_DISPLAY);
}

/** @deprecated Utiliser buildOnboardingFilmDisplayPool */
export async function buildOnboardingFilmPool(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
): Promise<Movie[]> {
  const pool = await buildCandidatePool(favoriteGenres, excludedGenres);
  return pool.slice(0, 40);
}
export function getOnboardingFilmOriginLabel(movieId: number): string | null {
  if (FR_ID_SET.has(movieId)) return "Cinéma français";
  if (EN_ID_SET.has(movieId)) return "Blockbuster US";
  return null;
}