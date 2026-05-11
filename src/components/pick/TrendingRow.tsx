import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import { getPosterUrl, getDisplayTitle, getWatchProviders, getMovieDetails } from "@/lib/tmdb";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";
import { useFeedbackMap } from "@/hooks/use-feedback-map";
import type { FeedbackType } from "@/lib/feedback";

interface TrendingRowProps {
  title: string;
  fetchFn: () => Promise<Movie[]>;
  onMovieClick?: (movie: Movie) => void;
}

const IMG_BASE = "https://image.tmdb.org/t/p";

const MovieCard = ({ movie, index, onMovieClick, feedbackType }: { movie: Movie; index: number; onMovieClick?: (m: Movie) => void; feedbackType?: FeedbackType }) => {
  const [provider, setProvider] = useState<{ name: string; logo_path: string } | null>(null);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const mediaType = movie.first_air_date ? "tv" : "movie";
    getWatchProviders(movie.id, mediaType)
      .then(providers => { if (providers.length > 0) setProvider(providers[0]); })
      .catch(() => {});
  }, [movie.id]);

  const handleLongPress = () => {
    if (!detail) {
      const mediaType = movie.first_air_date ? "tv" : "movie";
      getMovieDetails(movie.id, mediaType).then(d => { setDetail(d); setShowActions(true); }).catch(() => {});
    } else {
      setShowActions(!showActions);
    }
  };

  return (
    <div className="flex-shrink-0 snap-start">
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        onClick={() => onMovieClick?.(movie)}
        onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}
        className="group/card cursor-pointer"
      >
        <div className="relative w-28 md:w-40 aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden">
          <img
            src={getPosterUrl(movie.poster_path, "w342")}
            alt={getDisplayTitle(movie)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

          {movie.vote_average > 0 && (
            <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 bg-background/80 backdrop-blur-sm text-primary text-[10px] md:text-xs font-sans font-semibold px-1.5 py-0.5 rounded-md">
              ★ {movie.vote_average.toFixed(1)}
            </div>
          )}

          {provider && (
            <div className="absolute bottom-1.5 left-1.5 md:bottom-2 md:left-2">
              <img
                src={`${IMG_BASE}/w92${provider.logo_path}`}
                alt={provider.name}
                className="w-5 h-5 md:w-6 md:h-6 rounded-md object-cover border border-border/30"
              />
            </div>
          )}
        </div>
        <p className="mt-1.5 md:mt-2 text-[11px] md:text-sm font-sans text-foreground/70 truncate w-28 md:w-40 text-left">
          {getDisplayTitle(movie)}
        </p>
      </motion.button>
      {showActions && detail && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1">
          <MovieActionBar key={detail.id} movie={detail} size="sm" />
        </motion.div>
      )}
    </div>
  );
};

const TrendingRow = ({ title, fetchFn, onMovieClick }: TrendingRowProps) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFn().then(setMovies).catch(() => {});
  }, []);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (movies.length === 0) return null;

  return (
    <div className="relative group">
      <h3 className="text-sm md:text-base font-sans font-medium text-foreground/70 uppercase tracking-widest mb-3 md:mb-4 px-4 md:px-0">
        {title}
      </h3>

      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-8 z-10 w-10 bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center cursor-pointer hidden md:flex"
        >
          <ChevronLeft className="w-5 h-5 text-foreground/60" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2.5 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-0 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {movies.map((movie, i) => (
            <MovieCard key={movie.id} movie={movie} index={i} onMovieClick={onMovieClick} />
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-8 z-10 w-10 bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center cursor-pointer hidden md:flex"
        >
          <ChevronRight className="w-5 h-5 text-foreground/60" />
        </button>
      </div>
    </div>
  );
};

export default TrendingRow;
