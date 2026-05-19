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

export const getRecommendationScore = (data: RecommendationMatchData | null | undefined) =>
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
  mediaType?: "movie" | "tv" | "both";
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
  const excludeSet = new Set(options.excludeIds ?? []);
  const minRating = options.minRating ?? 0;
  const excludedGenreSet = new Set((options.excludedGenres ?? []).map((g) => g.toLowerCase()));
  // Hard filter: remove excluded movies, those below the minimum rating,
  // and those whose genres overlap with the user's excluded genres —
  // even if the edge function returned them.
  const batch = dedupeMovies(initialMovies).filter((movie) => {
    if (excludeSet.has(movie.id)) return false;
    if (minRating > 0 && (movie.vote_average ?? 0) < minRating) return false;
    if (excludedGenreSet.size > 0 && movie.genres?.some((g) => excludedGenreSet.has(g.name.toLowerCase()))) return false;
    return true;
  });
  const usedIds = new Set<number>([...excludeSet, ...batch.map((movie) => movie.id)]);

  if (batch.length < size) {
    const needed = size - batch.length;
    const usedSnapshot = Array.from(usedIds);
    const rawResults = await Promise.allSettled(
      Array.from({ length: needed * 2 }, () =>
        getSurpriseRecommendation(usedSnapshot, {
          platformIds: options.platformIds,
          minRating: options.minRating,
          excludedGenres: options.excludedGenres,
          mediaType: options.mediaType,
        }),
      ),
    );
    for (const result of rawResults) {
      if (batch.length >= size) break;
      if (result.status !== "fulfilled" || !result.value?.id) continue;
      if (usedIds.has(result.value.id)) continue;
      usedIds.add(result.value.id);
      batch.push(result.value as RecommendationMovieDetail);
    }
  }

  const minMatchScore = options.minMatchScore ?? 0;

  let finalBatch = dedupeMovies(batch).slice(0, size);

  if (options.preloadMatchTexts) {
    // Only score movies that don't already have a score (TMDB refills)
    finalBatch = await enrichRecommendationBatchWithTexts(finalBatch, { ...options, forceRescore: false });
  }

  if (options.preloadProviders) {
    finalBatch = await enrichRecommendationBatchWithProviders(finalBatch);
  }

  if (minMatchScore > 0) {
    // Strict filter: movies must have a score AND meet the threshold.
    // Unscored movies never bypass the threshold.
    const passing = finalBatch.filter((movie) => {
      const score = getRecommendationScore(movie.recommendationTexts);
      return score != null && score >= minMatchScore;
    });

    if (passing.length >= size) {
      return dedupeMovies(passing).slice(0, size);
    }

    // Refill: fetch TMDB candidates, score them with movie-match, accept only those
    // that genuinely meet the threshold. Quality over quantity.
    const REFILL_BATCH_SIZE = 4;
    const MAX_ROUNDS = Math.ceil((size * 4) / REFILL_BATCH_SIZE);
    let rounds = 0;
    const filledPassing = [...passing];

    while (filledPassing.length < size && rounds < MAX_ROUNDS) {
      rounds += 1;

      const needed = size - filledPassing.length;
      const fetchCount = Math.max(needed, REFILL_BATCH_SIZE);
      const usedSnapshot = Array.from(usedIds);
      const rawResults = await Promise.allSettled(
        Array.from({ length: fetchCount }, () =>
          getSurpriseRecommendation(usedSnapshot, {
            platformIds: options.platformIds,
            minRating: options.minRating,
            excludedGenres: options.excludedGenres,
            mediaType: options.mediaType,
          }),
        ),
      );

      const candidates: RecommendationMovieDetail[] = [];
      for (const result of rawResults) {
        if (result.status !== "fulfilled" || !result.value?.id) continue;
        const movie = result.value;
        if (usedIds.has(movie.id)) continue;
        usedIds.add(movie.id);
        candidates.push(movie as RecommendationMovieDetail);
      }

      if (!candidates.length) break;

      // Score candidates against the threshold before accepting.
      const scored = await enrichRecommendationBatchWithTexts(candidates, options);
      const enriched = options.preloadProviders
        ? await enrichRecommendationBatchWithProviders(scored)
        : scored;

      for (const candidate of enriched) {
        const score = getRecommendationScore(candidate.recommendationTexts);
        if (score != null && score >= minMatchScore) {
          filledPassing.push(candidate);
          if (filledPassing.length >= size) break;
        }
      }
    }

    // Return only qualifying movies — may be fewer than size if threshold is strict.
    return dedupeMovies(filledPassing).slice(0, size);
  }

  return dedupeMovies(finalBatch).slice(0, size);
}
