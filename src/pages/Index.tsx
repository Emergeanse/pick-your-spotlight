import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import HomeScreen from "@/components/pick/HomeScreen";
import MoodStep from "@/components/pick/MoodStep";
import ContextStep from "@/components/pick/ContextStep";
import TimeStep from "@/components/pick/TimeStep";
import PlatformStep from "@/components/pick/PlatformStep";
import ResultScreen from "@/components/pick/ResultScreen";
import type { Mood, Context, TimeAvailable, MovieDetail } from "@/lib/tmdb";
import { getRecommendations, getSurpriseRecommendation } from "@/lib/tmdb";

type Step = "home" | "mood" | "context" | "time" | "platforms" | "result";

const Index = () => {
  const [step, setStep] = useState<Step>("home");
  const [mood, setMood] = useState<Mood | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [time, setTime] = useState<TimeAvailable | null>(null);
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  const handleStart = () => setStep("mood");

  const handleSurprise = async () => {
    setLoading(true);
    try {
      const movie = await getSurpriseRecommendation();
      setResults([movie]);
      setCurrentResultIndex(0);
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodSelect = (m: Mood) => {
    setMood(m);
    setStep("context");
  };

  const handleContextSelect = (c: Context) => {
    setContext(c);
    setStep("time");
  };

  const handleTimeSelect = (t: TimeAvailable) => {
    setTime(t);
    setStep("platforms");
  };

  const handlePlatformSelect = async (platformIds: number[]) => {
    if (!mood || !context || !time) return;
    setLoading(true);
    try {
      const recs = await getRecommendations(mood, context, time, platformIds);
      setResults(recs);
      setCurrentResultIndex(0);
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
    setResults([]);
    setCurrentResultIndex(0);
  };

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        {step === "home" && (
          <FadeWrapper key="home">
            <HomeScreen onStart={handleStart} onSurprise={handleSurprise} loading={loading} />
          </FadeWrapper>
        )}
        {step === "mood" && (
          <FadeWrapper key="mood">
            <MoodStep onSelect={handleMoodSelect} />
          </FadeWrapper>
        )}
        {step === "context" && (
          <FadeWrapper key="context">
            <ContextStep onSelect={handleContextSelect} />
          </FadeWrapper>
        )}
        {step === "time" && (
          <FadeWrapper key="time">
            <TimeStep onSelect={handleTimeSelect} loading={false} />
          </FadeWrapper>
        )}
        {step === "platforms" && (
          <FadeWrapper key="platforms">
            <PlatformStep onSelect={handlePlatformSelect} loading={loading} />
          </FadeWrapper>
        )}
        {step === "result" && results.length > 0 && (
          <FadeWrapper key="result">
            <ResultScreen
              movie={results[currentResultIndex]}
              onShowAnother={handleShowAnother}
              onRestart={handleRestart}
              hasMore={currentResultIndex < results.length - 1}
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
