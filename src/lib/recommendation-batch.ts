import type { MovieDetail } from "@/lib/tmdb";
import { getSurpriseRecommendation, getWatchProviders } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeMultiVectorProfile } from "@/lib/taste-engine";

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

const toStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const normalizeRecommendationTexts = (data: RecommendationMatchData): RecommendationMatchData => {
  const score = data.matchScore ?? data.score ?? data.confidence;
  const reason =
    toStr(data.summary) ??
    toStr(data.detailedExplanation) ??
    toStr(data.whyItMatches) ??
    toStr(data.reason) ??
    toStr(data.pickNote) ??
    null;

  return {
    ...data,
    matchScore: score,
    score,
    confidence: data.confidence,
    headline: toStr(data.headline),
    whyItMatches: toStr(data.whyItMatches) ?? toStr(data.reason) ?? reason ?? undefined,
    detailedExplanation: toStr(data.detailedExplanation),
    emotionalJourney: toStr(data.emotionalJourney),
    perfectFor: toStr(data.perfectFor),
    funFact: toStr(data.funFact),
    summary: toStr(data.summary) ?? reason ?? undefined,
    reason: toStr(data.reason),
    tone: toStr(data.tone),
    pickNote: toStr(data.pickNote) ?? reason,
  };
};

const hasRecommendationScore = (data: RecommendationMatchData | null | undefined) =>
  data?.matchScore != null || data?.score != null || data?.confidence != null;

// True when rich display texts are already present (from surprise-personalized retrieve→rerank
// or movie-match). When true, movie-match enrichment is skipped.
// NOTE: whyItMatches is intentionally excluded — normalizeRecommendationTexts promotes the basic
// "reason" field into whyItMatches, which would cause false positives for fallback movies.
const hasRichMatchTexts = (data: RecommendationMatchData | null | undefined): boolean =>
  !!(data?.headline || data?.detailedExplanation || data?.emotionalJourney);

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
  // How many films to enrich synchronously before returning — rest are enriched lazily.
  eagerCount?: number;
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

  // computeMultiVectorProfile is cached in memory — second call within ~90s is instant.
  const [tasteProfile, multiVecProfile, likedMovies, cinematicProfile] = await Promise.all([
    getUserTasteProfile().catch(() => null),
    user ? computeMultiVectorProfile(user.id).catch(() => null) : Promise.resolve(null),
    user ? getLikedMovies().catch(() => []) : Promise.resolve([]),
    user
      ? supabase
          .from("cinematic_profiles" as any)
          .select("personality_title, narrative, taste_traits")
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const enrichedProfile = tasteProfile
    ? {
        ...tasteProfile,
        recentTasteVector: multiVecProfile?.recentTasteVector ?? null,
        avoidanceVector: multiVecProfile?.avoidanceVector ?? null,
      }
    : null;

  return {
    user,
    userCriteria: options.userCriteria ?? { mood: null, context: null, time: null },
    searchTags: options.searchTags ?? [],
    userTasteVector: multiVecProfile?.stableTasteVector ?? null,
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
        minMatchScore: options.minMatchScore ?? 60,
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
  // Call movie-match only for display texts — never for filtering.
  // surprise-personalized already pre-screened candidates; we just need rich texts.
  const moviesNeedingTexts = movies.filter((movie) => !hasRichMatchTexts(movie.recommendationTexts));
  if (!moviesNeedingTexts.length) return movies;

  const eagerCount = options.eagerCount ?? moviesNeedingTexts.length;
  const eagerMovies = moviesNeedingTexts.slice(0, eagerCount);
  if (!eagerMovies.length) return movies;

  const context = await buildMatchContext(options);
  // Parallel calls — gemini-2.0-flash handles concurrent requests well (~500ms total vs N×500ms sequential)
  const generated = await Promise.all(
    eagerMovies.map(async (movie) => {
      const t0 = performance.now();
      const recommendationTexts = await fetchRecommendationTextsForMovie(movie, context, options);
      const t1 = performance.now();
      const srv = (recommendationTexts as any)?._timings;
      console.log(
        `[Pick⏱] movie-match eager "${movie.title ?? movie.id}": ${Math.round(t1 - t0)}ms` +
          (srv ? ` (embed=${srv.embed}ms gemini=${srv.gemini}ms)` : ""),
      );
      return { id: movie.id, recommendationTexts };
    }),
  );

  const byId = new Map<number, RecommendationMatchData | null>(
    generated.map((entry) => [entry.id, entry.recommendationTexts]),
  );

  return movies.map((movie) => {
    if (!byId.has(movie.id)) return movie;
    const newTexts = byId.get(movie.id);
    // Preserve the original LLM score — movie-match is authoritative for rich texts only,
    // not for overriding the score that drove the recommendation selection.
    const originalScore = getRecommendationScore(movie.recommendationTexts);
    const originalConfidence = movie.recommendationTexts?.confidence;
    const recommendationTexts = newTexts
      ? {
          ...newTexts,
          confidence: originalConfidence ?? newTexts.confidence,
          matchScore: originalScore ?? newTexts.matchScore,
          score: originalScore ?? newTexts.score,
        }
      : movie.recommendationTexts ?? null;
    return recommendationTexts ? { ...movie, recommendationTexts } : movie;
  });
}

// Enrichit les films restants en arrière-plan et appelle onMovieEnriched pour chaque film.
// Ne bloque pas le rendu — à appeler APRÈS avoir dispatché le batch initial.
export function enrichMoviesLazy(
  movies: RecommendationMovieDetail[],
  options: RecommendationBatchOptions,
  onMovieEnriched: (movieId: number, texts: RecommendationMatchData) => void,
): void {
  if (!movies.length) return;
  (async () => {
    const context = await buildMatchContext(options);
    for (const movie of movies) {
      const tMovie0 = performance.now();
      const texts = await fetchRecommendationTextsForMovie(movie, context, options);
      const tMovie1 = performance.now();
      const srv = (texts as any)?._timings;
      console.log(
        `[Pick⏱] movie-match lazy "${movie.title ?? movie.id}": ${Math.round(tMovie1 - tMovie0)}ms` +
          (srv ? ` (embed=${srv.embed}ms gemini=${srv.gemini}ms)` : ""),
      );
      if (texts) onMovieEnriched(movie.id, texts);
    }
  })();
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
    if (minRating > 0 && (movie.vote_average ?? 0) > 0 && (movie.vote_average ?? 0) < minRating) return false;
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

  // Pre-sort and pre-slice BEFORE enrichment — scores come from the deterministic selection
  // in surprise-personalized (composite score); movie-match only adds rich texts and never
  // changes the sort order (originalScore always overrides movie-match score).
  // This limits movie-match calls to exactly `size` films instead of all candidates.
  let finalBatch = dedupeMovies(batch);

  if (options.preloadMatchTexts) {
    const scoreFloor = (options.minMatchScore ?? 60) - 5;
    const prescored = finalBatch
      .filter((m) => {
        const score = getRecommendationScore(m.recommendationTexts);
        return score === null || score >= scoreFloor;
      })
      .sort((a, b) => {
        const sa = getRecommendationScore(a.recommendationTexts) ?? 0;
        const sb = getRecommendationScore(b.recommendationTexts) ?? 0;
        return sb - sa;
      });
    // Never fall back to the unfiltered batch: prefer fewer films above threshold
    // over showing films the user explicitly doesn't want.
    finalBatch = prescored.slice(0, size);

    // Enrich ONLY the top `size` films — eliminates rate-limit 429s from excess parallel calls.
    finalBatch = await enrichRecommendationBatchWithTexts(finalBatch, options);

    // Load providers for the top N films
    if (options.preloadProviders) {
      finalBatch = await enrichRecommendationBatchWithProviders(finalBatch);
    }
  } else if (options.preloadProviders) {
    finalBatch = await enrichRecommendationBatchWithProviders(finalBatch.slice(0, size));
  } else {
    finalBatch = finalBatch.slice(0, size);
  }

  return dedupeMovies(finalBatch).slice(0, size);
}
