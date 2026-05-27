import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle } from "@/lib/tmdb";
import type { RecommendationMovieDetail } from "@/lib/recommendation-batch";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  enrichMoviesLazy,
  RECOMMENDATION_BATCH_SIZE,
} from "@/lib/recommendation-batch";
import { recordSkippedRecommendation } from "@/lib/engagement";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import { getTimeContextForPrompt } from "@/lib/time-context";
import {
  createRecommendationSession,
  logRecommendationEvent,
  completeSession,
  abandonSession,
} from "@/lib/sessions";
import type { CinemaAnecdote } from "@/components/pick/RevealAnimation";
import type { ChatMessage, VoiceSearchFilters } from "@/components/pick/VoiceChat";
import type { IndexState, IndexDispatch } from "./reducer";
import type { ProfilePrefs } from "./use-profile-prefs";

type Options = {
  user: User | null;
  state: IndexState;
  dispatch: IndexDispatch;
  profilePrefs: ProfilePrefs;
  pickPlusIsPremium: boolean;
};

async function invokeSurprisePersonalized(body: any, retries = 2): Promise<any> {
  const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });
  if (error) {
    const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
    if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
      return invokeSurprisePersonalized(body, retries - 1);
    }
    throw error;
  }
  return data;
}

export function useRecommendationEngine({
  user,
  state,
  dispatch,
  profilePrefs,
  pickPlusIsPremium,
}: Options) {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [dynamicAnecdotes, setDynamicAnecdotes] = useState<CinemaAnecdote[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const loggedEventsRef = useRef<Set<number>>(new Set());

  // Latest state ref so async handlers see fresh data without re-creating callbacks.
  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionIdRef = useRef(currentSessionId);
  sessionIdRef.current = currentSessionId;

  const fetchCinemaAnecdotes = useCallback(
    async (context?: { genre?: string; mood?: string; mediaType?: string }) => {
      try {
        const { data } = await supabase.functions.invoke("cinema-anecdotes", { body: context ?? {} });
        if (data?.anecdotes?.length) setDynamicAnecdotes(data.anecdotes);
      } catch {
        // Non-critical
      }
    },
    [],
  );

  const normalizeRecommendationBatch = useCallback(
    (movies: RecommendationMovieDetail[], excludeIds: number[] = [], size = profilePrefs.recommendationBatchSize, extra: { eagerCount?: number } = {}) =>
      ensureRecommendationBatch(movies, {
        excludeIds,
        platformIds: profilePrefs.preferredPlatforms,
        minRating: profilePrefs.minRating,
        excludedGenres: profilePrefs.excludedGenres,
        minMatchScore: profilePrefs.matchThreshold,
        searchTags: stateRef.current.searchTags,
        userCriteria: { mood: null, context: null, time: null },
        size,
        preloadMatchTexts: true,
        preloadProviders: true,
        ...extra,
      }),
    [
      profilePrefs.excludedGenres,
      profilePrefs.minRating,
      profilePrefs.preferredPlatforms,
      profilePrefs.recommendationBatchSize,
      profilePrefs.matchThreshold,
    ],
  );

  const openRecommendationBatch = useCallback(
    (
      movies: RecommendationMovieDetail[],
      origin: "home" | "external" = "home",
      startIndex = 0,
      seenMovieIds?: Set<number>,
      suggestionCount?: number,
    ) => {
      const safeStart = Math.min(startIndex, Math.max(movies.length - 1, 0));
      dispatch({
        type: "OPEN_BATCH",
        movies,
        origin,
        startIndex: safeStart,
        seenMovieIds,
        suggestionCount: suggestionCount ?? movies.length ?? profilePrefs.recommendationBatchSize,
      });

      loggedEventsRef.current = new Set();
      if (user) {
        createRecommendationSession({
          audience_type: "solo",
          decision_mode: "instant",
          source: origin === "external" ? "external" : "surprise",
          filters_snapshot: {
            platformIds: profilePrefs.preferredPlatforms,
            minRating: profilePrefs.minRating,
            excludedGenres: profilePrefs.excludedGenres,
          },
        })
          .then((id) => {
            setCurrentSessionId(id);
            const first = movies[safeStart];
            if (first && !loggedEventsRef.current.has(first.id)) {
              loggedEventsRef.current.add(first.id);
              logRecommendationEvent({
                session_id: id,
                tmdb_id: first.id,
                title: first.title || first.name || "",
                rank_position: safeStart + 1,
                source: "solo_session",
              }).catch(() => {});
            }
          })
          .catch(() => setCurrentSessionId(null));
      } else {
        setCurrentSessionId(null);
      }
    },
    [
      user,
      dispatch,
      profilePrefs.excludedGenres,
      profilePrefs.minRating,
      profilePrefs.preferredPlatforms,
      profilePrefs.recommendationBatchSize,
    ],
  );

  // Log "movie viewed" events as user navigates through the result deck.
  useEffect(() => {
    if (state.step !== "result" || !currentSessionId) return;
    const m = state.results[state.currentResultIndex];
    if (!m || loggedEventsRef.current.has(m.id)) return;
    loggedEventsRef.current.add(m.id);
    logRecommendationEvent({
      session_id: currentSessionId,
      tmdb_id: m.id,
      title: m.title || m.name || "",
      rank_position: state.currentResultIndex + 1,
      source: "solo_session",
    }).catch(() => {});
  }, [state.step, state.results, state.currentResultIndex, currentSessionId]);

  const abandonCurrentSession = useCallback(() => {
    const id = sessionIdRef.current;
    if (id) abandonSession(id).catch(() => {});
    setCurrentSessionId(null);
    loggedEventsRef.current = new Set();
  }, []);

  const handleSurprise = useCallback(
    async (movies: MovieDetail[], startIndex: number = 0, seenMovieIds?: Set<number>) => {
      const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
      const tasteProfile = user ? await getUserTasteProfile() : null;
      const excludeIds = [...movies.map((m) => m.id), ...(tasteProfile?.excludeIds ?? [])];
      const batch = await normalizeRecommendationBatch(movies, excludeIds, desiredCount);
      openRecommendationBatch(batch, "home", startIndex, seenMovieIds, desiredCount);
    },
    [normalizeRecommendationBatch, openRecommendationBatch, profilePrefs.recommendationBatchSize, user],
  );

  const handleMovieSelect = useCallback(
    async (movie: MovieDetail) => {
      const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
      const batch = await normalizeRecommendationBatch([movie], [movie.id], desiredCount);
      openRecommendationBatch(batch, "home", 0, undefined, desiredCount);
    },
    [normalizeRecommendationBatch, openRecommendationBatch, profilePrefs.recommendationBatchSize],
  );

  const handleShowAnother = useCallback(
    async (rejectReason?: string, rejectedMovie?: MovieDetail, onWatchlistGuideAdvance?: () => void) => {
      onWatchlistGuideAdvance?.();
      const current = stateRef.current;
      const currentMovie = current.results[current.currentResultIndex];
      if (currentMovie && !rejectReason) trackInteraction(currentMovie.id, "skipped", {});
      if (currentMovie && user) recordSkippedRecommendation(user.id);

      setLoading(true);
      setDynamicAnecdotes([]);
      fetchCinemaAnecdotes({ genre: current.searchTags[0] });
      try {
        const [liked, tasteProfile, multiVec] = user
          ? await Promise.all([getLikedMovies(), getUserTasteProfile(), computeMultiVectorProfile(user.id)])
          : ([[], null, null] as const);
        const excludeIds = [...current.results.map((r) => r.id), ...((tasteProfile as any)?.excludeIds || [])];
        const rejectionContext =
          rejectReason && rejectedMovie
            ? {
                reason: rejectReason,
                rejectedGenres: (rejectedMovie.genres || []).map((g) => g.name),
                rejectedTitle: getDisplayTitle(rejectedMovie),
                rejectedRating: rejectedMovie.vote_average,
                rejectedRuntime: rejectedMovie.runtime,
              }
            : undefined;

        let batch: RecommendationMovieDetail[] = [];
        if (user && liked.length >= 2) {
          const confidenceScore = tasteProfile?.confidence?.score ?? profilePrefs.profileConfidence ?? 50;
          const explorationLevel = confidenceScore >= 70 ? 3 : confidenceScore >= 40 ? 5 : 7;
          const tSP0 = performance.now();
          const data = await invokeSurprisePersonalized({
            likedMovies: liked,
            userTasteVector: multiVec?.stableTasteVector ?? null,
            recentTasteVector: multiVec?.recentTasteVector ?? null,
            avoidanceVector: multiVec?.avoidanceVector ?? null,
            tasteProfile,
            platformIds: profilePrefs.preferredPlatforms,
            excludedPlatformIds: profilePrefs.excludedPlatforms,
            excludedGenres: profilePrefs.excludedGenres,
            minRating: profilePrefs.minRating,
            minMatchScore: profilePrefs.matchThreshold,
            excludeIds,
            rejectionContext,
            explorationLevel,
            count: profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE,
          });
          const tSP1 = performance.now();
          console.log(`[Pick⏱] surprise-personalized: ${Math.round(tSP1 - tSP0)}ms | server:`, data?.engineMeta?.timings ?? "n/a");
          const extracted = extractRecommendationMovies(data);
          const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;

          // Enrichit seulement le film[0] avant d'afficher — les suivants arrivent en arrière-plan
          const tEager0 = performance.now();
          batch = await normalizeRecommendationBatch(extracted, excludeIds, desiredCount, { eagerCount: 1 });
          const tEager1 = performance.now();
          console.log(`[Pick⏱] movie-match eager (film[0]): ${Math.round(tEager1 - tEager0)}ms`);
          console.log(`[Pick⏱] ✅ AFFICHAGE: ${Math.round(tEager1 - tSP0)}ms depuis le clic`);
        } else {
          batch = await normalizeRecommendationBatch([], excludeIds);
        }

        dispatch({
          type: "REPLACE_BATCH",
          movies: batch,
          suggestionCount: profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE,
        });

        // Films 1..N : enrichissement en arrière-plan pendant que l'utilisateur regarde film[0]
        const lazyMovies = batch.slice(1).filter((m) => !m.recommendationTexts?.headline);
        if (lazyMovies.length > 0) {
          enrichMoviesLazy(
            lazyMovies,
            {
              platformIds: profilePrefs.preferredPlatforms,
              minRating: profilePrefs.minRating,
              excludedGenres: profilePrefs.excludedGenres,
              minMatchScore: profilePrefs.matchThreshold,
              searchTags: stateRef.current.searchTags,
              userCriteria: { mood: null, context: null, time: null },
            },
            (movieId, texts) => dispatch({ type: "UPDATE_MOVIE_TEXTS", movieId, texts }),
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [
      dispatch,
      fetchCinemaAnecdotes,
      normalizeRecommendationBatch,
      profilePrefs.excludedGenres,
      profilePrefs.excludedPlatforms,
      profilePrefs.minRating,
      profilePrefs.preferredPlatforms,
      profilePrefs.profileConfidence,
      profilePrefs.recommendationBatchSize,
      profilePrefs.matchThreshold,
      user,
    ],
  );

  const handleVoiceSearchIntent = useCallback(
    async (filters: VoiceSearchFilters, recapTags: string[]) => {
      if (recapTags.length > 0) dispatch({ type: "SET_SEARCH_TAGS", tags: recapTags });
      dispatch({ type: "CLOSE_CHAT" });
      setLoading(true);
      setLoadingMessage("Pick cherche ton film…");
      try {
        const [liked, tasteProfile, multiVec] = user
          ? await Promise.all([getLikedMovies(), getUserTasteProfile(), computeMultiVectorProfile(user.id)])
          : ([[], null, null] as const);
        const excludeIds = [
          ...stateRef.current.results.map((r) => r.id),
          ...((tasteProfile as any)?.excludeIds || []),
        ];
        const confidenceScore = tasteProfile?.confidence?.score ?? profilePrefs.profileConfidence ?? 50;
        const explorationLevel = confidenceScore >= 70 ? 3 : confidenceScore >= 40 ? 5 : 7;
        const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
        const data = await invokeSurprisePersonalized({
          likedMovies: liked,
          userTasteVector: multiVec?.stableTasteVector ?? null,
          recentTasteVector: multiVec?.recentTasteVector ?? null,
          avoidanceVector: multiVec?.avoidanceVector ?? null,
          tasteProfile,
          platformIds: profilePrefs.preferredPlatforms,
          excludedPlatformIds: profilePrefs.excludedPlatforms,
          excludedGenres: profilePrefs.excludedGenres,
          minRating: profilePrefs.minRating,
          minMatchScore: profilePrefs.matchThreshold,
          excludeIds,
          explorationLevel,
          count: desiredCount * 3,
          voiceGenres: filters.genres,
          voiceOriginalLanguage: filters.originalLanguage,
          voiceMediaType: filters.mediaType,
          voiceMaxDuration: filters.maxDuration,
          voiceDecade: filters.decade,
        });
        const extracted = extractRecommendationMovies(data);
        if (extracted.length > 0) {
          openRecommendationBatch(extracted, "home", 0, undefined, desiredCount);
        } else {
          dispatch({ type: "SET_STEP_HOME" });
        }
      } catch (e) {
        console.error("[voice] handleVoiceSearchIntent error:", e);
        toast.error("Erreur recherche vocale : " + (e instanceof Error ? e.message : "Réessaie dans un instant."));
        dispatch({ type: "SET_STEP_HOME" });
      } finally {
        setLoading(false);
        setLoadingMessage("");
      }
    },
    [
      dispatch,
      openRecommendationBatch,
      profilePrefs.excludedGenres,
      profilePrefs.excludedPlatforms,
      profilePrefs.matchThreshold,
      profilePrefs.minRating,
      profilePrefs.preferredPlatforms,
      profilePrefs.profileConfidence,
      profilePrefs.recommendationBatchSize,
      user,
    ],
  );

  const handleRefineWithMessage = useCallback(
    async (message: string, fetchAnecdotesGenre?: string) => {
      const current = stateRef.current;
      const currentMovie = current.results[current.currentResultIndex];
      if (!currentMovie) return;
      const shortLabel = message.replace(/^(Je veux |Je préfère |Montre-moi )/i, "").toLowerCase();
      dispatch({ type: "ADD_TAG", tag: shortLabel });
      setLoading(true);
      setDynamicAnecdotes([]);
      fetchCinemaAnecdotes({ genre: fetchAnecdotesGenre ?? shortLabel });
      setLoadingMessage("Pick cherche mieux…");
      try {
        const contextMessages = [
          { role: "assistant" as const, content: `Je t'ai recommandé **${getDisplayTitle(currentMovie)}**.` },
          { role: "user" as const, content: message },
        ];
        const { data, error } = await supabase.functions.invoke("pick-chat", {
          body: {
            messages: contextMessages,
            mode: "discovery",
            isPremium: pickPlusIsPremium,
            minRating: profilePrefs.minRating,
            excludedGenres: profilePrefs.excludedGenres,
            timeContext: getTimeContextForPrompt(),
          },
        });
        if (error) throw error;
        const newMovies = extractRecommendationMovies(data);
        if (newMovies.length > 0) {
          if (data.recap?.length > 0) dispatch({ type: "MERGE_SEARCH_TAGS", tags: data.recap });
          const batch = await normalizeRecommendationBatch(
            newMovies,
            stateRef.current.results.map((result) => result.id),
            profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE,
          );
          dispatch({
            type: "REPLACE_BATCH",
            movies: batch,
            suggestionCount: profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE,
          });
        }
      } catch (e) {
        console.error("Refine error:", e);
      } finally {
        setLoading(false);
        setLoadingMessage("");
      }
    },
    [
      dispatch,
      fetchCinemaAnecdotes,
      normalizeRecommendationBatch,
      pickPlusIsPremium,
      profilePrefs.excludedGenres,
      profilePrefs.minRating,
      profilePrefs.recommendationBatchSize,
    ],
  );

  const completeSessionForMovie = useCallback((m: MovieDetail) => {
    const id = sessionIdRef.current;
    if (!id) return;
    completeSession(id, m.id, {
      title: m.title || m.name || "",
      poster_path: m.poster_path || null,
      media_type: m.first_air_date ? "tv" : "movie",
    }).catch(() => {});
    setCurrentSessionId(null);
  }, []);

  return {
    loading,
    setLoading,
    loadingMessage,
    setLoadingMessage,
    dynamicAnecdotes,
    setDynamicAnecdotes,
    currentSessionId,
    abandonCurrentSession,
    completeSessionForMovie,
    fetchCinemaAnecdotes,
    normalizeRecommendationBatch,
    openRecommendationBatch,
    handleSurprise,
    handleMovieSelect,
    handleShowAnother,
    handleVoiceSearchIntent,
    handleRefineWithMessage,
  };
}
