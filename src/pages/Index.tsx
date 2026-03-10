import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import HomeScreen from "@/components/pick/HomeScreen";
import MoodStep from "@/components/pick/MoodStep";
import GenreStep from "@/components/pick/GenreStep";
import ContextStep from "@/components/pick/ContextStep";
import TimeStep from "@/components/pick/TimeStep";
import PlatformStep from "@/components/pick/PlatformStep";
import ResultScreen from "@/components/pick/ResultScreen";
import type { Mood, Context, TimeAvailable, MovieDetail } from "@/lib/tmdb";
import { getRecommendations, getSurpriseRecommendation } from "@/lib/tmdb";

type Step = "home" | "mood" | "genre" | "context" | "time" | "platforms" | "result";

// Compute a fake match score based on how many steps were answered
function computeMatchScore(mood: Mood | null, genreIds: number[], context: Context | null, time: TimeAvailable | null, platformIds: number[]): number {
  let base = 65;
  if (mood) base += 8;
  if (genreIds.length > 0) base += 7;
  if (context) base += 6;
  if (time) base += 5;
  if (platformIds.length > 0) base += 4;
  // Add some randomness
  return Math.min(98, base + Math.floor(Math.random() * 5));
}

function getMatchLabel(score: number): string {
  if (score >= 90) return "You're going to love this one";
  if (score >= 80) return "Perfect movie for tonight";
  return "Great match for your mood";
}

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
      setMatchScore(0); // No score for surprise
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
      
      // Use defaults if skipped
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

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        {step === "home" && (
          <FadeWrapper key="home">
            <HomeScreen
              onStart={handleStart}
              onSurprise={handleSurprise}
              onPickForMe={handlePickForMe}
              loading={loading}
            />
          </FadeWrapper>
        )}
        {step === "mood" && (
          <FadeWrapper key="mood">
            <MoodStep onSelect={handleMoodSelect} onSkip={() => handleMoodSelect(null)} />
          </FadeWrapper>
        )}
        {step === "genre" && (
          <FadeWrapper key="genre">
            <GenreStep onSelect={handleGenreSelect} />
          </FadeWrapper>
        )}
        {step === "context" && (
          <FadeWrapper key="context">
            <ContextStep onSelect={handleContextSelect} onSkip={() => handleContextSelect(null)} />
          </FadeWrapper>
        )}
        {step === "time" && (
          <FadeWrapper key="time">
            <TimeStep onSelect={handleTimeSelect} onSkip={() => handleTimeSelect(null)} loading={false} />
          </FadeWrapper>
        )}
        {step === "platforms" && (
          <FadeWrapper key="platforms">
            <PlatformStep onSelect={handlePlatformSelect} loading={loading} loadingMessage={loadingMessage} />
          </FadeWrapper>
        )}
        {step === "result" && results.length > 0 && (
          <FadeWrapper key="result">
            <ResultScreen
              movie={results[currentResultIndex]}
              onShowAnother={handleShowAnother}
              onRestart={handleRestart}
              hasMore={currentResultIndex < results.length - 1}
              matchScore={matchScore}
              matchLabel={matchLabel}
            />
          </FadeWrapper>
        )}
      </AnimatePresence>
    </div>
  );
};

const FadeWrapper = ({ children, key }: { children: React.ReactNode; key: string }) => (
  <motion.div
    key={key}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4, ease: "easeInOut" }}
    className="absolute inset-0"
  >
    {children}
  </motion.div>
);

export default Index;
