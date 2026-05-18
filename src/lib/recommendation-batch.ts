import type { MovieDetail } from "@/lib/tmdb";
import { getSurpriseRecommendation, getWatchProviders } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeUserTasteVector } from "@/lib/taste-engine";

export const RECOMMENDATION_BATCH_SIZE = 5;

export type WatchProviderSummary = {
  name: string;
  logo_path: string;
  provider_id: number;
  tmdb_link?: string;
};

export type RecommendationMatchData = {
  matchScore?: number;
  score?: number;
  headline?: string;
  whyItMatches?: string;
  detailedExplanation?: string;
  emotionalJourney?: string;
  perfectFor?: string;
  funFact?: string;
  summary?: string;
  reasons?: string[];
  tone?: string;
  matchingReasons?: string[];
  pickNote?: string | null;
};

export type RecommendationMovieDetail = MovieDetail & {
  recommendationTexts?: RecommendationMatchData | null;
  watchProviders?: WatchProviderSummary[];
};

type RecommendationBatchOptions = {
  excludeIds?: number[];
  platformIds?: number[];
  minRating?: number;
  excludedGenres?: string[];
  size?: number;
  searchTags?: string[];
  userCriteria?: {
    mood: string | null;
    context: string | null;
    time: string | null;
  };
  preloadMatchTexts?: boolean;
  preloadProviders?: boolean;
  minMatchScore?: number;
};

const extractInlineRecommendationTexts = (entry: any): RecommendationMatchData | null => {
  if (!entry || typeof entry !== "object") return null;

  const direct = entry.recommendationTexts || entry.matchData || entry.match_data || null;
  if (direct) return direct as RecommendationMatchData;

  const candidate: RecommendationMatchData = {
    matchScore: entry.matchScore,
    score: entry.score,
    headline: entry.headline,
    whyItMatches: entry.whyItMatches,
    detailedExplanation: entry.detailedExplanation,
    emotionalJourney: entry.emotionalJourney,
    perfectFor: entry.perfectFor,
    funFact: entry.funFact,
    summary: entry.summary,
    reasons: entry.reasons,
    tone: entry.tone,
    matchingReasons: entry.matchingReasons,
    pickNote: entry.pickNote,
  };

  return Object.values(candidate).some((value) => value != null) ? candidate : null;
};

const dedupeMovies = (movies: RecommendationMovieDetail[]) => {
  const seen = new Set<number>();
  return movies.filter((movie) => {
    if (!movie?.id || seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
};

export const extractRecommendationMovies = (payload: any): RecommendationMovieDetail[] => {
  if (!payload) return [];

  const moviesFromArray = Array.isArray(payload.movies)
    ? payload.movies
        .map((entry: any) => {
          const movie = entry?.movie ? entry.movie : entry;
          if (!movie) return null;
          const recommendationTexts = extractInlineRecommendationTexts(entry);
          return recommendationTexts ? { ...movie, recommendationTexts } : movie;
        })
        .filter(Boolean)
    : [];

  const recommendationTexts = extractInlineRecommendationTexts(payload);
  const movies = payload.movie
    ? [...moviesFromArray, recommendationTexts ? { ...payload.movie, recommendationTexts } : payload.movie]
    : moviesFromArray;

  return dedupeMovies(movies as RecommendationMovieDetail[]);
};

async function buildMatchContext(options: RecommendationBatchOptions) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  const [tasteProfile, userTasteVector, likedMovies, cinematicProfile, vectorData] = await Promise.all([
    getUserTasteProfile().catch(() => null),
    user ? computeUserTasteVector(user.id).catch(() => null) : Promise.resolve(null),
    user ? getLikedMovies().catch(() => []) : Promise.resolve([]),
    user
      ? supabase
          .from("cinematic_profiles" as any)
          .select("personality_title, narrative, taste_traits")
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    user
      ? supabase
          .from("user_taste_vectors" as any)
          .select("avoidance_vector, recent_taste_vector")
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const enrichedProfile = tasteProfile
    ? {
        ...tasteProfile,
        recentTasteVector: (vectorData as any)?.recent_taste_vector || null,
        avoidanceVector: (vectorData as any)?.avoidance_vector || null,
      }
    : null;

  return {
    user,
    userCriteria: options.userCriteria ?? { mood: null, context: null, time: null },
    searchTags: options.searchTags ?? [],
    userTasteVector,
    likedMovieTitles: (likedMovies || []).map((m: any) => m.title),
    tasteProfile: enrichedProfile,
    cinematicProfile,
    peoplePreferences: tasteProfile?.peoplePreferences || null,
  };
}

async function fetchRecommendationTextsForMovie(
  movie: RecommendationMovieDetail,
  context: Awaited<ReturnType<typeof buildMatchContext>>,
): Promise<RecommendationMatchData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("movie-match", {
      body: {
        movie,
        userCriteria: context.userCriteria,
        tasteProfile: context.tasteProfile,
        userTasteVector: context.userTasteVector,
        likedMovieTitles: context.likedMovieTitles,
        searchTags: context.searchTags,
        cinematicProfile: context.cinematicProfile,
        peoplePreferences: context.peoplePreferences,
        userName: context.user?.user_metadata?.display_name || context.user?.email?.split("@")[0] || null,
      },
    });

    if (error) {
      console.error("movie-match preload error:", error);
      return null;
    }

    return (data as RecommendationMatchData) ?? null;
  } catch (error) {
    console.error("fetchRecommendationTextsForMovie failed:", error);
    return null;
  }
}

export async function enrichRecommendationBatchWithTexts(
  movies: RecommendationMovieDetail[],
  options: RecommendationBatchOptions = {},
): Promise<RecommendationMovieDetail[]> {
  const moviesNeedingTexts = movies.filter((movie) => !movie.recommendationTexts);
  if (!moviesNeedingTexts.length) return movies;

  const context = await buildMatchContext(options);
  const generated = await Promise.all(
    moviesNeedingTexts.map(async (movie) => ({
      id: movie.id,
      recommendationTexts: await fetchRecommendationTextsForMovie(movie, context),
    })),
  );

  const byId = new Map<number, RecommendationMatchData | null>(
    generated.map((entry) => [entry.id, entry.recommendationTexts]),
  );

  return movies.map((movie) => {
    if (movie.recommendationTexts) return movie;
    const recommendationTexts = byId.get(movie.id) ?? null;
    return recommendationTexts ? { ...movie, recommendationTexts } : movie;
  });
}

export async function enrichRecommendationBatchWithProviders(
  movies: RecommendationMovieDetail[],
): Promise<RecommendationMovieDetail[]> {
  const needs = movies.filter((m) => !m.watchProviders);
  if (!needs.length) return movies;

  const results = await Promise.all(
    needs.map(async (m) => {
      const mediaType = m.first_air_date ? "tv" : "movie";
      try {
        const providers = await getWatchProviders(m.id, mediaType);
        return { id: m.id, providers: providers as WatchProviderSummary[] };
      } catch {
        return { id: m.id, providers: [] as WatchProviderSummary[] };
      }
    }),
  );

  const byId = new Map<number, WatchProviderSummary[]>(results.map((r) => [r.id, r.providers]));
  return movies.map((m) => (m.watchProviders ? m : { ...m, watchProviders: byId.get(m.id) ?? [] }));
}

export async function ensureRecommendationBatch(
  initialMovies: RecommendationMovieDetail[],
  options: RecommendationBatchOptions = {},
): Promise<RecommendationMovieDetail[]> {
  const size = options.size ?? RECOMMENDATION_BATCH_SIZE;
  const batch = dedupeMovies(initialMovies);
  const usedIds = new Set<number>([...(options.excludeIds ?? []), ...batch.map((movie) => movie.id)]);

  let attempts = 0;
  while (batch.length < size && attempts < size * 6) {
    attempts += 1;

    try {
      const movie = await getSurpriseRecommendation(Array.from(usedIds), {
        platformIds: options.platformIds,
        minRating: options.minRating,
        excludedGenres: options.excludedGenres,
      });

      if (!movie?.id || usedIds.has(movie.id)) continue;

      usedIds.add(movie.id);
      batch.push(movie as RecommendationMovieDetail);
    } catch (error) {
      console.error("ensureRecommendationBatch fallback fetch failed:", error);
      break;
    }
  }

  let finalBatch = dedupeMovies(batch).slice(0, size);

  if (options.preloadMatchTexts) {
    finalBatch = await enrichRecommendationBatchWithTexts(finalBatch, options);
  }

  if (options.preloadProviders) {
    finalBatch = await enrichRecommendationBatchWithProviders(finalBatch);
  }

  return finalBatch;
}

