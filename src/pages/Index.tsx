import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import HomeScreen from "@/components/pick/HomeScreen";
import MoodStep from "@/components/pick/MoodStep";
import GenreStep from "@/components/pick/GenreStep";
import ContextStep from "@/components/pick/ContextStep";
import TimeStep from "@/components/pick/TimeStep";
import PlatformStep from "@/components/pick/PlatformStep";
import RatingStep from "@/components/pick/RatingStep";
import MediaTypeStep from "@/components/pick/MediaTypeStep";
import ResultScreen from "@/components/pick/ResultScreen";
import StepLayout from "@/components/pick/StepLayout";
import BrandHeader from "@/components/pick/BrandHeader";
import type { Mood, Context, TimeAvailable, MovieDetail } from "@/lib/tmdb";
import { getRecommendations, getSurpriseRecommendation } from "@/lib/tmdb";
import type { MediaType } from "@/components/pick/MediaTypeStep";

type Step = "home" | "mediaType" | "mood" | "genre" | "context" | "rating" | "time" | "platforms" | "result";

const STEP_ORDER: Step[] = ["mediaType", "mood", "genre", "context", "rating", "time", "platforms"];
const TOTAL_STEPS = STEP_ORDER.length;

function getStepNumber(step: Step): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx + 1 : 0;
}

function computeMatchScore(mood: Mood | null, genreIds: number[], context: Context | null, time: TimeAvailable | null, platformIds: number[], minRating: number, mediaType: MediaType): number {
  let base = 60;
  if (mood) base += 7;
  if (genreIds.length > 0) base += 6;
  if (context) base += 5;
  if (time) base += 4;
  if (platformIds.length > 0) base += 4;
  if (minRating > 0) base += 4;
  if (mediaType !== "both") base += 3;
  return Math.min(98, base + Math.floor(Math.random() * 5));
}

function getMatchLabel(score: number): string {
  if (score >= 90) return "Vous allez adorer";
  if (score >= 80) return "Le film parfait pour ce soir";
  return "Excellent choix pour votre humeur";
}

const slideVariants = {
  enter: { x: 80, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -80, opacity: 0 },
};

const Index = () => {
  const [step, setStep] = useState<Step>("home");
  const [mediaType, setMediaType] = useState<MediaType>("both");
  const [mood, setMood] = useState<Mood | null>(null);
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [excludedGenreIds, setExcludedGenreIds] = useState<number[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [time, setTime] = useState<TimeAvailable | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [matchScore, setMatchScore] = useState(0);
  const [matchLabel, setMatchLabel] = useState("");

  const handleStart = () => setStep("mediaType");

  const handleSurprise = async () => {
    setLoading(true);
    try {
      const movie = await getSurpriseRecommendation();
      setResults([movie]);
      setCurrentResultIndex(0);
      setMatchScore(0);
      setMatchLabel("Une pépite rien que pour vous");
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
      setMatchLabel("À regarder ce soir");
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaTypeSelect = (t: MediaType | null) => {
    if (t) setMediaType(t);
    setStep("mood");
  };

  const handleMoodSelect = (m: Mood | null) => {
    if (m) setMood(m);
    setStep("genre");
  };

  const handleGenreSelect = (ids: number[], excludedIds: number[]) => {
    setGenreIds(ids);
    setExcludedGenreIds(excludedIds);
    setStep("context");
  };

  const handleContextSelect = (c: Context | null) => {
    if (c) setContext(c);
    setStep("rating");
  };

  const handleRatingSelect = (r: number | null) => {
    if (r !== null) setMinRating(r);
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
      const finalMediaType = mediaType || "both";
      const recs = await getRecommendations(finalMood, finalContext, finalTime, platformIds, genreIds, minRating, finalMediaType, excludedGenreIds);
      setLoadingMessage("Presque prêt…");
      await new Promise(r => setTimeout(r, 400));
      const score = computeMatchScore(mood, genreIds, context, time, platformIds, minRating, finalMediaType);
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
    setMediaType("both");
    setMood(null);
    setGenreIds([]);
    setExcludedGenreIds([]);
    setContext(null);
    setTime(null);
    setMinRating(0);
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
      case "mediaType":
        return <MediaTypeStep onSelect={handleMediaTypeSelect} onSkip={() => handleMediaTypeSelect(null)} />;
      case "mood":
        return <MoodStep onSelect={handleMoodSelect} onSkip={() => handleMoodSelect(null)} />;
      case "genre":
        return <GenreStep onSelect={handleGenreSelect} />;
      case "context":
        return <ContextStep onSelect={handleContextSelect} onSkip={() => handleContextSelect(null)} />;
      case "rating":
        return <RatingStep onSelect={handleRatingSelect} onSkip={() => handleRatingSelect(null)} />;
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
              matchScore={matchScore}
              matchLabel={matchLabel}
              userCriteria={{
                mood,
                context,
                time,
                genreIds,
                platformIds: selectedPlatformIds,
                minRating,
                mediaType,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
