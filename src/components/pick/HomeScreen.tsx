import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { getTrendingMovie, getDisplayTitle, getYear, getBackdropUrl, getPosterUrl } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";

interface HomeScreenProps {
  onStart: () => void;
  onSurprise: () => void;
  onPickForMe: () => void;
  loading: boolean;
}

const HomeScreen = ({ onStart, onSurprise, onPickForMe, loading }: HomeScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [sparkle, setSparkle] = useState(false);

  useEffect(() => {
    getTrendingMovie().then(setTonightPick).catch(() => {});
  }, []);

  const handleStart = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onStart();
    }, 1600);
  };

  const handleSurprise = () => {
    setSparkle(true);
    setTimeout(() => {
      setSparkle(false);
      onSurprise();
    }, 800);
  };

  const bgImage = tonightPick?.backdrop_path
    ? getBackdropUrl(tonightPick.backdrop_path)
    : "";

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <BrandHeader />

      {/* Cinematic background */}
      {bgImage && (
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />

      <div className="relative z-10 text-center max-w-2xl">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-7xl font-serif leading-tight mb-4 tracking-wide"
        >
          Don't know what to watch tonight?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-muted-foreground text-lg md:text-xl mb-10 font-light"
        >
          Find the perfect movie in under 30 seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6"
        >
          <div className="relative w-full sm:w-auto">
            <Button
              variant="hero"
              size="xl"
              className="w-full sm:w-auto min-w-[280px] relative overflow-hidden"
              onClick={handleStart}
              disabled={isLoading || loading}
            >
              {isLoading ? (
                <span className="relative z-10 opacity-0">Find something to watch</span>
              ) : (
                "Find something to watch"
              )}
              {isLoading && (
                <div className="absolute inset-0 flex items-center">
                  <div className="h-full bg-primary-foreground/20 animate-fill-bar" />
                </div>
              )}
            </Button>
          </div>

          <div className="relative">
            <Button
              variant="heroOutline"
              size="xl"
              className="w-full sm:w-auto min-w-[200px] group relative overflow-hidden"
              onClick={handleSurprise}
              disabled={isLoading || loading}
            >
              <Wand2 className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
              {loading ? "..." : "Surprise me"}
            </Button>
            <AnimatePresence>
              {sparkle && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                      animate={{
                        opacity: 0,
                        scale: 1,
                        x: (Math.random() - 0.5) * 120,
                        y: (Math.random() - 0.5) * 80,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                      style={{ boxShadow: "0 0 6px hsl(var(--primary))" }}
                    />
                  ))}
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          onClick={onPickForMe}
          disabled={loading}
          className="mt-6 text-muted-foreground/60 text-sm font-sans hover:text-primary transition-colors disabled:opacity-50"
        >
          Pick for me — zero effort
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="text-muted-foreground/40 text-xs font-sans tracking-wider mt-4"
        >
          Works with Netflix · Prime · Disney+ · Canal+ · Apple TV+
        </motion.p>

        {tonightPick && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-14"
          >
            <p className="text-muted-foreground/60 text-xs font-sans uppercase tracking-widest mb-4">
              Tonight's recommendation
            </p>
            <div className="flex items-center gap-4 bg-card/60 backdrop-blur-md rounded-2xl p-4 max-w-sm mx-auto border border-border/50">
              <img
                src={getPosterUrl(tonightPick.poster_path, "w185")}
                alt={getDisplayTitle(tonightPick)}
                className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
              />
              <div className="text-left min-w-0">
                <h3 className="font-serif text-base truncate">
                  {getDisplayTitle(tonightPick)}
                </h3>
                <p className="text-muted-foreground text-xs font-sans mt-1">
                  {tonightPick.genres?.map(g => g.name).slice(0, 2).join(" · ")}
                  {tonightPick.runtime ? ` · ${Math.floor(tonightPick.runtime / 60)}h${(tonightPick.runtime % 60).toString().padStart(2, '0')}` : ""}
                </p>
                {tonightPick.vote_average > 0 && (
                  <p className="text-primary text-xs font-sans mt-1">
                    ★ {tonightPick.vote_average.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
