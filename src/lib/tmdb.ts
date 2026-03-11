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
): Promise<MovieDetail[]> {
  const moodGenres = moodToGenres[mood];
  const contextGenres = contextModifiers[context];
  
  const combined = moodGenres.filter(g => contextGenres.includes(g));
  const genres = combined.length > 0 ? combined : moodGenres.slice(0, 2);
  
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
      with_genres: genres.join(","),
      sort_by: "popularity.desc",
      "vote_average.gte": "6",
      "vote_count.gte": "100",
      page: String(Math.floor(Math.random() * 3) + 1),
    };

    if (!isTV && time === "short") {
      params["with_runtime.lte"] = "90";
    }

    if (platformIds.length > 0) {
      params["with_watch_providers"] = platformIds.join("|");
      params["watch_region"] = "FR";
    }

    try {
      const data = await fetchFromTMDB(endpoint, params);
      const results: Movie[] = data.results || [];
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

export async function getSurpriseRecommendation(): Promise<MovieDetail> {
  const page = Math.floor(Math.random() * 5) + 1;
  const data = await fetchFromTMDB("/movie/top_rated", { page: String(page) });
  const results: Movie[] = data.results || [];
  const pick = results[Math.floor(Math.random() * results.length)];
  return getMovieDetails(pick.id, "movie");
}

export async function getTrendingMovie(): Promise<MovieDetail> {
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  const pick = results[Math.floor(Math.random() * Math.min(5, results.length))];
  return getMovieDetails(pick.id, "movie");
}

export async function getTrendingMovies(count: number = 10): Promise<Movie[]> {
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  return results.slice(0, count);
}

export async function getHiddenGems(count: number = 10): Promise<Movie[]> {
  const page = Math.floor(Math.random() * 3) + 1;
  const data = await fetchFromTMDB("/discover/movie", {
    sort_by: "vote_average.desc",
    "vote_average.gte": "7.5",
    "vote_count.gte": "200",
    "vote_count.lte": "2000",
    "with_runtime.gte": "70",
    page: String(page),
  });
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
export async function getTonightsPick(): Promise<MovieDetail> {
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  // Use a seed based on date for consistent daily pick
  const today = new Date().toDateString();
  const seed = today.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = seed % Math.min(5, results.length);
  return getMovieDetails(results[idx].id, "movie");
}

export { getDisplayTitle, getYear, getPosterUrl, getBackdropUrl, getMovieDetails };
