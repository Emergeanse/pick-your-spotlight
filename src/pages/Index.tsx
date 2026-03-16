import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import HomeScreen from "@/components/pick/HomeScreen";
import MoodStep from "@/components/pick/MoodStep";
import ContextStep from "@/components/pick/ContextStep";
import TimeStep from "@/components/pick/TimeStep";
import PlatformStep from "@/components/pick/PlatformStep";
import ResultScreen from "@/components/pick/ResultScreen";
import VoiceChat from "@/components/pick/VoiceChat";
import CompanionMode from "@/components/pick/CompanionMode";
import BottomTabBar from "@/components/pick/BottomTabBar";
import RevealAnimation from "@/components/pick/RevealAnimation";
import { useCompanion } from "@/contexts/CompanionContext";
import RevealAnimation from "@/components/pick/RevealAnimation";
import type { ChatMessage } from "@/components/pick/VoiceChat";
import StepLayout from "@/components/pick/StepLayout";
import BrandHeader from "@/components/pick/BrandHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import type { Mood, Context, TimeAvailable, MovieDetail } from "@/lib/tmdb";
import { getRecommendations, getDisplayTitle } from "@/lib/tmdb";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { usePickPlus } from "@/hooks/use-pick-plus";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";

type Step = "home" | "mood" | "context" | "time" | "platforms" | "result";

const STEP_ORDER: Step[] = ["mood", "context", "time", "platforms"];
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

const Index = () => {
  const [step, setStep] = useState<Step>("home");
  const [mood, setMood] = useState<Mood | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [time, setTime] = useState<TimeAvailable | null>(null);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showCompanion, setShowCompanion] = useState(false);
  const [chatInitialMessages, setChatInitialMessages] = useState<ChatMessage[] | undefined>(undefined);
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [profilePrefs, setProfilePrefs] = useState<{ excludedGenres: string[]; excludedPlatforms: number[]; minRating: number; preferredPlatforms: number[]; profileConfidence: number }>({ excludedGenres: [], excludedPlatforms: [], minRating: 0, preferredPlatforms: [], profileConfidence: 0 });
  const { user } = useAuth();
  const navigate = useNavigate();
  const pickPlus = usePickPlus();

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
          });
        }
      });
  }, [user, navigate]);

  const MOOD_LABELS: Record<string, string> = {
    relax: "détente", excited: "intense", romantic: "romantique",
    "mind-blowing": "époustouflant", "easy-watch": "facile", fun: "fun",
  };
  const CONTEXT_LABELS: Record<string, string> = {
    alone: "solo", couple: "en couple", friends: "entre amis", family: "en famille",
  };
  const TIME_LABELS: Record<string, string> = {
    short: "film court", "movie-night": "soirée ciné", episode: "un épisode",
  };

  const buildSearchTags = (m: Mood | null, c: Context | null, t: TimeAvailable | null) => {
    const tags: string[] = [];
    if (m) tags.push(MOOD_LABELS[m] || m);
    if (c) tags.push(CONTEXT_LABELS[c] || c);
    if (t) tags.push(TIME_LABELS[t] || t);
    return tags;
  };

  const handleRemoveTag = (tag: string) => {
    setSearchTags(prev => prev.filter(t => t !== tag));
    const moodEntry = Object.entries(MOOD_LABELS).find(([, v]) => v === tag);
    if (moodEntry) setMood(null);
    const ctxEntry = Object.entries(CONTEXT_LABELS).find(([, v]) => v === tag);
    if (ctxEntry) setContext(null);
    const timeEntry = Object.entries(TIME_LABELS).find(([, v]) => v === tag);
    if (timeEntry) setTime(null);
  };

  const handleStart = () => setStep("mood");

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

  const handleMoodSelect = (m: Mood | null) => { if (m) setMood(m); setStep("context"); };
  const handleContextSelect = (c: Context | null) => { if (c) setContext(c); setStep("time"); };
  const handleTimeSelect = (t: TimeAvailable | null) => { if (t) setTime(t); setStep("platforms"); };

  const handlePlatformSelect = async (platformIds: number[]) => {
    setSelectedPlatformIds(platformIds);
    setSearchTags(buildSearchTags(mood, context, time));
    
    // Check freemium limit
    const allowed = await pickPlus.recordRecommendation();
    if (!allowed) return;
    
    setLoading(true);
    setLoadingMessage("Analyse de vos préférences…");
    try {
      await new Promise(r => setTimeout(r, 400));
      setLoadingMessage("Recherche du film idéal…");
      const mergedPlatforms = platformIds.length > 0 ? platformIds : profilePrefs.preferredPlatforms;
      const recs = await getRecommendations(
        mood || "easy-watch", context || "alone", time || "movie-night", mergedPlatforms, [],
        { excludedGenres: profilePrefs.excludedGenres, minRating: profilePrefs.minRating }
      );
      setLoadingMessage("Presque prêt…");
      await new Promise(r => setTimeout(r, 300));
      setResults(recs);
      setCurrentResultIndex(0);
      setStep("result");
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const handleShowAnother = async (rejectReason?: string, rejectedMovie?: MovieDetail) => {
    const currentMovie = results[currentResultIndex];
    if (currentMovie) {
      trackInteraction(currentMovie.id, "skipped", { mood, context, time });
      if (user) recordSkippedRecommendation(user.id);
    }
    if (currentResultIndex < results.length - 1 && !rejectReason) {
      setCurrentResultIndex(i => i + 1);
    } else {
      setLoading(true);
      try {
        const tasteProfile = await getUserTasteProfile();
        const excludeIds = [...results.map(r => r.id), ...(tasteProfile?.excludeIds || [])];
        const mergedPlatforms = selectedPlatformIds.length > 0 ? selectedPlatformIds : profilePrefs.preferredPlatforms;
        const rejectionContext = rejectReason && rejectedMovie ? {
          reason: rejectReason,
          rejectedGenres: (rejectedMovie.genres || []).map(g => g.name),
          rejectedTitle: getDisplayTitle(rejectedMovie),
          rejectedRating: rejectedMovie.vote_average,
          rejectedRuntime: rejectedMovie.runtime,
        } : undefined;
        const recs = await getRecommendations(
          mood || "easy-watch", context || "alone", time || "movie-night", mergedPlatforms, excludeIds,
          { excludedGenres: profilePrefs.excludedGenres, minRating: profilePrefs.minRating, rejectionContext }
        );
        if (recs.length > 0) { setResults(prev => [...prev, ...recs]); setCurrentResultIndex(i => i + 1); }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
  };

  const handleStartCompanion = () => {
    const currentMovie = results[currentResultIndex];
    if (currentMovie) {
      trackInteraction(currentMovie.id, "watched", { mood, context, time });
      if (user) recordAcceptedRecommendation(user.id);
    }
    setShowCompanion(true);
  };

  const handleRestart = () => {
    setStep("home");
    setMood(null); setContext(null); setTime(null);
    setSelectedPlatformIds([]); setResults([]); setCurrentResultIndex(0); setSearchTags([]);
  };

  const currentStepNumber = getStepNumber(step);
  const isQuestionStep = currentStepNumber > 0;
  const showTabBar = step === "home";

  const renderStep = () => {
    switch (step) {
      case "mood": return <MoodStep onSelect={handleMoodSelect} onSkip={() => handleMoodSelect(null)} />;
      case "context": return <ContextStep onSelect={handleContextSelect} onSkip={() => handleContextSelect(null)} />;
      case "time": return <TimeStep onSelect={handleTimeSelect} onSkip={() => handleTimeSelect(null)} loading={false} />;
      case "platforms": return <PlatformStep onSelect={handlePlatformSelect} loading={loading} loadingMessage={loadingMessage} />;
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
            <HomeScreen onStart={handleStart} onOpenChat={handleOpenChat} onSurprise={handleSurprise} onMovieSelect={handleMovieSelect} loading={loading} />
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
                  const { data, error } = await supabase.functions.invoke("movie-chat", { body: { messages: contextMessages } });
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
              userCriteria={{ mood, context, time }}
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
    </div>
  );
};

export default Index;
