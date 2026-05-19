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
  confidence?: number;
  headline?: string;
  whyItMatches?: string;
  detailedExplanation?: string;
  emotionalJourney?: string;
  perfectFor?: string;
  funFact?: string;
  summary?: string;
  reason?: string;
  reasons?: string[];
  tone?: string;
  matchingReasons?: string[];
  pickNote?: string | null;
};

const normalizeRecommendationTexts = (data: RecommendationMatchData): RecommendationMatchData => {
  const score = data.matchScore ?? data.score ?? data.confidence;
  const reason = data.summary ?? data.detailedExplanation ?? data.whyItMatches ?? data.reason ?? data.pickNote ?? null;

  return {
    ...data,
    matchScore: score,
    score,
    confidence: data.confidence ?? score ?? undefined,
    whyItMatches: data.whyItMatches ?? data.reason,
    summary: data.summary ?? reason ?? undefined,
    pickNote: data.pickNote ?? reason,
  };
};

const hasRecommendationScore = (data: RecommendationMatchData | null | undefined) =>
  data?.matchScore != null || data?.score != null || data?.confidence != null;

const getRecommendationScore = (data: RecommendationMatchData | null | undefined) =>
  data?.matchScore ?? data?.score ?? data?.confidence ?? null;

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
  forceRescore?: boolean;
};

const extractInlineRecommendationTexts = (entry: any): RecommendationMatchData | null => {
  if (!entry || typeof entry !== "object") return null;

  const direct = entry.recommendationTexts || entry.matchData || entry.match_data || null;
  if (direct) return normalizeRecommendationTexts(direct as RecommendationMatchData);

  const candidate: RecommendationMatchData = {
    matchScore: entry.matchScore ?? entry.confidence,
    score: entry.score ?? entry.confidence,
    confidence: entry.confidence,
    headline: entry.headline,
    whyItMatches: entry.whyItMatches ?? entry.reason,
    detailedExplanation: entry.detailedExplanation,
    emotionalJourney: entry.emotionalJourney,
    perfectFor: entry.perfectFor,
    funFact: entry.funFact,
    summary: entry.summary ?? entry.reason,
    reason: entry.reason,
    reasons: entry.reasons,
    tone: entry.tone,
    matchingReasons: entry.matchingReasons,
    pickNote: entry.pickNote ?? entry.reason,
  };

  return Object.values(candidate).some((value) => value != null) ? normalizeRecommendationTexts(candidate) : null;
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
  options: RecommendationBatchOptions = {},
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
        minMatchScore: options.minMatchScore ?? 80,
      },
    });

    if (error) {
      console.error("movie-match preload error:", error);
      return null;
    }

    return data ? normalizeRecommendationTexts(data as RecommendationMatchData) : null;
  } catch (error) {
    console.error("fetchRecommendationTextsForMovie failed:", error);
    return null;
  }
}

export async function enrichRecommendationBatchWithTexts(
  movies: RecommendationMovieDetail[],
  options: RecommendationBatchOptions = {},
): Promise<RecommendationMovieDetail[]> {
  const forceRescore = options.forceRescore ?? false;
  const moviesNeedingTexts = forceRescore
    ? movies
    : movies.filter((movie) => !hasRecommendationScore(movie.recommendationTexts));
  if (!moviesNeedingTexts.length) return movies;

  const context = await buildMatchContext(options);
  const generated = await Promise.all(
    moviesNeedingTexts.map(async (movie) => ({
      id: movie.id,
      recommendationTexts: await fetchRecommendationTextsForMovie(movie, context, options),
    })),
  );

  const byId = new Map<number, RecommendationMatchData | null>(
    generated.map((entry) => [entry.id, entry.recommendationTexts]),
  );

  return movies.map((movie) => {
    if (!forceRescore && hasRecommendationScore(movie.recommendationTexts)) return movie;
    const recommendationTexts = byId.get(movie.id) ?? (forceRescore ? movie.recommendationTexts : null) ?? null;
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
    const shouldForceRescore = (options.minMatchScore ?? 0) > 0;
    finalBatch = await enrichRecommendationBatchWithTexts(finalBatch, { ...options, forceRescore: shouldForceRescore });
  }

  if (options.preloadProviders) {
    finalBatch = await enrichRecommendationBatchWithProviders(finalBatch);
  }

  const minMatchScore = options.minMatchScore ?? 0;

  if (minMatchScore > 0) {
    finalBatch = finalBatch.filter((movie) => {
      const score = getRecommendationScore(movie.recommendationTexts);
      return score != null && score >= minMatchScore;
    });

    let refillAttempts = 0;

    while (finalBatch.length < size && refillAttempts < size * 8) {
      refillAttempts += 1;

      try {
        const extraMovie = await getSurpriseRecommendation(Array.from(usedIds), {
          platformIds: options.platformIds,
          minRating: options.minRating,
          excludedGenres: options.excludedGenres,
        });

        if (!extraMovie?.id || usedIds.has(extraMovie.id)) continue;

        usedIds.add(extraMovie.id);

        let candidate: RecommendationMovieDetail = extraMovie as RecommendationMovieDetail;

        if (options.preloadMatchTexts) {
          const enriched = await enrichRecommendationBatchWithTexts([candidate], options);
          candidate = enriched[0];
        }

        if (options.preloadProviders) {
          const enriched = await enrichRecommendationBatchWithProviders([candidate]);
          candidate = enriched[0];
        }

        const candidateScore = getRecommendationScore(candidate.recommendationTexts);

        if (candidateScore != null && candidateScore >= minMatchScore) {
          finalBatch.push(candidate);
        }
      } catch (error) {
        console.error("ensureRecommendationBatch threshold refill failed:", error);
        break;
      }
    }
  }

  return dedupeMovies(finalBatch).slice(0, size);
}
