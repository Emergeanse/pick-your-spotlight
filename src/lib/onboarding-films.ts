import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import type { Movie } from "@/lib/tmdb";

export const ONBOARDING_FILM_TARGET = 10;

/** Films français très connus du grand public (TMDB movie id) */
export const CURATED_FR_TMDB_IDS = [
  77338,  // Intouchables
  9919,   // Le Fabuleux Destin d'Amélie Poulain
  82676,  // Bienvenue chez les Ch'tis
  10376,  // Les Choristes
  406,    // La Haine
  8290,   // La Grande Vadrouille
  10649,  // Le Dîner de cons
  7345,   // Un prophète
  9603,   // Astérix & Obélix : Mission Cléopâtre
  9423,   // Les Visiteurs
  9746,   // OSS 117
  140078, // Le Prénom
  11051,  // Le Pacte des loups
  11653,  // L'Auberge espagnole
  11645,  // Les Triplettes de Belleville
];

/** Blockbusters et classiques US très connus */
export const CURATED_EN_TMDB_IDS = [
  27205,  // Inception
  155,    // The Dark Knight
  13,     // Forrest Gump
  680,    // Pulp Fiction
  603,    // The Matrix
  278,    // The Shawshank Redemption
  157336, // Interstellar
  597,    // Titanic
  19995,  // Avatar
  550,    // Fight Club
  105,    // Back to the Future
  671,    // Harry Potter
  122,    // Le Seigneur des anneaux (forte notoriété FR aussi)
  11,     // Star Wars
  329,    // Jurassic Park
  98,     // Gladiator
  76341,  // Mad Max Fury Road
  299534, // Avengers: Endgame
];

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

async function fetchDiscoverWellKnown(
  lang: "fr" | "en",
  page: number,
  genreIds?: number[],
): Promise<Movie[]> {
  const params: Record<string, string> = {
    sort_by: "vote_count.desc",
    "vote_count.gte": lang === "fr" ? "350" : "900",
    "vote_average.gte": "6.8",
    with_original_language: lang,
    page: String(page),
  };
  if (genreIds?.length) params.with_genres = genreIds.slice(0, 2).join(",");
  const data = await fetchFromTMDB("/discover/movie", params);
  return (data.results || []) as Movie[];
}

async function fetchCuratedByIds(ids: number[]): Promise<Movie[]> {
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

function shuffleStable<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function movieOriginLang(movie: Movie, frIds: Set<number>, enIds: Set<number>): "fr" | "en" {
  if (frIds.has(movie.id)) return "fr";
  if (enIds.has(movie.id)) return "en";
  const lang = (movie as Movie & { original_language?: string }).original_language;
  return lang === "fr" ? "fr" : "en";
}

/**
 * Pool initiation : alternance cinéma FR / US, titres très connus,
 * filtrés par genres aimés / exclus.
 */
export async function buildOnboardingFilmPool(
  favoriteGenres: string[] = [],
  excludedGenres: string[] = [],
): Promise<Movie[]> {
  const likedIds = genreNamesToIds(favoriteGenres);
  const excludedIds = genreNamesToIds(excludedGenres);
  const frIdSet = new Set(CURATED_FR_TMDB_IDS);
  const enIdSet = new Set(CURATED_EN_TMDB_IDS);

  const [curatedFr, curatedEn, discFr, discEn] = await Promise.all([
    fetchCuratedByIds(CURATED_FR_TMDB_IDS),
    fetchCuratedByIds(CURATED_EN_TMDB_IDS),
    fetchDiscoverWellKnown("fr", 1, likedIds).catch(() => [] as Movie[]),
    fetchDiscoverWellKnown("en", 1, likedIds).catch(() => [] as Movie[]),
  ]);

  const seen = new Set<number>();
  const candidates: Movie[] = [];

  const add = (list: Movie[]) => {
    for (const m of list) {
      if (!m?.id || !m.poster_path || seen.has(m.id)) continue;
      if (hasExcludedGenre(m, excludedIds)) continue;
      seen.add(m.id);
      candidates.push(m);
    }
  };

  add(curatedFr);
  add(curatedEn);
  add(discFr);
  add(discEn);

  candidates.sort((a, b) => {
    const diff = genreMatchScore(b, likedIds) - genreMatchScore(a, likedIds);
    if (diff !== 0) return diff;
    return (b.vote_average ?? 0) - (a.vote_average ?? 0);
  });

  const frSorted = candidates.filter((m) => movieOriginLang(m, frIdSet, enIdSet) === "fr");
  const enSorted = candidates.filter((m) => movieOriginLang(m, frIdSet, enIdSet) === "en");

  const interleaved = interleaveFrEn(shuffleStable(frSorted), shuffleStable(enSorted));

  return interleaved.slice(0, 40);
}
