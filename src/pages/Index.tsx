import { useState, useEffect, useCallback } from "react";
import GuidedTour, { TOUR_KEY } from "@/components/pick/GuidedTour";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import HomeScreen from "@/components/pick/HomeScreen";
import WhoStep, { type WhoOption } from "@/components/pick/WhoStep";
import WhatStep, { type WhatOption } from "@/components/pick/WhatStep";
import ResultScreen from "@/components/pick/ResultScreen";
import VoiceChat from "@/components/pick/VoiceChat";
import CompanionMode from "@/components/pick/CompanionMode";
import BottomTabBar from "@/components/pick/BottomTabBar";
import RevealAnimation from "@/components/pick/RevealAnimation";
import { useCompanion } from "@/contexts/CompanionContext";
import type { ChatMessage } from "@/components/pick/VoiceChat";
import { toast } from "sonner";
import StepLayout from "@/components/pick/StepLayout";
import BrandHeader from "@/components/pick/BrandHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle } from "@/lib/tmdb";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { usePickPlus } from "@/hooks/use-pick-plus";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeUserTasteVector } from "@/lib/taste-engine";
import { getSurpriseRecommendation, getWatchProviders } from "@/lib/tmdb";

type Step = "home" | "who" | "what" | "result";

const STEP_ORDER: Step[] = ["who", "what"];
const TOTAL_STEPS = STEP_ORDER.length;

function getStepNumber(step: Step): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx + 1 : 0;
}

const slideVariants = {
  enter: { x: 80, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -80, opacity: 0 },
};

const LOADING_MESSAGES = [
  "Je cherche la perle rare…",
  "Voyons voir ce que j'ai pour toi…",
  "Analyse de ton profil…",
  "Je parcours mes favoris…",
  "Je fouille dans ma cinémathèque…",
  "C'est presque prêt, promis !",
  "Je compare quelques options pour toi…",
  "J'affine ma sélection…",
];

const Index = () => {
  const [step, setStep] = useState<Step>("home");
  const [who, setWho] = useState<WhoOption | null>(null);
  const [what, setWhat] = useState<WhatOption | null>(null);
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showCompanion, setShowCompanion] = useState(false);
  const [chatInitialMessages, setChatInitialMessages] = useState<ChatMessage[] | undefined>(undefined);
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [profilePrefs, setProfilePrefs] = useState<{
    excludedGenres: string[];
    excludedPlatforms: number[];
    minRating: number;
    preferredPlatforms: number[];
    profileConfidence: number;
    favoriteGenres: string[];
  }>({ excludedGenres: [], excludedPlatforms: [], minRating: 0, preferredPlatforms: [], profileConfidence: 0, favoriteGenres: [] });
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pickPlus = usePickPlus();
  const [openTrainerOnMount, setOpenTrainerOnMount] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Check if we should open the trainer (from MyCinema navigation)
  useEffect(() => {
    if ((location.state as any)?.openTrainer) {
      setOpenTrainerOnMount(true);
      window.history.replaceState({}, "", "/app");
    }
  }, [location.state]);

  // Handle movie from Pick FAB chat
  const loadChatMovie = useCallback(() => {
    const stored = sessionStorage.getItem("pick-fab-movie");
    if (stored) {
      try {
        const movie = JSON.parse(stored) as MovieDetail;
        setResults([movie]);
        setCurrentResultIndex(0);
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

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarding_completed, preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, profile_confidence").eq("id", user.id).single()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) navigate("/onboarding");
        if (data) {
          setProfilePrefs({
            excludedGenres: (data as any).excluded_genres || [],
            excludedPlatforms: (data as any).excluded_platforms || [],
            minRating: (data as any).min_rating || 0,
            preferredPlatforms: data.preferred_platforms || [],
            profileConfidence: (data as any).profile_confidence || 0,
            favoriteGenres: data.favorite_genres || [],
          });
          if (data.onboarding_completed && !localStorage.getItem(TOUR_KEY)) {
            setShowTour(true);
          }
        }
      });
  }, [user, navigate]);

  // Helper: invoke surprise-personalized with retry on 429
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

  const handleStart = () => setStep("who");

  const handleSurprise = (movie: MovieDetail) => {
    setResults([movie]);
    setCurrentResultIndex(0);
    setStep("result");
  };

  const handleMovieSelect = (movie: MovieDetail) => {
    setResults([movie]);
    setCurrentResultIndex(0);
    setStep("result");
  };

  const handleOpenChat = () => {
    setChatInitialMessages(undefined);
    setShowChat(true);
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

  const handleMovieSuggested = (movie: MovieDetail, recapTags?: string[]) => {
    setResults([movie]);
    setCurrentResultIndex(0);
    if (recapTags && recapTags.length > 0) setSearchTags(recapTags);
    setShowChat(false);
    setStep("result");
  };

  const handleWhoSelect = (w: WhoOption) => {
    setWho(w);
    if (w === "duo" || w === "group") {
      // Navigate to Pick Together flow for group mode
      navigate("/app/pick-together");
      return;
    }
    setStep("what");
  };

  const handleWhatSelect = async (w: WhatOption) => {
    setWhat(w);
    
    // Check freemium limit
    const allowed = await pickPlus.recordRecommendation();
    if (!allowed) {
      setStep("home");
      return;
    }

    // Build search tags
    const tags: string[] = [];
    if (w === "movie") tags.push("film");
    else if (w === "tv") tags.push("série");
    setSearchTags(tags);

    // Generate recommendation directly using profile
    setLoading(true);
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIndex]);
    }, 2000);

    try {
      let movie: MovieDetail;

      if (user) {
        const liked = await getLikedMovies();
        // Load interaction history for exclusion
        const { data: interactionData } = await supabase.from("user_interactions")
          .select("tmdb_id")
          .eq("user_id", user.id)
          .in("action_type", ["watched", "skipped", "already_seen", "liked", "unsure"])
          .limit(500);
        const excludeIds = interactionData ? [...new Set(interactionData.map(d => d.tmdb_id))] : [];

        if (liked.length >= 2) {
          const [userTasteVector, tasteProfile] = await Promise.all([
            computeUserTasteVector(user.id),
            getUserTasteProfile(),
          ]);
          const data = await invokeSurprisePersonalized({
            likedMovies: liked,
            userTasteVector,
            tasteProfile,
            platformIds: profilePrefs.preferredPlatforms,
            excludedPlatformIds: profilePrefs.excludedPlatforms,
            excludedGenres: profilePrefs.excludedGenres,
            minRating: profilePrefs.minRating,
            excludeIds,
            mediaType: w === "both" ? undefined : w,
          });
          movie = data.movie as MovieDetail;
        } else {
          movie = await getSurpriseRecommendation(excludeIds, {
            platformIds: profilePrefs.preferredPlatforms,
            minRating: profilePrefs.minRating,
            excludedGenres: profilePrefs.excludedGenres,
          });
        }
      } else {
        movie = await getSurpriseRecommendation([], {
          platformIds: profilePrefs.preferredPlatforms,
          minRating: profilePrefs.minRating,
          excludedGenres: profilePrefs.excludedGenres,
        });
      }

      clearInterval(msgInterval);
      setResults([movie]);
      setCurrentResultIndex(0);
      setStep("result");
    } catch (e) {
      console.error(e);
      clearInterval(msgInterval);
      try {
        const movie = await getSurpriseRecommendation([], {
          platformIds: profilePrefs.preferredPlatforms,
          minRating: profilePrefs.minRating,
          excludedGenres: profilePrefs.excludedGenres,
        });
        setResults([movie]);
        setCurrentResultIndex(0);
        setStep("result");
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleShowAnother = async (rejectReason?: string, rejectedMovie?: MovieDetail) => {
    const currentMovie = results[currentResultIndex];
    if (currentMovie) {
      trackInteraction(currentMovie.id, "skipped", { who, what });
      if (user) recordSkippedRecommendation(user.id);
    }
    if (currentResultIndex < results.length - 1 && !rejectReason) {
      setCurrentResultIndex(i => i + 1);
    } else {
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
            const [userTasteVector] = await Promise.all([
              computeUserTasteVector(user.id),
            ]);
            const data = await invokeSurprisePersonalized({
              likedMovies: liked,
              userTasteVector,
              tasteProfile,
              platformIds: profilePrefs.preferredPlatforms,
              excludedPlatformIds: profilePrefs.excludedPlatforms,
              excludedGenres: profilePrefs.excludedGenres,
              minRating: profilePrefs.minRating,
              excludeIds,
              rejectionContext,
              mediaType: what === "both" ? undefined : what,
            });
            if (data?.movie) {
              setResults(prev => [...prev, data.movie]);
              setCurrentResultIndex(i => i + 1);
            }
          } else {
            const movie = await getSurpriseRecommendation(excludeIds, {
              platformIds: profilePrefs.preferredPlatforms,
              minRating: profilePrefs.minRating,
              excludedGenres: profilePrefs.excludedGenres,
            });
            setResults(prev => [...prev, movie]);
            setCurrentResultIndex(i => i + 1);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
  };

  const { activateCompanion } = useCompanion();

  const handleStartCompanion = () => {
    const currentMovie = results[currentResultIndex];
    if (currentMovie) {
      trackInteraction(currentMovie.id, "watched", { who, what });
      if (user) recordAcceptedRecommendation(user.id);
      activateCompanion(currentMovie);
      toast("🎬 Companion activé — Pick est là pendant tout le film", { duration: 3000 });
    }
    setShowCompanion(true);
  };

  const handleRestart = () => {
    setStep("home");
    setWho(null);
    setWhat(null);
    setResults([]);
    setCurrentResultIndex(0);
    setSearchTags([]);
  };

  const handleRemoveTag = (tag: string) => {
    setSearchTags(prev => prev.filter(t => t !== tag));
  };

  const currentStepNumber = getStepNumber(step);
  const isQuestionStep = currentStepNumber > 0;
  const showTabBar = step === "home";

  const renderStep = () => {
    switch (step) {
      case "who": return <WhoStep onSelect={handleWhoSelect} />;
      case "what": return <WhatStep onSelect={handleWhatSelect} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        {step === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="absolute inset-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
          >
            <HomeScreen onStart={handleStart} onOpenChat={handleOpenChat} onSurprise={handleSurprise} onMovieSelect={handleMovieSelect} loading={loading} openTrainerOnMount={openTrainerOnMount} onTrainerOpened={() => setOpenTrainerOnMount(false)} />
          </motion.div>
        )}

        {isQuestionStep && step !== "result" && (
          <motion.div key={step} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: "easeOut" }} className="absolute inset-0">
            <BrandHeader showBack onBack={handleRestart} />
            <StepLayout currentStep={currentStepNumber} totalSteps={TOTAL_STEPS}>
              {renderStep()}
            </StepLayout>
          </motion.div>
        )}

        {step === "result" && results.length > 0 && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0">
            <ResultScreen
              movie={results[currentResultIndex]}
              onShowAnother={handleShowAnother}
              onRestart={handleRestart}
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
                    },
                  });
                  if (error) throw error;
                  if (data?.movie) {
                    if (data.recap?.length > 0) setSearchTags(prev => { const merged = [...prev]; data.recap.forEach((t: string) => { if (!merged.includes(t)) merged.push(t); }); return merged; });
                    setResults(prev => [...prev, data.movie]);
                    setCurrentResultIndex(results.length);
                  }
                } catch (e) { console.error("Refine error:", e); }
                finally { setLoading(false); setLoadingMessage(""); }
              }}
              onStartCompanion={handleStartCompanion}
              hasMore={currentResultIndex < results.length - 1}
              userCriteria={{ mood: null, context: who === "alone" ? "alone" : who === "duo" ? "couple" : "friends", time: null }}
              searchTags={searchTags}
              onRemoveTag={handleRemoveTag}
              refining={loading}
              profileConfidence={profilePrefs.profileConfidence}
              alternativeMovies={results.filter((_, i) => i !== currentResultIndex).slice(0, 2)}
              onSelectAlternative={(movie) => {
                const idx = results.findIndex(r => r.id === movie.id);
                if (idx >= 0) setCurrentResultIndex(idx);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showTabBar && <BottomTabBar />}

      <AnimatePresence>
        {loading && step !== "result" && <RevealAnimation active={loading} message={loadingMessage || undefined} />}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && <VoiceChat onClose={handleCloseChat} onMovieSuggested={handleMovieSuggested} initialMessages={chatInitialMessages} />}
      </AnimatePresence>

      <AnimatePresence>
        {showCompanion && results[currentResultIndex] && <CompanionMode movie={results[currentResultIndex]} onClose={() => setShowCompanion(false)} pickPlus={pickPlus} />}
      </AnimatePresence>

      <PickPlusPaywall
        open={pickPlus.shouldShowPaywall}
        onClose={pickPlus.hidePaywall}
        trigger="reco_limit"
      />

      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
    </div>
  );
};

export default Index;
