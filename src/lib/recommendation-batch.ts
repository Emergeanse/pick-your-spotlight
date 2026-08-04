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
  eagerCount?: number;
  // Score ALL candidates with movie-match first, then select top N by movie-match score.
  // movie-match devient le juge final (pas le LLM). Ignore minMatchScore comme seuil.
  scoreAllWithMovieMatch?: boolean;
  // Appelé dès que le premier résultat movie-match est prêt — sans bloquer le reste.
  onFirstMovieReady?: (movie: RecommendationMovieDetail) => void;
  // Appelé pour chaque film suivant (2ème, 3ème...) dès qu'il est prêt — affichage progressif.
  onMovieReady?: (movie: RecommendationMovieDetail) => void;
  // Appelé immédiatement avec les N films sélectionnés, AVANT que movie-match commence.
  // Permet d'afficher les films tout de suite avec le texte LLM, puis de les enrichir en fond.
  onBatchReady?: (movies: RecommendationMovieDetail[]) => void;
  // Appelé dès qu'un film est enrichi par movie-match (rich ou fallback) — met à jour le pool.
  onMovieEnriched?: (movie: RecommendationMovieDetail) => void;
  // Contexte duo : noms des deux utilisateurs pour personnaliser le texte movie-match
  duoContext?: { user1Name: string | null; user2Name: string | null };
  // Contexte groupe : s'adresser à plusieurs personnes plutôt qu'à une seule
  groupContext?: { size: number; kind: "famille" | "amis" | null; youngestAgeRange: string | null };
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
  const [tasteProfile, multiVecProfile, likedMovies, cinematicProfile, profileData] = await Promise.all([
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
    user
      ? supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const enrichedProfile = tasteProfile
    ? {
        ...tasteProfile,
        recentTasteVector: multiVecProfile?.recentTasteVector ?? null,
        avoidanceVector: multiVecProfile?.avoidanceVector ?? null,
      }
    : null;

  const userName = (profileData as any)?.display_name || user?.email?.split("@")[0] || null;

  return {
    user,
    userName,
    userCriteria: options.userCriteria ?? { mood: null, context: null, time: null },
    searchTags: options.searchTags ?? [],
    userTasteVector: multiVecProfile?.stableTasteVector ?? null,
    likedMovieTitles: (likedMovies || []).map((m: any) => m.title),
    tasteProfile: enrichedProfile,
    cinematicProfile,
    peoplePreferences: tasteProfile?.peoplePreferences || null,
    duoContext: options.duoContext ?? null,
    groupContext: options.groupContext ?? null,
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
        userName: context.userName,
        duoContext: (context as any).duoContext ?? null,
        groupContext: (context as any).groupContext ?? null,
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
  const reserveMovies = moviesNeedingTexts.slice(eagerCount);
  if (!eagerMovies.length) return movies;

  const context = await buildMatchContext(options);
  const onFirstMovieReady = options.onFirstMovieReady;
  let firstMovieFired = false;

  // Afficher les films immédiatement avec les textes LLM, avant que movie-match commence.
  if (options.onBatchReady && eagerMovies.length > 0) {
    Promise.resolve().then(() => options.onBatchReady!(eagerMovies));
  }

  // Sequential calls: film 1 → film 2 → film 3
  // Each result triggers onMovieEnriched immediately so the UI updates progressively.
  // Films 4-5 (reserveMovies) are only called as fallback if one of the first 3 fails.
  const generated: Array<{ id: number; movie: RecommendationMovieDetail; recommendationTexts: RecommendationMatchData | null }> = [];
  for (const movie of eagerMovies) {
    const t0 = performance.now();
    let recommendationTexts = await fetchRecommendationTextsForMovie(movie, context, options);

    // Retry once if null or fallback (transient Gemini / rate-limit failure)
    if (!recommendationTexts || (recommendationTexts as any)?.fallback) {
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[Pick⏱] movie-match fallback "${movie.title ?? movie.id}": ${elapsed}ms — retry in 4s`);
      await new Promise((r) => setTimeout(r, 4000));
      const retried = await fetchRecommendationTextsForMovie(movie, context, options);
      if (retried) recommendationTexts = retried;
    }

    const t1 = performance.now();
    const srv = (recommendationTexts as any)?._timings;
    console.log(
      `[Pick⏱] movie-match eager "${movie.title ?? movie.id}": ${Math.round(t1 - t0)}ms` +
        (srv ? ` (embed=${srv.embed}ms gemini=${srv.gemini}ms)` : ""),
    );
    const isRich = !!(recommendationTexts?.whyItMatches && !(recommendationTexts as any)?.fallback);
    // Enrichissement en temps réel du pool — rich ou fallback
    if (options.onMovieEnriched && recommendationTexts) {
      const originalScore = getRecommendationScore(movie.recommendationTexts);
      const mmScore = getRecommendationScore(recommendationTexts);
      // SP sometimes returns aberrant values (8%, -4%) — treat anything < 60 as absent.
      const spValid = originalScore != null && originalScore >= 60 ? originalScore : null;
      const bestScore = spValid != null && mmScore != null
        ? Math.max(spValid, mmScore)
        : (spValid ?? mmScore);
      const mergedTexts = {
        ...recommendationTexts,
        matchScore: bestScore ?? recommendationTexts.matchScore,
        score: bestScore ?? recommendationTexts.score,
      };
      Promise.resolve().then(() => options.onMovieEnriched!({ ...movie, recommendationTexts: mergedTexts }));
    }
    if (isRich) {
      if (onFirstMovieReady && !firstMovieFired) {
        firstMovieFired = true;
        Promise.resolve().then(() => onFirstMovieReady({ ...movie, recommendationTexts }));
      } else if (options.onMovieReady && firstMovieFired) {
        Promise.resolve().then(() => options.onMovieReady!({ ...movie, recommendationTexts }));
      }
    }
    generated.push({ id: movie.id, movie, recommendationTexts });
  }

  const byId = new Map<number, RecommendationMatchData | null>(
    generated.map((entry) => [entry.id, entry.recommendationTexts]),
  );

  // Waterfall : si des appels ont retourné un fallback (Gemini KO), essayer les films de réserve
  const isFallback = (r: RecommendationMatchData | null | undefined) =>
    !r?.whyItMatches || (r as any)?.fallback === true;
  const failedCount = generated.filter((e) => isFallback(e.recommendationTexts)).length;
  const extraMovies: RecommendationMovieDetail[] = [];
  if (failedCount > 0 && reserveMovies.length > 0) {
    let recovered = 0;
    for (const movie of reserveMovies) {
      if (recovered >= failedCount) break;
      const t0 = performance.now();
      const texts = await fetchRecommendationTextsForMovie(movie, context, options);
      const t1 = performance.now();
      const srv = (texts as any)?._timings;
      console.log(
        `[Pick⏱] movie-match reserve "${movie.title ?? movie.id}": ${Math.round(t1 - t0)}ms` +
          (srv ? ` (embed=${srv.embed}ms gemini=${srv.gemini}ms)` : ""),
      );
      if (texts?.whyItMatches && !(texts as any)?.fallback) {
        byId.set(movie.id, texts);
        extraMovies.push(movie);
        recovered++;
        if (onFirstMovieReady && !firstMovieFired) {
          firstMovieFired = true;
          Promise.resolve().then(() => onFirstMovieReady({ ...movie, recommendationTexts: texts }));
        }
        if (options.onMovieEnriched) {
          const originalScore = getRecommendationScore(movie.recommendationTexts);
          const mergedTexts = { ...texts, matchScore: originalScore ?? texts.matchScore, score: originalScore ?? texts.score };
          Promise.resolve().then(() => options.onMovieEnriched!({ ...movie, recommendationTexts: mergedTexts }));
        }
      }
    }
  }

  const applyTexts = (movie: RecommendationMovieDetail): RecommendationMovieDetail => {
    if (!byId.has(movie.id)) return movie;
    const newTexts = byId.get(movie.id);
    const originalScore = getRecommendationScore(movie.recommendationTexts);
    const originalConfidence = movie.recommendationTexts?.confidence;
    // Use the best score between SP and movie-match. SP LLM sometimes returns aberrant values
    // (8%, -4%...) — treat anything < 60 as absent so movie-match score prevails.
    const mmScore2 = getRecommendationScore(newTexts);
    const spValid2 = originalScore != null && originalScore >= 60 ? originalScore : null;
    const bestScore2 = spValid2 != null && mmScore2 != null
      ? Math.max(spValid2, mmScore2)
      : (spValid2 ?? mmScore2);
    const recommendationTexts = newTexts
      ? {
          ...newTexts,
          confidence: originalConfidence ?? newTexts.confidence,
          matchScore: bestScore2 ?? newTexts.matchScore,
          score: bestScore2 ?? newTexts.score,
        }
      : movie.recommendationTexts ?? null;
    return recommendationTexts ? { ...movie, recommendationTexts } : movie;
  };

  // Films originaux enrichis + films de réserve récupérés via waterfall
  return [...movies.map(applyTexts), ...extraMovies.map(applyTexts)];
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
  const dropTrace: { id: number; title: string; reason: string }[] = [];
  const batch = dedupeMovies(initialMovies).filter((movie) => {
    if (excludeSet.has(movie.id)) {
      dropTrace.push({ id: movie.id, title: movie.title || "?", reason: "excludeIds" });
      return false;
    }
    if (minRating > 0 && (movie.vote_average ?? 0) > 0 && (movie.vote_average ?? 0) < minRating) {
      dropTrace.push({ id: movie.id, title: movie.title || "?", reason: `note < ${minRating}` });
      return false;
    }
    if (excludedGenreSet.size > 0 && movie.genres?.some((g) => excludedGenreSet.has(g.name.toLowerCase()))) {
      dropTrace.push({ id: movie.id, title: movie.title || "?", reason: "genre exclu" });
      return false;
    }
    return true;
  });
  if (dropTrace.length > 0) {
    console.log(
      `[Pick] ensureRecommendationBatch: ${dropTrace.length} film(s) retiré(s) — ${dropTrace.map((d) => `"${d.title}" (${d.reason})`).join(", ")}`,
    );
  }
  const usedIds = new Set<number>([...excludeSet, ...batch.map((movie) => movie.id)]);

  // En mode scoreAllWithMovieMatch (pipeline HomeScreen), on ne complète PAS avec des films
  // aléatoires : la SP est la source de vérité. Remplir les slots manquants sans connaître
  // les filtres vocaux (genre, décennie) produit des résultats hors-sujet (ex: Fenêtre sur cour
  // après une demande "films historiques français"). Mieux vaut montrer 1 bon film que 3 dont 2 faux.
  if (batch.length < size && !options.scoreAllWithMovieMatch) {
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

  if (options.preloadMatchTexts && options.scoreAllWithMovieMatch) {
    // Mode : movie-match juge final
    // On passe tous les candidats pour que les films en réserve servent de fallback
    // si movie-match échoue sur les premiers (waterfall dans enrichRecommendationBatchWithTexts)
    const toEnrich = finalBatch;
    // eagerCount = size : seulement `size` films en parallèle, le reste sert de réserve waterfall
    const allEnriched = await enrichRecommendationBatchWithTexts(toEnrich, { ...options, eagerCount: size });
    const enrichedDeduped = dedupeMovies(allEnriched);
    const withScores = enrichedDeduped.filter((m) => getRecommendationScore(m.recommendationTexts) !== null);
    const withoutScores = enrichedDeduped.filter((m) => getRecommendationScore(m.recommendationTexts) === null);
    // Trier : vrais rich texts (waterfall réussi) avant fallbacks — toujours.
    // Le sort par score LLM reste désactivé si onFirstMovieReady est actif
    // (le film déjà affiché garde sa position via le reorder HomeScreen).
    withScores.sort((a, b) => {
      const aFallback = (a.recommendationTexts as any)?.fallback ? 1 : 0;
      const bFallback = (b.recommendationTexts as any)?.fallback ? 1 : 0;
      if (aFallback !== bFallback) return aFallback - bFallback;
      if (!options.onFirstMovieReady) {
        const sa = getRecommendationScore(a.recommendationTexts) ?? 0;
        const sb = getRecommendationScore(b.recommendationTexts) ?? 0;
        return sb - sa;
      }
      return 0;
    });
    // Complète avec les films sans score si besoin — évite finalCount < size
    const combined = [...withScores, ...withoutScores];
    finalBatch = combined.slice(0, size);
    if (finalBatch.length < size && batch.length > finalBatch.length) {
      const present = new Set(finalBatch.map((m) => m.id));
      const extras = batch.filter((m) => !present.has(m.id));
      finalBatch = [...finalBatch, ...extras].slice(0, size);
      if (finalBatch.length > combined.slice(0, size).length) {
        console.log(
          `[Pick] ensureRecommendationBatch: complété ${finalBatch.length}/${size} depuis candidats edge (scores movie-match absents)`,
        );
      }
    }
    if (options.preloadProviders) {
      finalBatch = await enrichRecommendationBatchWithProviders(finalBatch);
    }
  } else if (options.preloadMatchTexts) {
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
    finalBatch = prescored.slice(0, size);
    finalBatch = await enrichRecommendationBatchWithTexts(finalBatch, options);
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
