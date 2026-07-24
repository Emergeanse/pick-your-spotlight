import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import { hasMoviePoster, type Movie } from "@/lib/tmdb";
import { pickRandomOnboarding, shuffleOnboarding } from "@/lib/onboarding-random";

export const ONBOARDING_FILM_TARGET = 6;
/** Plafond de films likés conservés en base — au-delà, on arrête d'enregistrer mais l'écran reste utilisable. */
export const ONBOARDING_FILM_LIKED_MAX = 30;
/** Titres chargés par page au scroll — assez pour remplir l'écran de plusieurs lignes d'un coup. */
export const ONBOARDING_FILM_PAGE_SIZE = 12;
/** @deprecated Utiliser ONBOARDING_FILM_PAGE_SIZE */
export const ONBOARDING_FILM_DISPLAY = ONBOARDING_FILM_PAGE_SIZE;
export const CURATED_FR_TMDB_IDS = [
  // Comédies & succès populaires
  77338, 9919, 82676, 10376, 7345, 9423, 82587, 9326, 11318, 140078, 344871,
  11653, 11645, 437032, 458737, 424619, 248566, 20453, 11690, 49981, 11153,
  // Action, drame, auteurs
  406, 10649, 8290, 6538, 146, 452, 87480, 8913, 11024, 74643, 11216, 508,
  3114, 12107, 61344, 16804, 50546, 9603, 244517, 94507,
  // Très visible récemment en France
  60308, 575417, 531428, 484436, 496243, 8363, 14901,
] as const;

export const CURATED_EN_TMDB_IDS = [
  // Blockbusters & classiques US
  27205, 155, 13, 680, 603, 278, 157336, 597, 19995, 550, 105, 671, 122, 11,
  329, 98, 76341, 299534, 238, 424, 769, 1891, 120, 181808, 49026, 272, 274,
  // Marvel & super-héros
  24428, 1726, 99861, 271110, 284054, 118340, 299536, 315635, 429617, 324857,
  475557, 634649, 505642, 447365, 284053, 353081, 299537, 100402,
  // Animation & familial
  862, 10674, 9806, 808, 12, 150540, 508442, 354912, 129, 585, 10681, 8587,
  13681, 260514, 508965, 10193, 10198, 10192,
  // Autres incontournables
  16869, 687, 646, 313369, 335984, 1895, 1893, 140607, 12445, 672, 673, 674,
  807, 578, 348, 601, 762, 857, 1930, 22, 77, 6977, 18, 424694,
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
    .filter((m) => m?.id && hasMoviePoster(m));
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
let candidatePoolCache: { key: string; pool: Movie[]; at: number } | null = null;
const CANDIDATE_POOL_TTL_MS = 10 * 60 * 1000;

async function buildCandidatePool(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
): Promise<Movie[]> {
  const cacheKey = `${favoriteGenres.join(",")}|${excludedGenres.join(",")}`;
  if (
    candidatePoolCache?.key === cacheKey &&
    Date.now() - candidatePoolCache.at < CANDIDATE_POOL_TTL_MS
  ) {
    return candidatePoolCache.pool;
  }

  const likedIds = genreNamesToIds(favoriteGenres);
  const excludedIds = genreNamesToIds(excludedGenres);

  const [curatedFr, curatedEn] = await Promise.all([
    fetchCuratedByIds(CURATED_FR_TMDB_IDS),
    fetchCuratedByIds(CURATED_EN_TMDB_IDS),
  ]);

  const candidates = [...curatedFr, ...curatedEn].filter((m) => !hasExcludedGenre(m, excludedIds));
  const frPool = weightedShuffle(candidates.filter((m) => FR_ID_SET.has(m.id)), likedIds);
  const enPool = weightedShuffle(candidates.filter((m) => EN_ID_SET.has(m.id)), likedIds);

  const pool = interleaveFrEn(frPool, enPool).filter(hasMoviePoster);
  candidatePoolCache = { key: cacheKey, pool, at: Date.now() };
  return pool;
}

function pickFilmsWithPosters(available: Movie[], limit: number): Movie[] {
  const eligible = available.filter(hasMoviePoster);
  if (!eligible.length || limit <= 0) return [];

  const picked: Movie[] = [];
  const usedIds = new Set<number>();
  let pool = eligible;

  while (picked.length < limit && pool.length > 0) {
    const batch = pickRandomOnboarding(pool, limit - picked.length);
    if (!batch.length) break;
    for (const movie of batch) {
      if (usedIds.has(movie.id) || !hasMoviePoster(movie)) continue;
      picked.push(movie);
      usedIds.add(movie.id);
    }
    pool = pool.filter((m) => !usedIds.has(m.id));
  }

  return picked;
}

export async function fetchMoviesByIds(ids: number[]): Promise<Movie[]> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return [];
  return fetchCuratedByIds(unique);
}

/** Page suivante — exclut les ids déjà proposés (likés ou passés). */
export async function fetchOnboardingFilmPage(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
  excludeIds: number[] = [],
  limit: number = ONBOARDING_FILM_PAGE_SIZE,
): Promise<Movie[]> {
  const candidates = await buildCandidatePool(favoriteGenres, excludedGenres);
  if (!candidates.length) return [];
  const excludeSet = new Set(excludeIds);
  let available = candidates.filter((m) => !excludeSet.has(m.id));
  // Pool épuisé (trop de propositions sauvegardées) — recycler le catalogue
  if (!available.length) available = candidates;
  return pickFilmsWithPosters(available, limit);
}

/** Tirage aléatoire — exclut les ids déjà proposés (likés ou passés). */
export async function buildOnboardingFilmDisplayPool(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
  excludeIds: number[] = [],
): Promise<Movie[]> {
  return fetchOnboardingFilmPage(favoriteGenres, excludedGenres, excludeIds, ONBOARDING_FILM_PAGE_SIZE);
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

/** Remplace un film dont l'affiche est absente ou en erreur — jamais déjà visible à l'écran. */
export function pickOnboardingFilmReplacement(
  pool: Movie[],
  visibleIds: Iterable<number>,
  failedId: number,
): Movie | null {
  const used = new Set(visibleIds);
  used.add(failedId);
  for (const movie of pool) {
    if (!used.has(movie.id) && hasMoviePoster(movie)) return movie;
  }
  return null;
}