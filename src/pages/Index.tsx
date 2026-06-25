import { useReducer, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { peekForReveal } from "@/lib/event-reveal";
import HomeScreen from "@/components/pick/HomeScreen";
import ResultScreen from "@/components/pick/ResultScreen";
import VoiceChat from "@/components/pick/VoiceChat";
import MoodVoiceSheet from "@/components/pick/MoodVoiceSheet";
import RevealAnimation from "@/components/pick/RevealAnimation";
import PlatformTour from "@/components/pick/PlatformTour";
import ActivationFlow from "@/components/pick/ActivationFlow";
import WatchlistMissionGuide from "@/components/pick/WatchlistMissionGuide";
import TalkToPickMissionGuide from "@/components/pick/TalkToPickMissionGuide";
import type { ChatMessage } from "@/components/pick/VoiceChat";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayTitle } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";
import type { RecommendationMovieDetail } from "@/lib/recommendation-batch";
import { usePickPlus } from "@/hooks/use-pick-plus";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import { usePresenceTracker } from "@/hooks/use-presence";

import { indexReducer, initialIndexState, resolveSetUpdater } from "./index/reducer";
import { useProfilePrefs } from "./index/use-profile-prefs";
import { useRecommendationEngine } from "./index/use-recommendation-engine";
import { useOverlayOrchestrator } from "./index/use-overlay-orchestrator";
import { useExternalBridges } from "./index/use-external-bridges";
import { getRevealEvent, clearRevealEvent } from "@/lib/event-reveal";
import { setAppChromeTabBarHidden } from "@/lib/app-chrome";

const Index = () => {
  usePresenceTracker();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRevealEntry = !!(
    (location.state as { revealPending?: boolean } | null)?.revealPending && peekForReveal()
  );
  const pickPlus = usePickPlus();

  const [state, dispatch] = useReducer(indexReducer, initialIndexState);
  const [revealEventId, setRevealEventId] = useState<string | null>(null);

  const { profilePrefs, showTour, showActivation, setShowTour, setShowActivation } = useProfilePrefs({
    user,
    onRecommendationBatchSizeChange: (size) => dispatch({ type: "SET_SUGGESTION_COUNT", count: size }),
  });

  const engine = useRecommendationEngine({
    user,
    state,
    dispatch,
    profilePrefs,
    pickPlusIsPremium: pickPlus.isPremium,
  });

  const overlays = useOverlayOrchestrator({
    user,
    dispatch,
    recommendationBatchSize: profilePrefs.recommendationBatchSize,
    setShowActivation,
    setShowTour,
  });

  useExternalBridges({
    dispatch,
    recommendationBatchSize: profilePrefs.recommendationBatchSize,
    normalizeRecommendationBatch: engine.normalizeRecommendationBatch,
    openRecommendationBatch: engine.openRecommendationBatch,
    abandonCurrentSession: engine.abandonCurrentSession,
    onOpenTrainerOnMount: () => overlays.setOpenTrainerOnMount(true),
  });

  // Capture le revealEventId quand le pipeline soirée démarre (singleton event-reveal)
  useEffect(() => {
    if (state.step === "result") {
      const reveal = getRevealEvent();
      if (reveal) {
        setRevealEventId(reveal.eventId);
        clearRevealEvent();
      }
    } else if (state.step === "home") {
      setRevealEventId(null);
    }
  }, [state.step]);

  useEffect(() => {
    setAppChromeTabBarHidden("result-screen", state.step === "result");
    return () => setAppChromeTabBarHidden("result-screen", false);
  }, [state.step]);

  // ─── Composition handlers (need both engine + overlay context) ───

  const [showMoodCapture, setShowMoodCapture] = useState(false);

  const handleOpenChat = () => {
    dispatch({ type: "OPEN_CHAT", initialMessages: undefined });
    if (overlays.activeActivationMission === "talk_to_pick") {
      setTimeout(() => overlays.setTalkToPickGuideStep("mic"), 250);
    }
  };

  const handleCloseChat = () => dispatch({ type: "CLOSE_CHAT" });

  const handleRefineWithVoice = () => {
    const currentMovie = state.results[state.currentResultIndex];
    if (!currentMovie) return;
    const initial: ChatMessage[] = [
      {
        role: "assistant",
        content: `Je t'ai recommandé **${getDisplayTitle(currentMovie)}**. Dis-moi ce qui ne te convient pas et je te trouverai quelque chose de mieux !`,
      },
    ];
    dispatch({ type: "OPEN_CHAT", initialMessages: initial });
  };

  const handleMovieSuggested = async (movies: MovieDetail[], recapTags?: string[]) => {
    // Talk-to-Pick mission: just mark usage, close, and return to home (no batch).
    if (overlays.activeActivationMission === "talk_to_pick" && showActivation && user) {
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("daily_usage")
        .upsert({ user_id: user.id, usage_date: today, chat_count: 1 }, { onConflict: "user_id,usage_date" });
      overlays.setTalkToPickGuideStep(null);
      dispatch({ type: "CLOSE_CHAT" });
      overlays.setActiveActivationMission(null);
      dispatch({ type: "SET_STEP_HOME" });
      return;
    }

    if (recapTags && recapTags.length > 0) dispatch({ type: "SET_SEARCH_TAGS", tags: recapTags });
    dispatch({ type: "CLOSE_CHAT" });
    engine.setLoading(true);
    engine.setLoadingMessage("Pick cherche ton film…");
    try {
      const desiredCount = profilePrefs.recommendationBatchSize || 5;
      const raw = movies as RecommendationMovieDetail[];
      if (raw.length > 0) {
        // Passer par normalizeRecommendationBatch pour le scoring movie-match + providers
        const batch = await engine.normalizeRecommendationBatch(raw, [], desiredCount);
        engine.openRecommendationBatch(batch.length > 0 ? batch : raw, "home", 0, undefined, desiredCount);
      } else {
        dispatch({ type: "SET_STEP_HOME" });
      }
    } catch (e) {
      console.error("[voice] handleMovieSuggested error:", e);
      toast.error("Impossible de charger la suggestion vocale.");
      dispatch({ type: "SET_STEP_HOME" });
    } finally {
      engine.setLoading(false);
      engine.setLoadingMessage("");
    }
  };

  // Wrapper for ResultScreen setState-style handlers (it may pass updater functions).
  const setVisitedMovieIds = (updater: Set<number> | ((p: Set<number>) => Set<number>)) =>
    dispatch({ type: "SET_VISITED", ids: resolveSetUpdater(updater, state.resultSeenMovieIds) });
  const setBatchRejectedIds = (updater: Set<number> | ((p: Set<number>) => Set<number>)) =>
    dispatch({ type: "SET_BATCH_REJECTED", ids: resolveSetUpdater(updater, state.batchRejectedIds) });

  return (
    <div className="fixed inset-0 bg-background overflow-x-hidden">
      <AnimatePresence mode="wait">
        {state.step === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: isRevealEntry ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: isRevealEntry ? 0 : 0.4 }}
            className={`absolute inset-0 ${showActivation && !showTour ? "pt-12" : ""} pb-[calc(5rem+env(safe-area-inset-bottom))]`}
          >
            <HomeScreen
              onStart={() => {}}
              onOpenChat={handleOpenChat}
              onOpenMoodCapture={() => setShowMoodCapture(true)}
              onSurprise={engine.handleSurprise}
              onMovieSelect={engine.handleMovieSelect}
              loading={engine.loading}
              openTrainerOnMount={overlays.openTrainerOnMount}
              forceCloseTrainer={overlays.activeActivationMission === "talk_to_pick"}
              onTrainerOpened={() => overlays.setOpenTrainerOnMount(false)}
              chatSuggestedMovies={state.chatSuggestedMovies}
              chatSuggestedStartIndex={state.chatSuggestedStartIndex}
              chatSuggestedSeenMovieIds={state.chatSuggestedSeenMovieIds}
              onChatSuggestedConsumed={() => dispatch({ type: "CONSUME_CHAT_SUGGESTIONS" })}
              activationTrainerMode={overlays.activeActivationMission === "train_20"}
              onActivationTrainingComplete={async () => {
                window.dispatchEvent(new Event("pick-activation-refresh"));
                overlays.setActiveActivationMission(null);
                overlays.setOpenTrainerOnMount(false);
              }}
            />
          </motion.div>
        )}

        {state.step === "result" && state.results.length > 0 && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <ResultScreen
              sessionId={engine.currentSessionId}
              onFeedback={(type, m) => {
                if (type === "love" || type === "like") engine.completeSessionForMovie(m);
              }}
              movie={state.results[state.currentResultIndex]}
              onShowAnother={(reason, rejectedMovie) =>
                engine.handleShowAnother(reason, rejectedMovie, () => {
                  if (overlays.watchlistGuideStep === "autre-suggestion") {
                    overlays.setWatchlistGuideStep(null);
                  }
                })
              }
              onRestart={() => {
                if (state.resultIndexHistory.length > 0) {
                  dispatch({ type: "GO_TO_INDEX", index: state.resultIndexHistory[state.resultIndexHistory.length - 1] });
                } else if (state.resultOrigin === "external") {
                  navigate(-1);
                } else {
                  if (state.results.length > 0) {
                    dispatch({
                      type: "GO_HOME_PRESERVE_CHAT_SUGGESTIONS",
                      movies: state.results,
                      startIndex: state.currentResultIndex,
                      seenMovieIds: state.resultSeenMovieIds,
                    });
                  } else {
                    dispatch({ type: "SET_STEP_HOME" });
                  }
                }
              }}
              onRefineWithVoice={handleRefineWithVoice}
              onRefineWithMessage={engine.handleRefineWithMessage}
              hasMore={state.currentResultIndex < state.results.length - 1}
              userCriteria={{ mood: null, context: null, time: null }}
              searchTags={state.searchTags}
              onRemoveTag={(tag) => dispatch({ type: "REMOVE_TAG", tag })}
              refining={engine.loading}
              profileConfidence={profilePrefs.profileConfidence}
              alternativeMovies={state.results.filter((_, i) => i !== state.currentResultIndex).slice(0, 2)}
              recommendationBatch={state.results}
              suggestionCount={state.resultSuggestionCount}
              onSelectAlternative={(movie) => {
                const idx = state.results.findIndex((r) => r.id === movie.id);
                if (idx >= 0) dispatch({ type: "GO_TO_INDEX", index: idx });
              }}
              currentIndex={state.currentResultIndex}
              totalCount={state.results.length}
              onNext={() => dispatch({ type: "NEXT" })}
              onPrevious={() => dispatch({ type: "PREV" })}
              visitedMovieIds={state.resultSeenMovieIds}
              onVisitedMovieIdsChange={setVisitedMovieIds}
              batchRejectedIds={state.batchRejectedIds}
              onBatchRejectedIdsChange={setBatchRejectedIds}
              revealEventId={revealEventId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.showChat && (
          <VoiceChat
            onClose={handleCloseChat}
            onMovieSuggested={handleMovieSuggested}
            onSearchIntent={engine.handleVoiceSearchIntent}
            initialMessages={state.chatInitialMessages}
            showMicGuide={overlays.talkToPickGuideStep === "mic"}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMoodCapture && (
          <MoodVoiceSheet
            autoStart
            onClose={() => setShowMoodCapture(false)}
            onSearchIntent={(filters, recap) => {
              setShowMoodCapture(false);
              engine.handleVoiceSearchIntent(filters, recap);
            }}
          />
        )}
      </AnimatePresence>

      <PickPlusPaywall open={pickPlus.shouldShowPaywall} onClose={pickPlus.hidePaywall} trigger="reco_limit" />

      {showTour && <PlatformTour onComplete={overlays.handleTourComplete} />}
      {showActivation && !showTour && (
        <ActivationFlow
          onStartMission={overlays.handleActivationMission}
          onComplete={overlays.handleActivationComplete}
        />
      )}

      {overlays.watchlistGuideStep && (
        <WatchlistMissionGuide
          step={overlays.watchlistGuideStep}
          savedCount={overlays.watchlistSavedCount}
          target={3}
        />
      )}

      {overlays.talkToPickGuideStep && (
        <TalkToPickMissionGuide step={overlays.talkToPickGuideStep} />
      )}

      {engine.loading && (
        <RevealAnimation
          active
          message={engine.loadingMessage || "Pick prépare tes recommandations…"}
          dynamicAnecdotes={engine.dynamicAnecdotes.length > 0 ? engine.dynamicAnecdotes : undefined}
        />
      )}
    </div>
  );
};

export default Index;
