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
  number_of_seasons?: number;
  number_of_episodes?: number;
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

// TV genre IDs differ from movie genre IDs on TMDB
const tvGenreNameToId: Record<string, number> = {
  "Action": 10759, "Aventure": 10759, "Animation": 16, "Comédie": 35, "Crime": 80,
  "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 10765,
  "Mystère": 9648, "Romance": 10749, "Science-Fiction": 10765, "Thriller": 53,
  "Guerre": 10768, "Western": 37, "Horreur": 9648,
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
  url.searchParams.set("region", "FR");
  url.searchParams.set("watch_region", "FR");
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

export async function getWatchProviders(id: number, mediaType: string): Promise<{ name: string; logo_path: string; provider_id: number; tmdb_link?: string }[]> {
  const endpoint = mediaType === "tv" ? `/tv/${id}/watch/providers` : `/movie/${id}/watch/providers`;
  const data = await fetchFromTMDB(endpoint);
  const fr = data.results?.FR;
  if (!fr) return [];
  // fr.link points to themoviedb.org, not the actual platform — don't use it
  const providers = fr.flatrate || [];
  return providers.map((p: any) => ({
    name: p.provider_name || p.name,
    logo_path: p.logo_path,
    provider_id: p.provider_id,
    tmdb_link: undefined,
  }));
}

export async function getSurpriseRecommendation(
  excludeIds: number[] = [],
  options: { platformIds?: number[]; minRating?: number; excludedGenres?: string[]; mediaType?: "movie" | "tv" | "both" } = {}
): Promise<MovieDetail> {
  // When "both", alternate randomly so the pool stays balanced
  const resolvedType: "movie" | "tv" =
    options.mediaType === "tv" ? "tv" :
    options.mediaType === "both" ? (Math.random() < 0.5 ? "movie" : "tv") :
    "movie";

  const isTV = resolvedType === "tv";
  const genreMap = isTV ? tvGenreNameToId : genreNameToId;
  const excluded = new Set(excludeIds);
  const excludedGenreIds = (options.excludedGenres || []).map(n => genreMap[n]).filter(Boolean);
  const minRating = options.minRating || 0;

  const discoverEndpoint = isTV ? "/discover/tv" : "/discover/movie";
  const topRatedEndpoint = isTV ? "/tv/top_rated" : "/movie/top_rated";
  const popularEndpoint = isTV ? "/tv/popular" : "/movie/popular";

  const isAllowed = (m: Movie) => {
    if (excluded.has(m.id)) return false;
    if (minRating > 0 && (m.vote_average || 0) < minRating) return false;
    if (excludedGenreIds.length > 0 && m.genre_ids?.some(gid => excludedGenreIds.includes(gid))) return false;
    return true;
  };

  // Try discover with filters for best results
  if (options.platformIds?.length || minRating > 0 || excludedGenreIds.length > 0) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const params: Record<string, string> = {
        sort_by: "vote_average.desc",
        "vote_count.gte": "200",
        page: String(Math.floor(Math.random() * 5) + 1),
      };
      if (minRating > 0) params["vote_average.gte"] = String(minRating);
      if (options.platformIds?.length) {
        params.with_watch_providers = options.platformIds.join("|");
        params.watch_region = "FR";
      }
      if (excludedGenreIds.length > 0) params.without_genres = excludedGenreIds.join(",");
      const data = await fetchFromTMDB(discoverEndpoint, params);
      const results: Movie[] = (data.results || []).filter(isAllowed);
      if (results.length > 0) {
        const pick = results[Math.floor(Math.random() * results.length)];
        return getMovieDetails(pick.id, resolvedType);
      }
    }
  }

  // Fallback to top_rated with client-side filtering
  for (let attempt = 0; attempt < 5; attempt++) {
    const page = Math.floor(Math.random() * 5) + 1;
    const data = await fetchFromTMDB(topRatedEndpoint, { page: String(page) });
    const results: Movie[] = (data.results || []).filter(isAllowed);
    if (results.length > 0) {
      const pick = results[Math.floor(Math.random() * results.length)];
      return getMovieDetails(pick.id, resolvedType);
    }
  }

  const fallbackData = await fetchFromTMDB(popularEndpoint, { page: "1" });
  const fallbackResults: Movie[] = (fallbackData.results || []).filter(isAllowed);
  const fallbackPick = fallbackResults[0] || (fallbackData.results || [])[0];
  if (!fallbackPick) throw new Error("No recommendation available");
  return getMovieDetails(fallbackPick.id, resolvedType);
}

export async function getTrendingMovie(): Promise<MovieDetail> {
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  const pick = results[Math.floor(Math.random() * Math.min(5, results.length))];
  return getMovieDetails(pick.id, "movie");
}

export async function getTrendingMovies(
  count: number = 10,
  platformIds: number[] = [],
  favoriteGenres: string[] = [],
  options: { minRating?: number; excludedGenres?: string[] } = {}
): Promise<Movie[]> {
  const excludedGenreIds = (options.excludedGenres || []).map(n => genreNameToId[n]).filter(Boolean);
  if (platformIds.length > 0 || favoriteGenres.length > 0 || (options.minRating && options.minRating > 0) || excludedGenreIds.length > 0) {
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
    if (options.minRating && options.minRating > 0) {
      params["vote_average.gte"] = String(options.minRating);
    }
    if (excludedGenreIds.length > 0) {
      params.without_genres = excludedGenreIds.join(",");
    }
    const data = await fetchFromTMDB("/discover/movie", params);
    const results: Movie[] = data.results || [];
    return results.slice(0, count);
  }
  const data = await fetchFromTMDB("/trending/movie/day");
  const results: Movie[] = data.results || [];
  return results.slice(0, count);
}

export async function getHiddenGems(
  count: number = 10,
  platformIds: number[] = [],
  favoriteGenres: string[] = [],
  options: { minRating?: number; excludedGenres?: string[] } = {}
): Promise<Movie[]> {
  const page = Math.floor(Math.random() * 3) + 1;
  const excludedGenreIds = (options.excludedGenres || []).map(n => genreNameToId[n]).filter(Boolean);
  const minRating = Math.max(options.minRating || 0, 7.5);
  const params: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_average.gte": String(minRating),
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
  if (excludedGenreIds.length > 0) {
    params.without_genres = excludedGenreIds.join(",");
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

// Get popular movies AND TV shows for onboarding grid
export async function getPopularMoviesForOnboarding(page: number = 1): Promise<Movie[]> {
  // Fetch independently so one failure doesn't kill both
  const [movieData, tvData] = await Promise.allSettled([
    fetchFromTMDB("/movie/popular", { page: String(page) }),
    fetchFromTMDB("/tv/popular", { page: String(page) }),
  ]);
  const movieResults = movieData.status === "fulfilled" ? (movieData.value.results || []) : [];
  const tvResults = tvData.status === "fulfilled" ? (tvData.value.results || []) : [];
  const movies: Movie[] = movieResults.map((m: any) => ({ ...m, media_type: "movie" }));
  const tvShows: Movie[] = tvResults.map((m: any) => ({ ...m, media_type: "tv", title: m.name || m.title }));
  // Interleave movies and TV shows
  const combined: Movie[] = [];
  const maxLen = Math.max(movies.length, tvShows.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < movies.length && movies[i].poster_path) combined.push(movies[i]);
    if (i < tvShows.length && tvShows[i].poster_path) combined.push(tvShows[i]);
  }
  return combined;
}

// Search movies AND TV shows for onboarding
export async function searchMovies(query: string): Promise<Movie[]> {
  if (!query.trim()) return [];
  const data = await fetchFromTMDB("/search/multi", { query });
  return (data.results || [])
    .filter((m: any) => (m.media_type === "movie" || m.media_type === "tv") && m.poster_path)
    .map((m: any) => ({ ...m, media_type: m.media_type }));
}

// New: get tonight's pick (single trending movie with details)
export async function getTonightsPick(
  platformIds: number[] = [],
  favoriteGenres: string[] = [],
  options: { minRating?: number; excludedGenres?: string[] } = {}
): Promise<MovieDetail> {
  const excludedGenreIds = (options.excludedGenres || []).map(n => genreNameToId[n]).filter(Boolean);
  let results: Movie[];
  if (platformIds.length > 0 || favoriteGenres.length > 0 || (options.minRating && options.minRating > 0) || excludedGenreIds.length > 0) {
    const params: Record<string, string> = {
      sort_by: "popularity.desc",
      "vote_count.gte": "100",
      "vote_average.gte": String(Math.max(options.minRating || 0, 6.5)),
    };
    if (platformIds.length > 0) {
      params.with_watch_providers = platformIds.join("|");
      params.watch_region = "FR";
    }
    if (favoriteGenres.length > 0) {
      params.with_genres = genreNamesToIds(favoriteGenres).join("|");
    }
    if (excludedGenreIds.length > 0) {
      params.without_genres = excludedGenreIds.join(",");
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

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface MovieCredits {
  cast: CastMember[];
  director: CrewMember | null;
}

export async function getMovieCredits(id: number, mediaType: string): Promise<MovieCredits> {
  const endpoint = mediaType === "tv" ? `/tv/${id}/credits` : `/movie/${id}/credits`;
  const data = await fetchFromTMDB(endpoint);
  const cast: CastMember[] = (data.cast || []).slice(0, 6).map((c: any) => ({
    id: c.id,
    name: c.name,
    character: c.character || c.roles?.[0]?.character || "",
    profile_path: c.profile_path,
    order: c.order ?? 999,
  }));
  const director = (data.crew || []).find((c: any) => c.job === "Director") || null;
  return { cast, director };
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  knownFor: { id: number; title: string; year: string; poster_path: string | null; backdrop_path: string | null; media_type: string }[];
}

export async function getPersonDetails(personId: number): Promise<PersonDetails> {
  const [person, credits] = await Promise.all([
    fetchFromTMDB(`/person/${personId}`, { language: "fr-FR" }),
    fetchFromTMDB(`/person/${personId}/combined_credits`, { language: "fr-FR" }),
  ]);

  const allCredits = (credits.cast || [])
    .filter((c: any) => c.poster_path && (c.vote_count || 0) > 50)
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 6)
    .map((c: any) => ({
      id: c.id,
      title: c.title || c.name || "",
      year: (c.release_date || c.first_air_date || "").slice(0, 4),
      poster_path: c.poster_path,
      backdrop_path: c.backdrop_path || null,
      media_type: c.media_type || "movie",
    }));

  return {
    id: person.id,
    name: person.name,
    biography: person.biography || "",
    birthday: person.birthday,
    place_of_birth: person.place_of_birth,
    profile_path: person.profile_path,
    known_for_department: person.known_for_department || "Acting",
    knownFor: allCredits,
  };
}

export { getDisplayTitle, getYear, getPosterUrl, getBackdropUrl, getMovieDetails };
