import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import HomeScreen from "@/components/pick/HomeScreen";
import MoodStep from "@/components/pick/MoodStep";
import GenreStep from "@/components/pick/GenreStep";
import ContextStep from "@/components/pick/ContextStep";
import TimeStep from "@/components/pick/TimeStep";
import PlatformStep from "@/components/pick/PlatformStep";
import ResultScreen from "@/components/pick/ResultScreen";
import StepLayout from "@/components/pick/StepLayout";
import type { Mood, Context, TimeAvailable, MovieDetail } from "@/lib/tmdb";
import { getRecommendations, getSurpriseRecommendation } from "@/lib/tmdb";

type Step = "home" | "mood" | "genre" | "context" | "time" | "platforms" | "result";

const STEP_ORDER: Step[] = ["mood", "genre", "context", "time", "platforms"];
const TOTAL_STEPS = STEP_ORDER.length;

function getStepNumber(step: Step): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx + 1 : 0;
}

function computeMatchScore(mood: Mood | null, genreIds: number[], context: Context | null, time: TimeAvailable | null, platformIds: number[]): number {
  let base = 65;
  if (mood) base += 8;
  if (genreIds.length > 0) base += 7;
  if (context) base += 6;
  if (time) base += 5;
  if (platformIds.length > 0) base += 4;
  return Math.min(98, base + Math.floor(Math.random() * 5));
}

function getMatchLabel(score: number): string {
  if (score >= 90) return "You're going to love this one";
  if (score >= 80) return "Perfect movie for tonight";
  return "Great match for your mood";
}

const slideVariants = {
  enter: { x: 80, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -80, opacity: 0 },
};

const Index = () => {
  const [step, setStep] = useState<Step>("home");
  const [mood, setMood] = useState<Mood | null>(null);
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [time, setTime] = useState<TimeAvailable | null>(null);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [matchScore, setMatchScore] = useState(0);
  const [matchLabel, setMatchLabel] = useState("");

  const handleStart = () => setStep("mood");

  const handleSurprise = async () => {
    setLoading(true);
    try {
      const movie = await getSurpriseRecommendation();
      setResults([movie]);
      setCurrentResultIndex(0);
      setMatchScore(0);
      setMatchLabel("Hidden gem just for you");
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickForMe = async () => {
    setLoading(true);
    try {
      const movie = await getSurpriseRecommendation();
      setResults([movie]);
      setCurrentResultIndex(0);
      setMatchScore(0);
      setMatchLabel("Watch this tonight");
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodSelect = (m: Mood | null) => {
    if (m) setMood(m);
    setStep("genre");
  };

  const handleGenreSelect = (ids: number[]) => {
    setGenreIds(ids);
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
      await new Promise(r => setTimeout(r, 600));
      setLoadingMessage("Recherche du film idéal…");
      const finalMood = mood || "easy-watch";
      const finalContext = context || "alone";
      const finalTime = time || "movie-night";
      const recs = await getRecommendations(finalMood, finalContext, finalTime, platformIds, genreIds);
      setLoadingMessage("Presque prêt…");
      await new Promise(r => setTimeout(r, 400));
      const score = computeMatchScore(mood, genreIds, context, time, platformIds);
      setMatchScore(score);
      setMatchLabel(getMatchLabel(score));
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
    setGenreIds([]);
    setContext(null);
    setTime(null);
    setSelectedPlatformIds([]);
    setResults([]);
    setCurrentResultIndex(0);
    setMatchScore(0);
    setMatchLabel("");
  };

  const currentStepNumber = getStepNumber(step);
  const isQuestionStep = currentStepNumber > 0;

  const renderStep = () => {
    switch (step) {
      case "mood":
        return <MoodStep onSelect={handleMoodSelect} onSkip={() => handleMoodSelect(null)} />;
      case "genre":
        return <GenreStep onSelect={handleGenreSelect} />;
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
              onSurprise={handleSurprise}
              onPickForMe={handlePickForMe}
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
              matchScore={matchScore}
              matchLabel={matchLabel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
