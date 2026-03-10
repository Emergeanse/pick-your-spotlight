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
  time: TimeAvailable
): Promise<MovieDetail[]> {
  const moodGenres = moodToGenres[mood];
  const contextGenres = contextModifiers[context];
  
  // Find overlapping genres or combine
  const combined = moodGenres.filter(g => contextGenres.includes(g));
  const genres = combined.length > 0 ? combined : moodGenres.slice(0, 2);
  
  const isTV = time === "episode";
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

  const data = await fetchFromTMDB(endpoint, params);
  const results: Movie[] = data.results || [];
  
  // Pick 3 random from top 10
  const top = results.slice(0, 10);
  const shuffled = top.sort(() => Math.random() - 0.5).slice(0, 3);
  
  const details = await Promise.all(
    shuffled.map(m => getMovieDetails(m.id, isTV ? "tv" : "movie"))
  );
  
  return details;
}

export async function getSurpriseRecommendation(): Promise<MovieDetail> {
  const page = Math.floor(Math.random() * 5) + 1;
  const data = await fetchFromTMDB("/movie/top_rated", { page: String(page) });
  const results: Movie[] = data.results || [];
  const pick = results[Math.floor(Math.random() * results.length)];
  return getMovieDetails(pick.id, "movie");
}

export { getDisplayTitle, getYear, getPosterUrl, getBackdropUrl };
