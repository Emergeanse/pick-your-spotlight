import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wand2, Play } from "lucide-react";
import { getTrendingMovie, getTrendingMovies, getHiddenGems, getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getMovieDetails } from "@/lib/tmdb";
import type { MovieDetail, Movie } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";
import TrendingRow from "./TrendingRow";

interface HomeScreenProps {
  onStart: () => void;
  onSurprise: () => void;
  onPickForMe: () => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
}

const HomeScreen = ({ onStart, onSurprise, onPickForMe, onMovieSelect, loading }: HomeScreenProps) => {
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
    }, 800);
  };

  const handleSurprise = () => {
    setSparkle(true);
    setTimeout(() => {
      setSparkle(false);
      onSurprise();
    }, 600);
  };

  const handleMovieClick = async (movie: Movie) => {
    const mediaType = movie.first_air_date ? "tv" : "movie";
    try {
      const details = await getMovieDetails(movie.id, mediaType);
      onMovieSelect(details);
    } catch (e) {
      console.error(e);
    }
  };

  const bgImage = tonightPick?.backdrop_path
    ? getBackdropUrl(tonightPick.backdrop_path)
    : "";

  return (
    <div className="relative w-full h-full overflow-y-auto overflow-x-hidden">
      <BrandHeader />

      {/* Hero Section */}
      <section className="relative h-[85vh] md:h-[90vh] flex items-end">
        {bgImage && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

        <div className="relative z-10 p-5 md:p-12 lg:p-16 pb-8 md:pb-14 max-w-2xl w-full">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-primary text-[10px] md:text-xs font-sans uppercase tracking-[0.2em] mb-2 md:mb-3"
          >
            Recommandation du soir
          </motion.p>

          {tonightPick && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h1 className="text-3xl md:text-6xl lg:text-7xl font-serif leading-[1.05] mb-2 md:mb-3">
                {getDisplayTitle(tonightPick)}
              </h1>
              <div className="flex items-center gap-3 text-muted-foreground text-xs md:text-sm font-sans mb-3 md:mb-4">
                {getYear(tonightPick) && <span>{getYear(tonightPick)}</span>}
                {tonightPick.runtime > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span>{tonightPick.runtime} min</span>
                  </>
                )}
                {tonightPick.vote_average > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span>★ {tonightPick.vote_average.toFixed(1)}</span>
                  </>
                )}
                {tonightPick.genres && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span>{tonightPick.genres.map(g => g.name).slice(0, 2).join(" · ")}</span>
                  </>
                )}
              </div>
              <p className="text-foreground/70 text-sm md:text-base font-sans font-light leading-relaxed mb-5 md:mb-8 max-w-lg line-clamp-3">
                {tonightPick.overview}
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex flex-wrap gap-3 items-center"
          >
            <Button
              variant="hero"
              size="xl"
              className="text-sm md:text-base"
              onClick={handleStart}
              disabled={isLoading || loading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                </span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Trouver mon film
                </>
              )}
            </Button>

            <div className="relative">
              <Button
                variant="heroOutline"
                size="xl"
                className="text-sm md:text-base group"
                onClick={handleSurprise}
                disabled={isLoading || loading}
              >
                <Wand2 className="w-4 h-4 mr-1 transition-transform duration-300 group-hover:rotate-12" />
                {loading ? "..." : "Surprends-moi"}
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
        </div>
      </section>

      {/* Discovery sections */}
      <section className="relative z-10 space-y-8 md:space-y-12 pb-12 md:pb-20 max-w-6xl mx-auto md:px-12">
        <TrendingRow
          title="Tendances du moment"
          fetchFn={getTrendingMovies}
          onMovieClick={handleMovieClick}
        />
        <TrendingRow
          title="Pépites cachées"
          fetchFn={getHiddenGems}
          onMovieClick={handleMovieClick}
        />
      </section>
    </div>
  );
};

export default HomeScreen;
