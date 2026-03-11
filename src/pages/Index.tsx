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
import type { ChatMessage } from "@/components/pick/VoiceChat";
import StepLayout from "@/components/pick/StepLayout";
import BrandHeader from "@/components/pick/BrandHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Mood, Context, TimeAvailable, MovieDetail } from "@/lib/tmdb";
import { getRecommendations, getDisplayTitle } from "@/lib/tmdb";

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
  const [chatInitialMessages, setChatInitialMessages] = useState<ChatMessage[] | undefined>(undefined);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if user needs onboarding
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarding_completed").eq("id", user.id).single()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) {
          navigate("/onboarding");
        }
      });
  }, [user, navigate]);

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
    const contextMessages: ChatMessage[] = [
      { role: "assistant", content: `Je t'ai recommandé **${getDisplayTitle(currentMovie)}**. Dis-moi ce qui ne te convient pas et je te trouverai quelque chose de mieux !` },
    ];
    setChatInitialMessages(contextMessages);
    setShowChat(true);
  };

  const handleMovieSuggested = (movie: MovieDetail) => {
    setResults([movie]);
    setCurrentResultIndex(0);
    setShowChat(false);
    setStep("result");
  };

  const handleMoodSelect = (m: Mood | null) => {
    if (m) setMood(m);
    setStep("context");
  };

  const handleContextSelect = (c: Context | null) => {
    if (c) setContext(c);
    setStep("time");
  };

  const handleTimeSelect = (t: TimeAvailable | null) => {
    if (t) setTime(t);
    setStep("platforms");
  };

  const handlePlatformSelect = async (platformIds: number[]) => {
    setSelectedPlatformIds(platformIds);
    setLoading(true);
    setLoadingMessage("Analyse de vos préférences…");
    try {
      await new Promise(r => setTimeout(r, 400));
      setLoadingMessage("Recherche du film idéal…");
      const recs = await getRecommendations(
        mood || "easy-watch", context || "alone", time || "movie-night", platformIds
      );
      setLoadingMessage("Presque prêt…");
      await new Promise(r => setTimeout(r, 300));
      setResults(recs);
      setCurrentResultIndex(0);
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleShowAnother = () => {
    if (currentResultIndex < results.length - 1) {
      setCurrentResultIndex(i => i + 1);
    }
  };

  const handleRestart = () => {
    setStep("home");
    setMood(null);
    setContext(null);
    setTime(null);
    setSelectedPlatformIds([]);
    setResults([]);
    setCurrentResultIndex(0);
  };

  const currentStepNumber = getStepNumber(step);
  const isQuestionStep = currentStepNumber > 0;

  const renderStep = () => {
    switch (step) {
      case "mood":
        return <MoodStep onSelect={handleMoodSelect} onSkip={() => handleMoodSelect(null)} />;
      case "context":
        return <ContextStep onSelect={handleContextSelect} onSkip={() => handleContextSelect(null)} />;
      case "time":
        return <TimeStep onSelect={handleTimeSelect} onSkip={() => handleTimeSelect(null)} loading={false} />;
      case "platforms":
        return <PlatformStep onSelect={handlePlatformSelect} loading={loading} loadingMessage={loadingMessage} />;
      default:
        return null;
    }
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
            className="absolute inset-0"
          >
            <HomeScreen
              onStart={handleStart}
              onOpenChat={handleOpenChat}
              onSurprise={handleSurprise}
              onMovieSelect={handleMovieSelect}
              loading={loading}
            />
          </motion.div>
        )}

        {isQuestionStep && (
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <BrandHeader showBack onBack={handleRestart} />
            <StepLayout currentStep={currentStepNumber} totalSteps={TOTAL_STEPS}>
              {renderStep()}
            </StepLayout>
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
              movie={results[currentResultIndex]}
              onShowAnother={handleShowAnother}
              onRestart={handleRestart}
              hasMore={currentResultIndex < results.length - 1}
              userCriteria={{ mood, context, time }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <VoiceChat
            onClose={handleCloseChat}
            onMovieSuggested={handleMovieSuggested}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
