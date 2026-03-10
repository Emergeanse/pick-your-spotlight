import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wand2, Play, Sparkles } from "lucide-react";
import { getTrendingMovie, getTrendingMovies, getHiddenGems, getDisplayTitle, getYear, getBackdropUrl, getMovieDetails } from "@/lib/tmdb";
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

const heroTaglines = [
  "Choisi pour vous ce soir",
  "Parfait pour une soirée détente",
  "Très apprécié ce soir",
  "Le choix idéal pour ce soir",
];

const surpriseMessages = [
  "On cherche le film parfait…",
  "Analyse de vos envies…",
  "Quelque chose de spécial arrive…",
];

const HomeScreen = ({ onStart, onSurprise, onPickForMe, onMovieSelect, loading }: HomeScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [surpriseMessage, setSurpriseMessage] = useState("");
  const [tagline] = useState(() => heroTaglines[Math.floor(Math.random() * heroTaglines.length)]);

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
    setSurpriseLoading(true);
    setSurpriseMessage(surpriseMessages[0]);
    const t1 = setTimeout(() => setSurpriseMessage(surpriseMessages[1]), 600);
    const t2 = setTimeout(() => setSurpriseMessage(surpriseMessages[2]), 1200);
    const t3 = setTimeout(() => {
      setSurpriseLoading(false);
      setSurpriseMessage("");
      onSurprise();
    }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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

  const matchScore = tonightPick ? Math.min(98, 85 + Math.floor(Math.random() * 12)) : 0;

  const bgImage = tonightPick?.backdrop_path
    ? getBackdropUrl(tonightPick.backdrop_path)
    : "";

  return (
    <div className="relative w-full h-full overflow-y-auto overflow-x-hidden">
      <BrandHeader />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center">
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

        <div className="relative z-10 p-5 md:p-12 lg:p-16 max-w-2xl w-full text-center flex flex-col items-center">
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

              {/* Match score + tagline */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="flex items-center gap-2 mb-3 md:mb-4"
              >
                {matchScore > 0 && (
                  <span className="bg-primary/20 text-primary text-[10px] md:text-xs font-sans font-semibold px-2.5 py-1 rounded-full border border-primary/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Match {matchScore}%
                  </span>
                )}
                <span className="text-foreground/50 text-[11px] md:text-xs font-sans italic">
                  {tagline}
                </span>
              </motion.div>

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
              <p className="text-foreground/70 text-sm md:text-base font-sans font-light leading-relaxed mb-5 md:mb-8 max-w-lg line-clamp-2">
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
              disabled={isLoading || loading || surpriseLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                </span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Trouver mon film ce soir
                </>
              )}
            </Button>

            <div className="relative">
              <Button
                variant="heroOutline"
                size="xl"
                className="text-sm md:text-base group"
                onClick={handleSurprise}
                disabled={isLoading || loading || surpriseLoading}
              >
                <Wand2 className={`w-4 h-4 mr-1 transition-transform duration-300 ${surpriseLoading ? "animate-spin" : "group-hover:rotate-12"}`} />
                {surpriseLoading ? surpriseMessage : "Surprends-moi"}
              </Button>
              <AnimatePresence>
                {surpriseLoading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute -top-2 -right-2"
                  >
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                        animate={{
                          opacity: 0,
                          scale: 1.5,
                          x: (Math.random() - 0.5) * 160,
                          y: (Math.random() - 0.5) * 100,
                        }}
                        transition={{ duration: 1, delay: i * 0.12, repeat: 1 }}
                        className="absolute w-1.5 h-1.5 rounded-full bg-primary"
                        style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default HomeScreen;
