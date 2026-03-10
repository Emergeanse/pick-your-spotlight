import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink, RotateCcw, ChevronRight, Star, Clock } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders, getMovieTrailerUrl } from "@/lib/tmdb";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";

const IMG_BASE = "https://image.tmdb.org/t/p";

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

const moodLabels: Record<Mood, string> = {
  relax: "Détente",
  excited: "Adrénaline",
  romantic: "Romance",
  "mind-blowing": "Vertige",
  "easy-watch": "Léger",
  fun: "Rire",
};

const ResultScreen = ({ movie, onShowAnother, onRestart, hasMore, userCriteria }: ResultScreenProps) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);

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

  return (
    <div className="h-full w-full overflow-y-auto">
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
            <p className="text-foreground/70 text-sm md:text-base leading-relaxed mb-5 md:mb-7 max-w-lg font-sans font-light line-clamp-4">
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

            {/* Mood match tag */}
            {userCriteria?.mood && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mb-5 md:mb-7"
              >
                <span className="bg-primary/15 text-primary text-[10px] md:text-xs font-sans font-medium px-3 py-1.5 rounded-full border border-primary/20">
                  Parfait pour une soirée « {moodLabels[userCriteria.mood]} »
                </span>
              </motion.div>
            )}

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
};

export default ResultScreen;
