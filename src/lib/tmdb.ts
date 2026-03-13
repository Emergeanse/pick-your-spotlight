const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

export interface Movie {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  runtime?: number;
  episode_run_time?: number[];
  genre_ids: number[];
  media_type?: string;
}

export interface MovieDetail extends Movie {
  runtime: number;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
}

export type Mood = "relax" | "excited" | "romantic" | "mind-blowing" | "easy-watch" | "fun";
export type Context = "alone" | "couple" | "friends" | "family";
export type TimeAvailable = "short" | "movie-night" | "episode";

const genreNameToId: Record<string, number> = {
  "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
  "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
  "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
  "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
};

function genreNamesToIds(names: string[]): number[] {
  return names.map(n => genreNameToId[n]).filter(Boolean);
}

const moodToGenres: Record<Mood, number[]> = {
  "relax": [18, 10749, 99],
  "excited": [28, 53, 878],
  "romantic": [10749, 35, 18],
  "mind-blowing": [878, 9648, 53],
  "easy-watch": [35, 16, 10751],
  "fun": [35, 12, 16],
};

const contextModifiers: Record<Context, number[]> = {
  "alone": [53, 27, 18, 878],
  "couple": [10749, 35, 18],
  "friends": [35, 28, 12],
  "family": [10751, 16, 12, 14],
};

function getDisplayTitle(movie: Movie): string {
  return movie.title || movie.name || "Sans titre";
}

function getYear(movie: Movie): string {
  const date = movie.release_date || movie.first_air_date;
  return date ? date.substring(0, 4) : "";
}

function getPosterUrl(path: string | null, size: string = "w500"): string {
  if (!path) return "/placeholder.svg";
  return `${IMG_BASE}/${size}${path}`;
}

function getBackdropUrl(path: string | null): string {
  if (!path) return "";
  return `${IMG_BASE}/original${path}`;
}

async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "fr-FR");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB Error: ${res.status}`);
  return res.json();
}

async function getMovieDetails(id: number, mediaType: string): Promise<MovieDetail> {
  const endpoint = mediaType === "tv" ? `/tv/${id}` : `/movie/${id}`;
  return fetchFromTMDB(endpoint);
}

export async function getRecommendations(
  mood: Mood,
  context: Context,
  time: TimeAvailable,
  platformIds: number[] = [],
  excludeIds: number[] = [],
  options: { excludedGenres?: string[]; minRating?: number; excludedPlatformIds?: number[]; rejectionContext?: { reason: string; rejectedGenres: string[]; rejectedTitle: string; rejectedRating: number; rejectedRuntime: number } } = {},
): Promise<MovieDetail[]> {
  const moodGenres = moodToGenres[mood];
  const contextGenres = contextModifiers[context];
  
  const combined = moodGenres.filter(g => contextGenres.includes(g));
  let genres = combined.length > 0 ? combined : moodGenres.slice(0, 2);

  // Build excluded genre IDs
  const excludedGenreIds = (options.excludedGenres || []).map(n => genreNameToId[n]).filter(Boolean);

  // If rejected for "not_my_style", also exclude the rejected movie's genres for this search
  if (options.rejectionContext?.reason === "not_my_style") {
    const rejectedGenreIds = options.rejectionContext.rejectedGenres.map(n => genreNameToId[n]).filter(Boolean);
    excludedGenreIds.push(...rejectedGenreIds);
    // Try to pick different genres from mood/context that weren't in the rejected movie
    const alternativeGenres = [...moodGenres, ...contextGenres].filter(g => !rejectedGenreIds.includes(g) && !excludedGenreIds.includes(g));
    if (alternativeGenres.length > 0) {
      genres = [...new Set(alternativeGenres)].slice(0, 3);
    }
  }

  // If rejected for "too_long", prefer shorter content
  const maxRuntime = options.rejectionContext?.reason === "too_long" ? "100" : undefined;

  // Filter out excluded genres from selection
  const filteredGenres = genres.filter(g => !excludedGenreIds.includes(g));
  const finalGenres = filteredGenres.length > 0 ? filteredGenres : genres;
  
  const searchTypes: string[] = [];
  if (time === "episode") {
    searchTypes.push("tv");
  } else {
    searchTypes.push("movie");
    searchTypes.push("tv");
  }

  const allDetails: MovieDetail[] = [];

  for (const type of searchTypes) {
    const isTV = type === "tv";
    const endpoint = isTV ? "/discover/tv" : "/discover/movie";
    
    const params: Record<string, string> = {
      with_genres: finalGenres.join(","),
      sort_by: "popularity.desc",
      "vote_average.gte": String(Math.max(options.minRating || 0, 6)),
      "vote_count.gte": "100",
      page: String(Math.floor(Math.random() * 3) + 1),
    };

    if (!isTV && (time === "short" || maxRuntime)) {
      params["with_runtime.lte"] = maxRuntime || "90";
    }

    if (platformIds.length > 0) {
      params["with_watch_providers"] = platformIds.join("|");
      params["watch_region"] = "FR";
    }

    if (excludedGenreIds.length > 0) {
      params["without_genres"] = excludedGenreIds.join(",");
    }

    try {
      const data = await fetchFromTMDB(endpoint, params);
      const results: Movie[] = (data.results || []).filter((m: Movie) => !excludeIds.includes(m.id));
      const top = results.slice(0, 10);
      const shuffled = top.sort(() => Math.random() - 0.5).slice(0, 2);
      
      const details = await Promise.all(
        shuffled.map(m => getMovieDetails(m.id, isTV ? "tv" : "movie"))
      );
      allDetails.push(...details);
    } catch (e) {
      console.error(`Error fetching ${type}:`, e);
    }
  }

  return allDetails.sort(() => Math.random() - 0.5).slice(0, 3);
}

export async function getWatchProviders(id: number, mediaType: string): Promise<{ name: string; logo_path: string }[]> {
  const endpoint = mediaType === "tv" ? `/tv/${id}/watch/providers` : `/movie/${id}/watch/providers`;
  const data = await fetchFromTMDB(endpoint);
  const fr = data.results?.FR;
  if (!fr) return [];
  return fr.flatrate || [];
}

export async function getSurpriseRecommendation(excludeIds: number[] = []): Promise<MovieDetail> {
  const excluded = new Set(excludeIds);

  for (let attempt = 0; attempt < 5; attempt++) {
    const page = Math.floor(Math.random() * 5) + 1;
    const data = await fetchFromTMDB("/movie/top_rated", { page: String(page) });
    const results: Movie[] = (data.results || []).filter((m: Movie) => !excluded.has(m.id));

    if (results.length > 0) {
      const pick = results[Math.floor(Math.random() * results.length)];
      return getMovieDetails(pick.id, "movie");
    }
  }

  const fallbackData = await fetchFromTMDB("/movie/popular", { page: "1" });
  const fallbackResults: Movie[] = (fallbackData.results || []).filter((m: Movie) => !excluded.has(m.id));
  const fallbackPick = fallbackResults[0] || (fallbackData.results || [])[0];

  if (!fallbackPick) {
    throw new Error("No movie available for surprise recommendation");
  }

  return getMovieDetails(fallbackPick.id, "movie");
}

export async function getTrendingMovie(): Promise<MovieDetail> {
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  const pick = results[Math.floor(Math.random() * Math.min(5, results.length))];
  return getMovieDetails(pick.id, "movie");
}

export async function getTrendingMovies(count: number = 10, platformIds: number[] = [], favoriteGenres: string[] = []): Promise<Movie[]> {
  if (platformIds.length > 0 || favoriteGenres.length > 0) {
    const params: Record<string, string> = {
      sort_by: "popularity.desc",
      "vote_count.gte": "100",
    };
    if (platformIds.length > 0) {
      params.with_watch_providers = platformIds.join("|");
      params.watch_region = "FR";
    }
    if (favoriteGenres.length > 0) {
      params.with_genres = genreNamesToIds(favoriteGenres).join("|");
    }
    const data = await fetchFromTMDB("/discover/movie", params);
    const results: Movie[] = data.results || [];
    return results.slice(0, count);
  }
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  return results.slice(0, count);
}

export async function getHiddenGems(count: number = 10, platformIds: number[] = [], favoriteGenres: string[] = []): Promise<Movie[]> {
  const page = Math.floor(Math.random() * 3) + 1;
  const params: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_average.gte": "7.5",
    "vote_count.gte": "200",
    "vote_count.lte": "2000",
    "with_runtime.gte": "70",
    page: String(page),
  };
  if (platformIds.length > 0) {
    params.with_watch_providers = platformIds.join("|");
    params.watch_region = "FR";
  }
  if (favoriteGenres.length > 0) {
    params.with_genres = genreNamesToIds(favoriteGenres).join("|");
  }
  const data = await fetchFromTMDB("/discover/movie", params);
  const results: Movie[] = data.results || [];
  return results.sort(() => Math.random() - 0.5).slice(0, count);
}

export async function getMovieTrailerUrl(id: number, mediaType: string = "movie"): Promise<string | null> {
  const endpoint = mediaType === "tv" ? `/tv/${id}/videos` : `/movie/${id}/videos`;
  try {
    const data = await fetchFromTMDB(endpoint, { language: "fr-FR" });
    let trailer = (data.results || []).find(
      (v: any) => v.type === "Trailer" && v.site === "YouTube"
    );
    if (!trailer) {
      const dataEn = await fetchFromTMDB(endpoint, { language: "en-US" });
      trailer = (dataEn.results || []).find(
        (v: any) => v.type === "Trailer" && v.site === "YouTube"
      );
    }
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
  } catch {
    return null;
  }
}

// New: get popular movies for onboarding grid
export async function getPopularMoviesForOnboarding(page: number = 1): Promise<Movie[]> {
  const data = await fetchFromTMDB("/movie/popular", { page: String(page) });
  return (data.results || []).filter((m: Movie) => m.poster_path);
}

// New: search movies for onboarding
export async function searchMovies(query: string): Promise<Movie[]> {
  if (!query.trim()) return [];
  const data = await fetchFromTMDB("/search/movie", { query });
  return (data.results || []).filter((m: Movie) => m.poster_path);
}

// New: get tonight's pick (single trending movie with details)
export async function getTonightsPick(platformIds: number[] = [], favoriteGenres: string[] = []): Promise<MovieDetail> {
  let results: Movie[];
  if (platformIds.length > 0 || favoriteGenres.length > 0) {
    const params: Record<string, string> = {
      sort_by: "popularity.desc",
      "vote_count.gte": "100",
      "vote_average.gte": "6.5",
    };
    if (platformIds.length > 0) {
      params.with_watch_providers = platformIds.join("|");
      params.watch_region = "FR";
    }
    if (favoriteGenres.length > 0) {
      params.with_genres = genreNamesToIds(favoriteGenres).join("|");
    }
    const data = await fetchFromTMDB("/discover/movie", params);
    results = data.results || [];
  } else {
    const data = await fetchFromTMDB("/trending/movie/day");
    results = data.results || [];
  }
  const today = new Date().toDateString();
  const seed = today.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = seed % Math.min(5, results.length);
  return getMovieDetails(results[idx].id, "movie");
}

export { getDisplayTitle, getYear, getPosterUrl, getBackdropUrl, getMovieDetails };
