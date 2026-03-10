import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Movie } from "@/lib/tmdb";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";

interface TrendingRowProps {
  title: string;
  fetchFn: () => Promise<Movie[]>;
  onMovieClick?: (movie: Movie) => void;
}

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
          className="absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer hidden md:flex"
        >
          <ChevronLeft className="w-5 h-5 text-foreground/60" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2.5 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-0 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {movies.map((movie, i) => (
            <motion.button
              key={movie.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => onMovieClick?.(movie)}
              className="flex-shrink-0 snap-start group/card cursor-pointer"
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
              </div>
              <p className="mt-1.5 md:mt-2 text-[11px] md:text-sm font-sans text-foreground/70 truncate w-28 md:w-40 text-left">
                {getDisplayTitle(movie)}
              </p>
            </motion.button>
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer hidden md:flex"
        >
          <ChevronRight className="w-5 h-5 text-foreground/60" />
        </button>
      </div>
    </div>
  );
};

export default TrendingRow;
