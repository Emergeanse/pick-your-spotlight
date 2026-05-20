import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import HomeScreen from "@/components/pick/HomeScreen";
import ResultScreen from "@/components/pick/ResultScreen";
import VoiceChat from "@/components/pick/VoiceChat";
import RevealAnimation from "@/components/pick/RevealAnimation";
import PlatformTour from "@/components/pick/PlatformTour";
import ActivationFlow from "@/components/pick/ActivationFlow";
import type { MissionId } from "@/components/pick/ActivationFlow";
import WatchlistMissionGuide from "@/components/pick/WatchlistMissionGuide";
import type { WatchlistGuideStep } from "@/components/pick/WatchlistMissionGuide";
import TalkToPickMissionGuide from "@/components/pick/TalkToPickMissionGuide";
import type { TalkToPickGuideStep } from "@/components/pick/TalkToPickMissionGuide";
import type { ChatMessage } from "@/components/pick/VoiceChat";
import { toast } from "sonner";
import BrandHeader from "@/components/pick/BrandHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import type { MovieDetail } from "@/lib/tmdb";
import type { RecommendationMovieDetail } from "@/lib/recommendation-batch";
import { getDisplayTitle } from "@/lib/tmdb";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { usePickPlus } from "@/hooks/use-pick-plus";
import { getTimeContextForPrompt } from "@/lib/time-context";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  RECOMMENDATION_BATCH_SIZE,
} from "@/lib/recommendation-batch";
import { usePresenceTracker } from "@/hooks/use-presence";
import { createRecommendationSession, logRecommendationEvent, completeSession, abandonSession } from "@/lib/sessions";

type Step = "home" | "result";

const Index = () => {
  usePresenceTracker();
  const [step, setStep] = useState<Step>("home");
  const [results, setResults] = useState<RecommendationMovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [resultIndexHistory, setResultIndexHistory] = useState<number[]>([]);
  const [resultSeenMovieIds, setResultSeenMovieIds] = useState<Set<number>>(new Set());
  const [batchRejectedIds, setBatchRejectedIds] = useState<Set<number>>(new Set());
  const [resultOrigin, setResultOrigin] = useState<"home" | "external">("home");
  const [resultSuggestionCount, setResultSuggestionCount] = useState(RECOMMENDATION_BATCH_SIZE);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const loggedEventsRef = useRef<Set<number>>(new Set());
  const [chatInitialMessages, setChatInitialMessages] = useState<ChatMessage[] | undefined>(undefined);
  const [chatSuggestedSeenMovieIds, setChatSuggestedSeenMovieIds] = useState<Set<number>>(new Set());
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [profilePrefs, setProfilePrefs] = useState<{
    excludedGenres: string[];
    excludedPlatforms: number[];
    minRating: number;
    preferredPlatforms: number[];
    profileConfidence: number;
    recommendationBatchSize: number;
    matchThreshold: number;
  }>({
    excludedGenres: [],
    excludedPlatforms: [],
    minRating: 0,
    preferredPlatforms: [],
    profileConfidence: 0,
    recommendationBatchSize: RECOMMENDATION_BATCH_SIZE,
    matchThreshold: 80,
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pickPlus = usePickPlus();
  const [openTrainerOnMount, setOpenTrainerOnMount] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [activeActivationMission, setActiveActivationMission] = useState<MissionId | null>(null);
  const [watchlistGuideStep, setWatchlistGuideStep] = useState<WatchlistGuideStep>(null);
  const [watchlistGuideDone, setWatchlistGuideDone] = useState(false);
  const [watchlistSavedCount, setWatchlistSavedCount] = useState(0);
  const [talkToPickGuideStep, setTalkToPickGuideStep] = useState<TalkToPickGuideStep>(null);
  const watchlistGuideAwaitingLoad = useRef(false);
  const [chatSuggestedMovies, setChatSuggestedMovies] = useState<MovieDetail[] | null>(null);
  const [chatSuggestedStartIndex, setChatSuggestedStartIndex] = useState(0);

  const resetToHomeView = () => {
    if (currentSessionId) {
      abandonSession(currentSessionId).catch(() => {});
    }
    setCurrentSessionId(null);
    loggedEventsRef.current = new Set();
    setStep("home");
    setResults([]);
    setResultSuggestionCount(profilePrefs.recommendationBatchSize);
    setCurrentResultIndex(0);
    setResultIndexHistory([]);
    setResultSeenMovieIds(new Set());
    setBatchRejectedIds(new Set());
    setSearchTags([]);
    setShowChat(false);
    setChatInitialMessages(undefined);
    setChatSuggestedMovies(null);
    setChatSuggestedSeenMovieIds(new Set());
  };

  const normalizeRecommendationBatch = useCallback(
    (movies: RecommendationMovieDetail[], excludeIds: number[] = [], size = profilePrefs.recommendationBatchSize) =>
      ensureRecommendationBatch(movies, {
        excludeIds,
        platformIds: profilePrefs.preferredPlatforms,
        minRating: profilePrefs.minRating,
        excludedGenres: profilePrefs.excludedGenres,
        minMatchScore: profilePrefs.matchThreshold,
        searchTags,
        userCriteria: { mood: null, context: null, time: null },
        size,
        preloadMatchTexts: true,
        preloadProviders: true,
      }),
    [
      profilePrefs.excludedGenres,
      profilePrefs.minRating,
      profilePrefs.preferredPlatforms,
      profilePrefs.recommendationBatchSize,
      profilePrefs.matchThreshold,
      searchTags,
    ],
  );

  const openRecommendationBatch = useCallback(
    (movies: RecommendationMovieDetail[], origin: "home" | "external" = "home", startIndex = 0, seenMovieIds?: Set<number>, suggestionCount?: number) => {
      const safeStartIndex = Math.min(startIndex, Math.max(movies.length - 1, 0));
      const initialMovieId = movies[safeStartIndex]?.id;
      setResults(movies);
      setResultSuggestionCount(suggestionCount ?? movies.length ?? profilePrefs.recommendationBatchSize);
      setCurrentResultIndex(safeStartIndex);
      setResultIndexHistory([]);
      setResultSeenMovieIds(
        seenMovieIds && seenMovieIds.size > 0 ? new Set(seenMovieIds) : new Set(initialMovieId ? [initialMovieId] : []),
      );
      setBatchRejectedIds(new Set());
      setResultOrigin(origin);
      setStep("result");

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
            const first = movies[safeStartIndex];
            if (first && !loggedEventsRef.current.has(first.id)) {
              loggedEventsRef.current.add(first.id);
              logRecommendationEvent({
                session_id: id,
                tmdb_id: first.id,
                title: first.title || first.name || "",
                rank_position: safeStartIndex + 1,
                source: "solo_session",
              }).catch(() => {});
            }
          })
          .catch(() => setCurrentSessionId(null));
      } else {
        setCurrentSessionId(null);
      }
    },
    [user, profilePrefs.excludedGenres, profilePrefs.minRating, profilePrefs.preferredPlatforms, profilePrefs.recommendationBatchSize],
  );

  useEffect(() => {
    if (step !== "result" || !currentSessionId) return;
    const m = results[currentResultIndex];
    if (!m || loggedEventsRef.current.has(m.id)) return;
    loggedEventsRef.current.add(m.id);
    logRecommendationEvent({
      session_id: currentSessionId,
      tmdb_id: m.id,
      title: m.title || m.name || "",
      rank_position: currentResultIndex + 1,
      source: "solo_session",
    }).catch(() => {});
  }, [step, currentSessionId, results, currentResultIndex]);

  useEffect(() => {
    const state = (location.state as any) || {};

    if (state.openTrainer) {
      setOpenTrainerOnMount(true);
      window.history.replaceState({}, "", "/app");
    }

    if (state.selectedMovie) {
      const movie = state.selectedMovie as MovieDetail;
      normalizeRecommendationBatch([movie], [movie.id])
        .then((batch) => openRecommendationBatch(batch, "external"))
        .catch(() => openRecommendationBatch([movie], "external"));
      window.history.replaceState({}, "", "/app");
    }
  }, [location.state, normalizeRecommendationBatch, openRecommendationBatch]);

  const loadChatMovie = useCallback(() => {
    const stored = sessionStorage.getItem("pick-fab-movie");
    if (stored) {
      try {
        const movie = JSON.parse(stored) as MovieDetail;
        normalizeRecommendationBatch([movie], [movie.id])
          .then((batch) => openRecommendationBatch(batch, "external"))
          .catch(() => openRecommendationBatch([movie], "external"));
      } catch {
        /* ignore */
      }
      sessionStorage.removeItem("pick-fab-movie");
    }
    window.history.replaceState({}, "", "/app");
  }, [normalizeRecommendationBatch, openRecommendationBatch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "pick-chat") {
      loadChatMovie();
    }
    const handler = () => loadChatMovie();
    window.addEventListener("pick-chat-movie", handler);
    return () => window.removeEventListener("pick-chat-movie", handler);
  }, [loadChatMovie]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select(
        "onboarding_completed, preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, profile_confidence, tour_completed, activation_completed, default_recommendation_count, match_threshold",
      )
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) {
          navigate("/onboarding");
          return;
        }
        if (data) {
          const recommendationBatchSize = Math.min(
            Math.max((data as any).default_recommendation_count || RECOMMENDATION_BATCH_SIZE, 1),
            10,
          );
          setProfilePrefs({
            excludedGenres: (data as any).excluded_genres || [],
            excludedPlatforms: (data as any).excluded_platforms || [],
            minRating: (data as any).min_rating || 0,
            preferredPlatforms: data.preferred_platforms || [],
            profileConfidence: (data as any).profile_confidence || 0,
            recommendationBatchSize,
            matchThreshold: (data as any).match_threshold ?? 80,
          });
          setResultSuggestionCount(recommendationBatchSize);

          const tourDone = (data as any).tour_completed;
          const activationDone = (data as any).activation_completed;
          const forceTour = sessionStorage.getItem("pick_force_tour") === "1";
          const fromOnboarding = Boolean((location.state as any)?.showTour || forceTour);

          if (!tourDone && fromOnboarding) {
            setShowActivation(false);
            setShowTour(true);
            sessionStorage.removeItem("pick_force_tour");
          } else if (!activationDone) {
            supabase
              .from("user_interactions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .then(({ count }) => {
                if (count && count >= 20) {
                  supabase
                    .from("profiles")
                    .update({ activation_completed: true } as any)
                    .eq("id", user.id);
                } else {
                  setShowTour(false);
                  setShowActivation(true);
                }
              });
          }

          setProfileLoaded(true);
        }
      });
  }, [user, navigate, location.state]);

  const handleTourComplete = async () => {
    setShowTour(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ tour_completed: true } as any)
        .eq("id", user.id);
    }
    setShowActivation(true);
  };

  const invokeSurprisePersonalized = async (body: any, retries = 2): Promise<any> => {
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
  };

  const triggerSurpriseForMission = useCallback(async () => {
    setLoading(true);
    try {
      const [liked, tasteProfile, multiVec] = user
        ? await Promise.all([getLikedMovies(), getUserTasteProfile(), computeMultiVectorProfile(user.id)])
        : [[], null, null] as const;
      const excludeIds = [...results.map((r: RecommendationMovieDetail) => r.id), ...((tasteProfile as any)?.excludeIds || [])];
      let batch: RecommendationMovieDetail[] = [];

      if (user && liked.length >= 2) {
        const confidenceScore = tasteProfile?.confidence?.score ?? profilePrefs.profileConfidence ?? 50;
        const explorationLevel = confidenceScore >= 70 ? 3 : confidenceScore >= 40 ? 5 : 7;
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
          count: profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE,
        });
        // Extract movies and ensure we have at least the requested count
        let extracted = extractRecommendationMovies(data);
        const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
        if ((extracted?.length || 0) < desiredCount) {
          extracted = await ensureRecommendationBatch(extracted, {
            excludeIds,
            platformIds: profilePrefs.preferredPlatforms,
            minRating: profilePrefs.minRating,
            excludedGenres: profilePrefs.excludedGenres,
            minMatchScore: profilePrefs.matchThreshold,
            size: desiredCount,
            preloadMatchTexts: true,
          });
        }
        batch = await normalizeRecommendationBatch(extracted, excludeIds, desiredCount);
      } else {
        batch = await normalizeRecommendationBatch([], excludeIds);
      }

      openRecommendationBatch(batch, "home", 0, undefined, profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [
    normalizeRecommendationBatch,
    openRecommendationBatch,
    profilePrefs.excludedGenres,
    profilePrefs.excludedPlatforms,
    profilePrefs.minRating,
    profilePrefs.preferredPlatforms,
    profilePrefs.recommendationBatchSize,
    profilePrefs.matchThreshold,
    results,
    user,
  ]);

  const handleActivationMission = (missionId: MissionId) => {
    setActiveActivationMission(missionId);
    switch (missionId) {
      case "train_20":
        setOpenTrainerOnMount(true);
        break;
      case "first_reco":
        break;
      case "talk_to_pick":
        setStep("home");
        setResults([]);
        setCurrentResultIndex(0);
        setShowChat(false);
        setChatInitialMessages(undefined);
        setOpenTrainerOnMount(false);
        setTimeout(() => setTalkToPickGuideStep("open-chat"), 400);
        break;
      case "watchlist_3":
        setStep("home");
        setResults([]);
        setCurrentResultIndex(0);
        setShowChat(false);
        setChatInitialMessages(undefined);
        setOpenTrainerOnMount(false);
        setWatchlistGuideStep("sauvegarder");
        break;
      default:
        break;
    }
  };

  const handleActivationComplete = async () => {
    setShowActivation(false);
    setActiveActivationMission(null);
    if (user) {
      await supabase
        .from("profiles")
        .update({ activation_completed: true } as any)
        .eq("id", user.id);
    }
  };

  const handleStart = () => {};

  const handleSurprise = async (movies: MovieDetail[], startIndex: number = 0, seenMovieIds?: Set<number>) => {
    const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
    const tasteProfile = user ? await getUserTasteProfile() : null;
    const excludeIds = [...movies.map((m) => m.id), ...(tasteProfile?.excludeIds ?? [])];
    const batch = await normalizeRecommendationBatch(movies, excludeIds, desiredCount);
    openRecommendationBatch(batch, "home", startIndex, seenMovieIds, desiredCount);
  };

  const handleMovieSelect = async (movie: MovieDetail) => {
    const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
    const batch = await normalizeRecommendationBatch([movie], [movie.id], desiredCount);
    openRecommendationBatch(batch, "home", 0, undefined, desiredCount);
  };

  const handleOpenChat = () => {
    setChatInitialMessages(undefined);
    setShowChat(true);
    if (activeActivationMission === "talk_to_pick") {
      setTimeout(() => setTalkToPickGuideStep("mic"), 250);
    }
  };

  const handleCloseChat = () => setShowChat(false);

  const handleRefineWithVoice = () => {
    const currentMovie = results[currentResultIndex];
    if (!currentMovie) return;
    setChatInitialMessages([
      {
        role: "assistant",
        content: `Je t'ai recommandé **${getDisplayTitle(currentMovie)}**. Dis-moi ce qui ne te convient pas et je te trouverai quelque chose de mieux !`,
      },
    ]);
    setShowChat(true);
  };

  const handleMovieSuggested = async (movies: MovieDetail[], recapTags?: string[]) => {
    if (activeActivationMission === "talk_to_pick" && showActivation && user) {
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("daily_usage")
        .upsert({ user_id: user.id, usage_date: today, chat_count: 1 }, { onConflict: "user_id,usage_date" });
      setTalkToPickGuideStep(null);
      setShowChat(false);
      setActiveActivationMission(null);
      setStep("home");
      return;
    }

    if (recapTags && recapTags.length > 0) setSearchTags(recapTags);
    setShowChat(false);
    const batch = await normalizeRecommendationBatch(movies);
    setChatSuggestedMovies(batch);
    setChatSuggestedSeenMovieIds(new Set(batch[0] ? [batch[0].id] : []));
    setStep("home");
  };

  const handleShowAnother = async (rejectReason?: string, rejectedMovie?: MovieDetail) => {
    if (watchlistGuideStep === "autre-suggestion") {
      setWatchlistGuideStep(null);
      watchlistGuideAwaitingLoad.current = true;
    }

    const currentMovie = results[currentResultIndex];
    if (currentMovie && !rejectReason) {
      trackInteraction(currentMovie.id, "skipped", {});
    }
    if (currentMovie && user) recordSkippedRecommendation(user.id);

    setLoading(true);
    try {
      const tasteProfile = await getUserTasteProfile();
      const excludeIds = [...results.map((r) => r.id), ...(tasteProfile?.excludeIds || [])];
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
      if (user) {
        const liked = await getLikedMovies();
        if (liked.length >= 2) {
          const multiVec = await computeMultiVectorProfile(user.id);
          const confidenceScore = tasteProfile?.confidence?.score ?? profilePrefs.profileConfidence ?? 50;
          const explorationLevel = confidenceScore >= 70 ? 3 : confidenceScore >= 40 ? 5 : 7;
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
          let extracted = extractRecommendationMovies(data);
          const desiredCount = profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE;
          if ((extracted?.length || 0) < desiredCount) {
            extracted = await ensureRecommendationBatch(extracted, {
              excludeIds,
              platformIds: profilePrefs.preferredPlatforms,
              minRating: profilePrefs.minRating,
              excludedGenres: profilePrefs.excludedGenres,
              minMatchScore: profilePrefs.matchThreshold,
              size: desiredCount,
              preloadMatchTexts: true,
            });
          }
          batch = await normalizeRecommendationBatch(extracted, excludeIds, desiredCount);
        } else {
          batch = await normalizeRecommendationBatch([], excludeIds);
        }
      } else {
        batch = await normalizeRecommendationBatch([], excludeIds);
      }

      setResults(batch);
      setResultSuggestionCount(profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE);
      setCurrentResultIndex(0);
      setResultIndexHistory([]);
      setResultSeenMovieIds(new Set(batch[0] ? [batch[0].id] : []));
      setBatchRejectedIds(new Set());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      setStep("home");
      setResults([]);
      setResultSuggestionCount(profilePrefs.recommendationBatchSize);
      setCurrentResultIndex(0);
      setResultIndexHistory([]);
      setSearchTags([]);
      setShowChat(false);
      setChatInitialMessages(undefined);
      setChatSuggestedMovies(null);
      setChatSuggestedSeenMovieIds(new Set());
    };
    window.addEventListener("pick-reset-home", handler);
    return () => window.removeEventListener("pick-reset-home", handler);
  }, [profilePrefs.recommendationBatchSize]);

  const handleRemoveTag = (tag: string) => {
    setSearchTags((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        {step === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`absolute inset-0 ${showActivation && !showTour ? "pt-12" : ""} pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
          >
            <HomeScreen
              onStart={handleStart}
              onOpenChat={handleOpenChat}
              onSurprise={handleSurprise}
              onMovieSelect={handleMovieSelect}
              loading={loading}
              openTrainerOnMount={openTrainerOnMount}
              forceCloseTrainer={activeActivationMission === "talk_to_pick"}
              onTrainerOpened={() => setOpenTrainerOnMount(false)}
              chatSuggestedMovies={chatSuggestedMovies}
              chatSuggestedStartIndex={chatSuggestedStartIndex}
              chatSuggestedSeenMovieIds={chatSuggestedSeenMovieIds}
              onChatSuggestedConsumed={() => {
                setChatSuggestedMovies(null);
                setChatSuggestedStartIndex(0);
                setChatSuggestedSeenMovieIds(new Set());
              }}
              activationTrainerMode={activeActivationMission === "train_20"}
              onActivationTrainingComplete={async () => {
                window.dispatchEvent(new Event("pick-activation-refresh"));
                setActiveActivationMission(null);
                setOpenTrainerOnMount(false);
              }}
            />
          </motion.div>
        )}

        {step === "result" && results.length > 0 && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <ResultScreen
              sessionId={currentSessionId}
              onFeedback={(type, m) => {
                if ((type === "love" || type === "like") && currentSessionId) {
                  completeSession(currentSessionId, m.id, {
                    title: m.title || m.name || "",
                    poster_path: m.poster_path || null,
                    media_type: m.first_air_date ? "tv" : "movie",
                  }).catch(() => {});
                  setCurrentSessionId(null);
                }
              }}
              movie={results[currentResultIndex]}
              onShowAnother={handleShowAnother}
              onRestart={() => {
                if (resultIndexHistory.length > 0) {
                  const prev = resultIndexHistory[resultIndexHistory.length - 1];
                  setResultIndexHistory((h) => h.slice(0, -1));
                  setCurrentResultIndex(prev);
                } else if (resultOrigin === "external") {
                  navigate(-1);
                } else {
                  if (results.length > 0) {
                    setChatSuggestedStartIndex(currentResultIndex);
                    setChatSuggestedMovies(results);
                    setChatSuggestedSeenMovieIds(new Set(resultSeenMovieIds));
                  }
                  setStep("home");
                }
              }}
              onRefineWithVoice={handleRefineWithVoice}
              onRefineWithMessage={async (message) => {
                const currentMovie = results[currentResultIndex];
                if (!currentMovie) return;
                const shortLabel = message.replace(/^(Je veux |Je préfère |Montre-moi )/i, "").toLowerCase();
                setSearchTags((prev) => (prev.includes(shortLabel) ? prev : [...prev, shortLabel]));
                setLoading(true);
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
                      isPremium: pickPlus.isPremium,
                      minRating: profilePrefs.minRating,
                      excludedGenres: profilePrefs.excludedGenres,
                      timeContext: getTimeContextForPrompt(),
                    },
                  });
                  if (error) throw error;
                  const newMovies = extractRecommendationMovies(data);
                  if (newMovies.length > 0) {
                    if (data.recap?.length > 0)
                      setSearchTags((prev) => {
                        const merged = [...prev];
                        data.recap.forEach((t: string) => {
                          if (!merged.includes(t)) merged.push(t);
                        });
                        return merged;
                      });
                    const batch = await normalizeRecommendationBatch(
                      newMovies,
                      results.map((result) => result.id),
                      profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE,
                    );
                    setResults(batch);
                    setResultSuggestionCount(profilePrefs.recommendationBatchSize || RECOMMENDATION_BATCH_SIZE);
                    setCurrentResultIndex(0);
                    setResultIndexHistory([]);
                    setResultSeenMovieIds(new Set(batch[0] ? [batch[0].id] : []));
                    setBatchRejectedIds(new Set());
                  }
                } catch (e) {
                  console.error("Refine error:", e);
                } finally {
                  setLoading(false);
                  setLoadingMessage("");
                }
              }}
              hasMore={currentResultIndex < results.length - 1}
              userCriteria={{ mood: null, context: null, time: null }}
              searchTags={searchTags}
              onRemoveTag={handleRemoveTag}
              refining={loading}
              profileConfidence={profilePrefs.profileConfidence}
              alternativeMovies={results.filter((_, i) => i !== currentResultIndex).slice(0, 2)}
              recommendationBatch={results}
              suggestionCount={resultSuggestionCount}
              onSelectAlternative={(movie) => {
                const idx = results.findIndex((r) => r.id === movie.id);
                if (idx >= 0) {
                  setResultIndexHistory((h) => [...h, currentResultIndex]);
                  setCurrentResultIndex(idx);
                }
              }}
              currentIndex={currentResultIndex}
              totalCount={results.length}
              onNext={() => {
                if (currentResultIndex < results.length - 1) {
                  setResultIndexHistory((h) => [...h, currentResultIndex]);
                  setCurrentResultIndex((i) => i + 1);
                }
              }}
              onPrevious={() => {
                if (currentResultIndex > 0) {
                  setResultIndexHistory((h) => [...h, currentResultIndex]);
                  setCurrentResultIndex((i) => i - 1);
                }
              }}
              visitedMovieIds={resultSeenMovieIds}
              onVisitedMovieIdsChange={setResultSeenMovieIds}
              batchRejectedIds={batchRejectedIds}
              onBatchRejectedIdsChange={setBatchRejectedIds}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <VoiceChat
            onClose={handleCloseChat}
            onMovieSuggested={handleMovieSuggested}
            initialMessages={chatInitialMessages}
            showMicGuide={talkToPickGuideStep === "mic"}
          />
        )}
      </AnimatePresence>

      <PickPlusPaywall open={pickPlus.shouldShowPaywall} onClose={pickPlus.hidePaywall} trigger="reco_limit" />

      {showTour && <PlatformTour onComplete={handleTourComplete} />}
      {showActivation && !showTour && (
        <ActivationFlow
          onStartMission={handleActivationMission}
          onComplete={handleActivationComplete}
        />
      )}

      {watchlistGuideStep && (
        <WatchlistMissionGuide
          step={watchlistGuideStep}
          savedCount={watchlistSavedCount}
          target={3}
        />
      )}

      {talkToPickGuideStep && (
        <TalkToPickMissionGuide step={talkToPickGuideStep} />
      )}

      {loading && <RevealAnimation active message={loadingMessage || "Pick prépare tes recommandations…"} />}
    </div>
  );
};

export default Index;
