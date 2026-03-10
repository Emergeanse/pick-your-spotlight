import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, ChevronRight, Star, Clock, Sparkles, Heart, Lightbulb, PartyPopper, Loader2 } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders, getMovieTrailerUrl } from "@/lib/tmdb";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie, isMovieLiked } from "@/lib/liked-movies";
import { toast } from "sonner";
import BrandHeader from "./BrandHeader";

const IMG_BASE = "https://image.tmdb.org/t/p";

interface MatchData {
  matchScore: number;
  headline: string;
  whyItMatches: string;
  emotionalJourney: string;
  perfectFor: string;
  funFact: string;
}

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: () => void;
  onRestart: () => void;
  hasMore: boolean;
  userCriteria?: {
    mood: Mood | null;
    context: Context | null;
    time: TimeAvailable | null;
  };
}

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({ movie, onShowAnother, onRestart, hasMore, userCriteria }, ref) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const { user } = useAuth();

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const runtime = movie.runtime || (movie.episode_run_time?.[0]) || 0;
  const genres = movie.genres?.map(g => g.name).join(", ") || "";
  const overview = movie.overview || "Aucune description disponible.";
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const bgImage = backdrop || poster;

  useEffect(() => {
    getWatchProviders(movie.id, mediaType).then(setProviders).catch(() => setProviders([]));
    getMovieTrailerUrl(movie.id, mediaType).then(setTrailerUrl).catch(() => setTrailerUrl(null));
  }, [movie.id, mediaType]);

  // Fetch AI match analysis
  useEffect(() => {
    setMatchData(null);
    setMatchLoading(true);
    supabase.functions.invoke("movie-match", {
      body: { movie, userCriteria },
    }).then(({ data, error }) => {
      if (error) {
        console.error("Match error:", error);
        setMatchLoading(false);
        return;
      }
      setMatchData(data as MatchData);
      setMatchLoading(false);
    });
  }, [movie.id]);

  return (
    <div ref={ref} className="h-full w-full overflow-y-auto">
      <BrandHeader showBack onBack={onRestart} />

      <div className="relative min-h-screen w-full">
        {/* Cinematic backdrop */}
        {bgImage && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}
        <div className="absolute inset-0 poster-gradient" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end min-h-screen p-5 pb-10 md:p-12 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl"
          >
            {/* Match score badge */}
            {matchData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 mb-3 md:mb-4"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary text-xs md:text-sm font-sans font-semibold">
                  Match {matchData.matchScore}%
                </span>
              </motion.div>
            )}

            {/* Genre tags */}
            {genres && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-primary/80 text-[10px] md:text-xs mb-2 md:mb-3 tracking-[0.15em] uppercase font-sans font-medium"
              >
                {genres}
              </motion.p>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-6xl lg:text-8xl font-serif mb-3 md:mb-4 leading-[1.02]">
              {title}
            </h1>

            {/* Meta row */}
            <div className="flex items-center gap-3 md:gap-4 text-foreground/60 text-xs md:text-sm mb-4 md:mb-5 font-sans flex-wrap">
              {year && <span className="font-medium text-foreground/80">{year}</span>}
              {runtime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {runtime} min
                </span>
              )}
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <Star className="w-3 h-3 fill-primary" />
                  {movie.vote_average.toFixed(1)}
                </span>
              )}
            </div>

            {/* Overview */}
            <p className="text-foreground/70 text-sm md:text-base leading-relaxed mb-5 md:mb-7 max-w-lg font-sans font-light line-clamp-3">
              {overview}
            </p>

            {/* Platform badges */}
            {providers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 md:gap-3 mb-5 md:mb-7"
              >
                <span className="text-foreground/40 text-[10px] md:text-xs font-sans">Disponible sur</span>
                <div className="flex gap-1.5 md:gap-2">
                  {providers.map((p) => (
                    <img
                      key={p.name}
                      src={`${IMG_BASE}/w92${p.logo_path}`}
                      alt={p.name}
                      title={p.name}
                      className="w-7 h-7 md:w-9 md:h-9 rounded-lg object-cover border border-border/30"
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* AI Match Card */}
            <AnimatePresence>
              {matchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 md:mb-7 bg-foreground/5 backdrop-blur-md border border-border/30 rounded-xl p-5 max-w-md w-full"
                >
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-foreground/50 text-sm font-sans">Analyse de votre match…</span>
                  </div>
                </motion.div>
              )}

              {matchData && !matchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="mb-5 md:mb-7 bg-foreground/5 backdrop-blur-md border border-primary/20 rounded-xl p-5 max-w-md w-full space-y-4"
                >
                  <p className="text-sm md:text-base font-serif text-primary font-medium">
                    {matchData.headline}
                  </p>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-primary/70 font-sans font-semibold mb-1">Pourquoi ça matche</p>
                        <p className="text-foreground/70 text-xs md:text-sm font-sans font-light leading-relaxed">{matchData.whyItMatches}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-primary/70 font-sans font-semibold mb-1">Ce que tu vas ressentir</p>
                        <p className="text-foreground/70 text-xs md:text-sm font-sans font-light leading-relaxed">{matchData.emotionalJourney}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <PartyPopper className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-primary/70 font-sans font-semibold mb-1">Moment idéal</p>
                        <p className="text-foreground/70 text-xs md:text-sm font-sans font-light leading-relaxed">{matchData.perfectFor}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-primary/70 font-sans font-semibold mb-1">Le savais-tu ?</p>
                        <p className="text-foreground/70 text-xs md:text-sm font-sans font-light leading-relaxed">{matchData.funFact}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-3"
            >
              {trailerUrl && (
                <Button
                  variant="hero"
                  size="xl"
                  className="text-sm md:text-base"
                  onClick={() => window.open(trailerUrl, "_blank")}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Bande-annonce
                </Button>
              )}

              {hasMore && (
                <Button
                  variant="heroOutline"
                  size="xl"
                  className="text-sm md:text-base"
                  onClick={onShowAnother}
                >
                  <ChevronRight className="w-4 h-4" />
                  Autre suggestion
                </Button>
              )}

              <Button
                variant="ghost"
                size="xl"
                className="text-foreground/50 hover:text-foreground text-sm md:text-base"
                onClick={onRestart}
              >
                <RotateCcw className="w-4 h-4" />
                Recommencer
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
});

ResultScreen.displayName = "ResultScreen";

export default ResultScreen;
