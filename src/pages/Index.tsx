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
import BrandHeader from "@/components/pick/BrandHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle } from "@/lib/tmdb";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { usePickPlus } from "@/hooks/use-pick-plus";
import { getTimeContextForPrompt } from "@/lib/time-context";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeUserTasteVector } from "@/lib/taste-engine";
import { extractRecommendationMovies, ensureRecommendationBatch } from "@/lib/recommendation-batch";
import { usePresenceTracker } from "@/hooks/use-presence";
import { createRecommendationSession, logRecommendationEvent, completeSession, abandonSession } from "@/lib/sessions";

type Step = "home" | "result";

const Index = () => {
  usePresenceTracker();
  const [step, setStep] = useState<Step>("home");
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [resultIndexHistory, setResultIndexHistory] = useState<number[]>([]);
  const [resultSeenMovieIds, setResultSeenMovieIds] = useState<Set<number>>(new Set());
  const [batchRejectedIds, setBatchRejectedIds] = useState<Set<number>>(new Set());
  const [resultOrigin, setResultOrigin] = useState<"home" | "external">("home");
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
  }>({ excludedGenres: [], excludedPlatforms: [], minRating: 0, preferredPlatforms: [], profileConfidence: 0 });
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pickPlus = usePickPlus();
  const [openTrainerOnMount, setOpenTrainerOnMount] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [activeActivationMission, setActiveActivationMission] = useState<MissionId | null>(null);
  const [watchlistGuideStep, setWatchlistGuideStep] = useState<WatchlistGuideStep>(null);
  const [watchlistSavedCount, setWatchlistSavedCount] = useState(0);
  const [talkToPickGuideStep, setTalkToPickGuideStep] = useState<TalkToPickGuideStep>(null);
  const watchlistGuideAwaitingLoad = useRef(false);
  const [chatSuggestedMovies, setChatSuggestedMovies] = useState<MovieDetail[] | null>(null);
  const [chatSuggestedStartIndex, setChatSuggestedStartIndex] = useState(0);

  const normalizeRecommendationBatch = useCallback(
    (movies: MovieDetail[], excludeIds: number[] = []) =>
      ensureRecommendationBatch(movies, {
        excludeIds,
        platformIds: profilePrefs.preferredPlatforms,
        minRating: profilePrefs.minRating,
        excludedGenres: profilePrefs.excludedGenres,
        searchTags,
        userCriteria: { mood: null, context: null, time: null },
      }),
    [profilePrefs.excludedGenres, profilePrefs.minRating, profilePrefs.preferredPlatforms, searchTags],
  );

  const openRecommendationBatch = useCallback(
    (movies: MovieDetail[], origin: "home" | "external" = "home", startIndex = 0, seenMovieIds?: Set<number>) => {
      const safeStartIndex = Math.min(startIndex, Math.max(movies.length - 1, 0));
      const initialMovieId = movies[safeStartIndex]?.id;
      setResults(movies);
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
    [user, profilePrefs.excludedGenres, profilePrefs.minRating, profilePrefs.preferredPlatforms],
  );

  useEffect(() => {
    if (step !== "result") return;
    const currentMovie = results[currentResultIndex];
    if (!currentMovie?.id) return;
    setResultSeenMovieIds((prev) => {
      if (prev.has(currentMovie.id)) return prev;
      const next = new Set(prev);
      next.add(currentMovie.id);
      return next;
    });
  }, [step, results, currentResultIndex]);

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

  const handleShowAnother = async (rejectReason?: string, rejectedMovie?: MovieDetail) => {
    if (watchlistGuideStep === "autre-suggestion") {
      setWatchlistGuideStep(null);
      watchlistGuideAwaitingLoad.current = true;
    }

    const currentMovie = results[currentResultIndex];
    if (currentMovie && !rejectReason) trackInteraction(currentMovie.id, "skipped", {});
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

      let batch: MovieDetail[] = [];
      if (user) {
        const liked = await getLikedMovies();
        if (liked.length >= 2) {
          const userTasteVector = await computeUserTasteVector(user.id);
          const { data } = await supabase.functions.invoke("surprise-personalized", {
            body: {
              likedMovies: liked,
              userTasteVector,
              tasteProfile,
              platformIds: profilePrefs.preferredPlatforms,
              excludedPlatformIds: profilePrefs.excludedPlatforms,
              excludedGenres: profilePrefs.excludedGenres,
              minRating: profilePrefs.minRating,
              excludeIds,
              rejectionContext,
              count: 5,
            },
          });
          batch = await normalizeRecommendationBatch(extractRecommendationMovies(data), excludeIds);
        } else {
          batch = await normalizeRecommendationBatch([], excludeIds);
        }
      } else {
        batch = await normalizeRecommendationBatch([], excludeIds);
      }

      setResults(batch);
      setCurrentResultIndex(0);
      setResultIndexHistory([]);
      setResultSeenMovieIds(new Set(batch[0] ? [batch[0].id] : []));
      setBatchRejectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BrandHeader />
      <AnimatePresence mode="wait">
        {step === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${showActivation && !showTour ? "pt-12" : ""} pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
          >
            <HomeScreen
              onStart={() => {}}
              onOpenChat={() => setShowChat(true)}
              onSurprise={async (movies: MovieDetail[], startIndex = 0, seenMovieIds?: Set<number>) => {
                const batch = await normalizeRecommendationBatch(movies);
                openRecommendationBatch(batch, "home", startIndex, seenMovieIds);
              }}
              onMovieSelect={async (movie: MovieDetail) => {
                const batch = await normalizeRecommendationBatch([movie], [movie.id]);
                openRecommendationBatch(batch, "home");
              }}
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
            className="absolute inset-0"
          >
            <ResultScreen
              sessionId={currentSessionId}
              recommendationBatch={results}
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
                    const batch = await normalizeRecommendationBatch(
                      newMovies,
                      results.map((result) => result.id),
                    );
                    setResults(batch);
                    setCurrentResultIndex(0);
                    setResultIndexHistory([]);
                    setResultSeenMovieIds(new Set(batch[0] ? [batch[0].id] : []));
                    setBatchRejectedIds(new Set());
                  }
                } finally {
                  setLoading(false);
                  setLoadingMessage("");
                }
              }}
              hasMore={currentResultIndex < results.length - 1}
              userCriteria={{ mood: null, context: null, time: null }}
              searchTags={searchTags}
              onRemoveTag={(tag) => setSearchTags((prev) => prev.filter((t) => t !== tag))}
              refining={loading}
              profileConfidence={profilePrefs.profileConfidence}
              alternativeMovies={results.filter((_, i) => i !== currentResultIndex).slice(0, 2)}
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
            onClose={() => setShowChat(false)}
            onMovieSuggested={async (movies: MovieDetail[], recapTags?: string[]) => {
              if (recapTags && recapTags.length > 0) setSearchTags(recapTags);
              setShowChat(false);
              const batch = await normalizeRecommendationBatch(movies);
              setChatSuggestedMovies(batch);
              setChatSuggestedSeenMovieIds(new Set(batch[0] ? [batch[0].id] : []));
              setStep("home");
            }}
            initialMessages={chatInitialMessages}
            showMicGuide={talkToPickGuideStep === "mic"}
          />
        )}
      </AnimatePresence>

      <PickPlusPaywall open={pickPlus.shouldShowPaywall} onClose={pickPlus.hidePaywall} trigger="reco_limit" />
      {showTour && <PlatformTour onComplete={async () => setShowTour(false)} />}
      {showActivation && !showTour && (
        <ActivationFlow onStartMission={setActiveActivationMission} onComplete={async () => setShowActivation(false)} />
      )}
      {watchlistGuideStep && (
        <WatchlistMissionGuide step={watchlistGuideStep} savedCount={watchlistSavedCount} target={3} />
      )}
      {talkToPickGuideStep && <TalkToPickMissionGuide step={talkToPickGuideStep} />}
      {loading && <RevealAnimation active message={loadingMessage || "Pick prépare tes recommandations…"} />}
    </div>
  );
};

export default Index;
