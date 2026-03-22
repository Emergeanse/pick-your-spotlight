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
import { getDisplayTitle } from "@/lib/tmdb";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { usePickPlus } from "@/hooks/use-pick-plus";
import { getTimeContextForPrompt } from "@/lib/time-context";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeUserTasteVector } from "@/lib/taste-engine";
import { extractRecommendationMovies, ensureRecommendationBatch } from "@/lib/recommendation-batch";
import { usePresenceTracker } from "@/hooks/use-presence";

type Step = "home" | "result";

const Index = () => {
  usePresenceTracker();
  const [step, setStep] = useState<Step>("home");
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [resultIndexHistory, setResultIndexHistory] = useState<number[]>([]);
  // Track where the result view originated from: "home" (internal), "external" (cross-page nav)
  const [resultOrigin, setResultOrigin] = useState<"home" | "external">("home");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  
  const [chatInitialMessages, setChatInitialMessages] = useState<ChatMessage[] | undefined>(undefined);
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

  // Activation flow states
  const [showTour, setShowTour] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [activeActivationMission, setActiveActivationMission] = useState<MissionId | null>(null);
  const [watchlistGuideStep, setWatchlistGuideStep] = useState<WatchlistGuideStep>(null);
  const [watchlistGuideDone, setWatchlistGuideDone] = useState(false);
  const [watchlistSavedCount, setWatchlistSavedCount] = useState(0);
  const [talkToPickGuideStep, setTalkToPickGuideStep] = useState<TalkToPickGuideStep>(null);
  const watchlistGuideAwaitingLoad = useRef(false);

  const resetToHomeView = () => {
    setStep("home");
    setResults([]);
    setCurrentResultIndex(0);
    setResultIndexHistory([]);
    setSearchTags([]);
    setShowChat(false);
    setChatInitialMessages(undefined);
    setChatSuggestedMovies(null);
  };

  const normalizeRecommendationBatch = useCallback(
    (movies: MovieDetail[], excludeIds: number[] = []) =>
      ensureRecommendationBatch(movies, {
        excludeIds,
        platformIds: profilePrefs.preferredPlatforms,
        minRating: profilePrefs.minRating,
        excludedGenres: profilePrefs.excludedGenres,
      }),
    [profilePrefs.excludedGenres, profilePrefs.minRating, profilePrefs.preferredPlatforms],
  );

  const openRecommendationBatch = useCallback(
    (movies: MovieDetail[], origin: "home" | "external" = "home", startIndex = 0) => {
      setResults(movies);
      setCurrentResultIndex(Math.min(startIndex, Math.max(movies.length - 1, 0)));
      setResultIndexHistory([]);
      setResultOrigin(origin);
      setStep("result");
    },
    [],
  );

  useEffect(() => {
    const state = (location.state as any) || {};

    if (state.openTrainer) {
      setOpenTrainerOnMount(true);
      window.history.replaceState({}, "", "/app");
    }

    // Handle selectedMovie from external pages (e.g. WatchlistRoute)
    if (state.selectedMovie) {
      const movie = state.selectedMovie as MovieDetail;
      setResults([movie]);
      setCurrentResultIndex(0);
      setResultOrigin("external");
      setStep("result");
      window.history.replaceState({}, "", "/app");
    }
  }, [location.state]);

  const loadChatMovie = useCallback(() => {
    const stored = sessionStorage.getItem("pick-fab-movie");
    if (stored) {
      try {
        const movie = JSON.parse(stored) as MovieDetail;
        setResults([movie]);
        setCurrentResultIndex(0);
        setResultOrigin("external");
        setStep("result");
      } catch { /* ignore */ }
      sessionStorage.removeItem("pick-fab-movie");
    }
    window.history.replaceState({}, "", "/app");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "pick-chat") {
      loadChatMovie();
    }
    const handler = () => loadChatMovie();
    window.addEventListener("pick-chat-movie", handler);
    return () => window.removeEventListener("pick-chat-movie", handler);
  }, [loadChatMovie]);

  // Load profile and determine tour/activation state
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarding_completed, preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, profile_confidence, tour_completed, activation_completed").eq("id", user.id).single()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) {
          navigate("/onboarding");
          return;
        }
        if (data) {
          setProfilePrefs({
            excludedGenres: (data as any).excluded_genres || [],
            excludedPlatforms: (data as any).excluded_platforms || [],
            minRating: (data as any).min_rating || 0,
            preferredPlatforms: data.preferred_platforms || [],
            profileConfidence: (data as any).profile_confidence || 0,
          });

          const tourDone = (data as any).tour_completed;
          const activationDone = (data as any).activation_completed;
          const forceTour = sessionStorage.getItem("pick_force_tour") === "1";
          const fromOnboarding = Boolean((location.state as any)?.showTour || forceTour);

          if (!tourDone && fromOnboarding) {
            // Fresh from onboarding — show the tour
            setShowActivation(false);
            setShowTour(true);
            sessionStorage.removeItem("pick_force_tour");
          } else if (!activationDone) {
            // Show activation for any user who hasn't completed it
            // But first check if they're a mature user who should auto-skip
            supabase.from("user_interactions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .then(({ count }) => {
                if (count && count >= 20) {
                  // Mature user — auto-complete activation
                  supabase.from("profiles").update({ activation_completed: true } as any).eq("id", user.id);
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
      await supabase.from("profiles").update({ tour_completed: true } as any).eq("id", user.id);
    }
    setShowActivation(true);
  };

  const triggerSurpriseForMission = useCallback(async () => {
    setLoading(true);
    try {
      const liked = user ? await getLikedMovies() : [];
      const excludeIds = results.map(r => r.id);
      if (user && liked.length >= 2) {
        const userTasteVector = await computeUserTasteVector(user.id);
        const tasteProfile = await getUserTasteProfile();
        const data = await invokeSurprisePersonalized({
          likedMovies: liked, userTasteVector, tasteProfile,
          platformIds: profilePrefs.preferredPlatforms,
          excludedPlatformIds: profilePrefs.excludedPlatforms,
          excludedGenres: profilePrefs.excludedGenres,
          minRating: profilePrefs.minRating,
          excludeIds,
          count: 5,
        });
        if (data?.movies && data.movies.length > 0) {
          setResults(data.movies.map((m: any) => m.movie));
          setCurrentResultIndex(0);
          setResultOrigin("home");
          setStep("result");
        } else if (data?.movie) {
          setResults([data.movie]);
          setCurrentResultIndex(0);
          setResultOrigin("home");
          setStep("result");
        }
      } else {
        const movie = await getSurpriseRecommendation(excludeIds, {
          platformIds: profilePrefs.preferredPlatforms,
          minRating: profilePrefs.minRating,
          excludedGenres: profilePrefs.excludedGenres,
        });
        setResults([movie]);
        setCurrentResultIndex(0);
        setResultOrigin("home");
        setStep("result");
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, results, profilePrefs]);

  const handleActivationMission = (missionId: MissionId) => {
    setActiveActivationMission(missionId);
    switch (missionId) {
      case "train_20":
        setOpenTrainerOnMount(true);
        break;
      case "first_reco":
        // User needs to use "Pick pour ce soir" — just close overlay, they'll see the button
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
        // Reset to home screen first, then start the guided flow
        setStep("home");
        setResults([]);
        setCurrentResultIndex(0);
        if (!watchlistGuideDone) {
          setTimeout(() => setWatchlistGuideStep("pick-ce-soir"), 400);
        }
        break;
      case "like_5":
        // Auto-trigger a recommendation so user lands on ResultScreen with like button
        triggerSurpriseForMission();
        break;
    }
  };

  // Advance watchlist guide when step changes to "result"
  useEffect(() => {
    if (watchlistGuideStep === "pick-ce-soir" && step === "result") {
      setWatchlistGuideStep("autre-suggestion");
    }
  }, [step, watchlistGuideStep]);

  // Listen for watchlist additions during the guide
  useEffect(() => {
    if (activeActivationMission !== "watchlist_3") return;
    const handler = () => {
      setWatchlistSavedCount(c => c + 1);
      if (!watchlistGuideDone) {
        setWatchlistGuideStep("continue");
        setWatchlistGuideDone(true);
        setTimeout(() => setWatchlistGuideStep(null), 4000);
      }
    };
    window.addEventListener("pick-watchlist-added", handler);
    return () => window.removeEventListener("pick-watchlist-added", handler);
  }, [activeActivationMission, watchlistGuideDone]);

  // Show "sauvegarder" step after new movie loads
  useEffect(() => {
    if (watchlistGuideAwaitingLoad.current && !loading && step === "result") {
      watchlistGuideAwaitingLoad.current = false;
      setTimeout(() => setWatchlistGuideStep("sauvegarder"), 500);
    }
  }, [loading, step]);

  const handleActivationComplete = () => {
    setShowActivation(false);
    setWatchlistGuideStep(null);
    // Reload pick plus state to pick up the trial
    window.location.reload();
  };

  const handleStart = () => {};

  const handleSurprise = (movies: MovieDetail[], startIndex: number = 0) => {
    setResults(movies);
    setCurrentResultIndex(startIndex);
    setResultOrigin("home");
    setStep("result");
  };

  const handleMovieSelect = (movie: MovieDetail) => {
    setResults([movie]);
    setCurrentResultIndex(0);
    setResultOrigin("home");
    setStep("result");
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
      { role: "assistant", content: `Je t'ai recommandé **${getDisplayTitle(currentMovie)}**. Dis-moi ce qui ne te convient pas et je te trouverai quelque chose de mieux !` },
    ]);
    setShowChat(true);
  };

  const [chatSuggestedMovies, setChatSuggestedMovies] = useState<MovieDetail[] | null>(null);

  const handleMovieSuggested = async (movies: MovieDetail[], recapTags?: string[]) => {
    // During "talk_to_pick" activation mission: record chat, close chat, skip result
    if (activeActivationMission === "talk_to_pick" && showActivation && user) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("daily_usage").upsert(
        { user_id: user.id, usage_date: today, chat_count: 1 },
        { onConflict: "user_id,usage_date" }
      );
      setTalkToPickGuideStep(null);
      setShowChat(false);
      setActiveActivationMission(null);
      setStep("home");
      return;
    }

    if (recapTags && recapTags.length > 0) setSearchTags(recapTags);
    setShowChat(false);
    // Show the tonight pick preview on HomeScreen instead of going to ResultScreen directly
    setChatSuggestedMovies(movies);
    setStep("home");
  };

  const invokeSurprisePersonalized = async (body: any, retries = 2): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });
    if (error) {
      const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
      if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
        return invokeSurprisePersonalized(body, retries - 1);
      }
      throw error;
    }
    return data;
  };

  const handleShowAnother = async (rejectReason?: string, rejectedMovie?: MovieDetail) => {
    // Advance watchlist guide
    if (watchlistGuideStep === "autre-suggestion") {
      setWatchlistGuideStep(null);
      watchlistGuideAwaitingLoad.current = true;
    }

    const currentMovie = results[currentResultIndex];
    if (currentMovie && !rejectReason) {
      trackInteraction(currentMovie.id, "skipped", {});
    }
    if (currentMovie && user) recordSkippedRecommendation(user.id);

    // "Autres suggestions" (no reject reason) or at end of list with reject: always fetch fresh batch
    setLoading(true);
    try {
      const tasteProfile = await getUserTasteProfile();
      const excludeIds = [...results.map(r => r.id), ...(tasteProfile?.excludeIds || [])];
      const rejectionContext = rejectReason && rejectedMovie ? {
        reason: rejectReason,
        rejectedGenres: (rejectedMovie.genres || []).map(g => g.name),
        rejectedTitle: getDisplayTitle(rejectedMovie),
        rejectedRating: rejectedMovie.vote_average,
        rejectedRuntime: rejectedMovie.runtime,
      } : undefined;

      if (user) {
        const liked = await getLikedMovies();
        if (liked.length >= 2) {
          const [userTasteVector] = await Promise.all([computeUserTasteVector(user.id)]);
          const data = await invokeSurprisePersonalized({
            likedMovies: liked, userTasteVector, tasteProfile,
            platformIds: profilePrefs.preferredPlatforms,
            excludedPlatformIds: profilePrefs.excludedPlatforms,
            excludedGenres: profilePrefs.excludedGenres,
            minRating: profilePrefs.minRating,
            excludeIds, rejectionContext,
            count: 5,
          });
          if (data?.movies && data.movies.length > 0) {
            const newMovies = data.movies.map((m: any) => m.movie);
            setResults(newMovies);
            setCurrentResultIndex(0);
            setResultIndexHistory([]);
          } else if (data?.movie) {
            setResults([data.movie]);
            setCurrentResultIndex(0);
            setResultIndexHistory([]);
          }
        } else {
          const movie = await getSurpriseRecommendation(excludeIds, {
            platformIds: profilePrefs.preferredPlatforms,
            minRating: profilePrefs.minRating,
            excludedGenres: profilePrefs.excludedGenres,
          });
          setResults([movie]);
          setCurrentResultIndex(0);
          setResultIndexHistory([]);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };


  // Listen for home tab re-tap to reset to homepage (kept as fallback)
  useEffect(() => {
    const handler = () => {
      setStep("home");
      setResults([]);
      setCurrentResultIndex(0);
      setResultIndexHistory([]);
      setSearchTags([]);
      setShowChat(false);
      setChatInitialMessages(undefined);
      setChatSuggestedMovies(null);
    };
    window.addEventListener("pick-reset-home", handler);
    return () => window.removeEventListener("pick-reset-home", handler);
  }, []);

  const handleRemoveTag = (tag: string) => {
    setSearchTags(prev => prev.filter(t => t !== tag));
  };

  

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        {step === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className={`absolute inset-0 ${showActivation && !showTour ? "pt-12" : ""} pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
          >
            <HomeScreen onStart={handleStart} onOpenChat={handleOpenChat} onSurprise={handleSurprise} onMovieSelect={handleMovieSelect} loading={loading} openTrainerOnMount={openTrainerOnMount} forceCloseTrainer={activeActivationMission === "talk_to_pick"} onTrainerOpened={() => setOpenTrainerOnMount(false)} chatSuggestedMovies={chatSuggestedMovies} onChatSuggestedConsumed={() => setChatSuggestedMovies(null)} activationTrainerMode={activeActivationMission === "train_20"} onActivationTrainingComplete={async () => {
              window.dispatchEvent(new Event("pick-activation-refresh"));
              setActiveActivationMission(null);
              setOpenTrainerOnMount(false);
            }} />
          </motion.div>
        )}

        {step === "result" && results.length > 0 && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0">
            <ResultScreen
              movie={results[currentResultIndex]}
              onShowAnother={handleShowAnother}
              onRestart={() => {
                if (resultIndexHistory.length > 0) {
                  const prev = resultIndexHistory[resultIndexHistory.length - 1];
                  setResultIndexHistory(h => h.slice(0, -1));
                  setCurrentResultIndex(prev);
                } else if (resultOrigin === "external") {
                  // Came from another page (watchlist, together, etc.) — go back in browser history
                  navigate(-1);
                } else {
                  // Came from HomeScreen — restore tonight pick preview
                  if (results.length > 0) {
                    setChatSuggestedMovies(results);
                  }
                  setStep("home");
                }
              }}
              onRefineWithVoice={handleRefineWithVoice}
              onRefineWithMessage={async (message) => {
                const currentMovie = results[currentResultIndex];
                if (!currentMovie) return;
                const shortLabel = message.replace(/^(Je veux |Je préfère |Montre-moi )/i, "").toLowerCase();
                setSearchTags(prev => prev.includes(shortLabel) ? prev : [...prev, shortLabel]);
                setLoading(true); setLoadingMessage("Pick cherche mieux…");
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
                  if (data?.movie) {
                    if (data.recap?.length > 0) setSearchTags(prev => { const merged = [...prev]; data.recap.forEach((t: string) => { if (!merged.includes(t)) merged.push(t); }); return merged; });
                    const newMovies: MovieDetail[] = data.movies && data.movies.length > 0
                      ? data.movies as MovieDetail[]
                      : [data.movie as MovieDetail];
                    setResults(prev => [...prev, ...newMovies]);
                    setCurrentResultIndex(results.length);
                  }
                } catch (e) { console.error("Refine error:", e); }
                finally { setLoading(false); setLoadingMessage(""); }
              }}
              
              hasMore={currentResultIndex < results.length - 1}
              userCriteria={{ mood: null, context: null, time: null }}
              searchTags={searchTags}
              onRemoveTag={handleRemoveTag}
              refining={loading}
              profileConfidence={profilePrefs.profileConfidence}
              alternativeMovies={results.filter((_, i) => i !== currentResultIndex).slice(0, 2)}
              onSelectAlternative={(movie) => {
                const idx = results.findIndex(r => r.id === movie.id);
                if (idx >= 0) {
                  setResultIndexHistory(h => [...h, currentResultIndex]);
                  setCurrentResultIndex(idx);
                }
              }}
              currentIndex={currentResultIndex}
              totalCount={results.length}
              onNext={() => { if (currentResultIndex < results.length - 1) { setResultIndexHistory(h => [...h, currentResultIndex]); setCurrentResultIndex(i => i + 1); } }}
              onPrevious={() => { if (currentResultIndex > 0) { setResultIndexHistory(h => [...h, currentResultIndex]); setCurrentResultIndex(i => i - 1); } }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      

      <AnimatePresence>
        {showChat && <VoiceChat onClose={handleCloseChat} onMovieSuggested={handleMovieSuggested} initialMessages={chatInitialMessages} showMicGuide={talkToPickGuideStep === "mic"} />}
      </AnimatePresence>


      <PickPlusPaywall
        open={pickPlus.shouldShowPaywall}
        onClose={pickPlus.hidePaywall}
        trigger="reco_limit"
      />

      {/* Platform Tour */}
      <AnimatePresence>
        {showTour && <PlatformTour onComplete={handleTourComplete} />}
      </AnimatePresence>

      {/* Activation Flow */}
      {showActivation && !showTour && (
        <ActivationFlow
          onStartMission={handleActivationMission}
          onComplete={handleActivationComplete}
        />
      )}

      {/* Watchlist Mission Guide */}
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
    </div>
  );
};

export default Index;
