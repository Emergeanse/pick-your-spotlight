import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, TrendingUp, Gem, Sparkles } from "lucide-react";
import { getTrendingMovies, getHiddenGems, getTonightsPick, getPosterUrl, getDisplayTitle, getMovieDetails } from "@/lib/tmdb";
import type { Movie, MovieDetail } from "@/lib/tmdb";

interface DiscoverySectionProps {
  onMovieSelect: (movie: MovieDetail) => void;
  platformIds?: number[];
  favoriteGenres?: string[];
}

const MovieRow = ({ 
  title, 
  icon: Icon, 
  movies, 
  onSelect 
}: { 
  title: string; 
  icon: React.ElementType; 
  movies: Movie[]; 
  onSelect: (movie: Movie) => void;
}) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-3 px-1">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-sans font-semibold text-foreground/80 tracking-wide">{title}</h3>
    </div>
    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
      {movies.map((movie) => (
        <motion.button
          key={movie.id}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(movie)}
          className="flex-shrink-0 w-28 md:w-32 cursor-pointer group"
        >
          <div className="aspect-[2/3] rounded-xl overflow-hidden mb-1.5 relative">
            <img
              src={getPosterUrl(movie.poster_path, "w342")}
              alt={getDisplayTitle(movie)}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
            {movie.vote_average > 0 && (
              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur-sm">
                <Star className="w-2.5 h-2.5 text-primary fill-primary" />
                <span className="text-[9px] font-sans font-semibold text-foreground/90">
                  {movie.vote_average.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] font-sans text-foreground/70 line-clamp-1 leading-tight px-0.5">
            {getDisplayTitle(movie)}
          </p>
        </motion.button>
      ))}
    </div>
  </div>
);

const DiscoverySection = ({ onMovieSelect, platformIds = [], favoriteGenres = [] }: DiscoverySectionProps) => {
  const [trending, setTrending] = useState<Movie[]>([]);
  const [gems, setGems] = useState<Movie[]>([]);
  const [tonightsPick, setTonightsPick] = useState<MovieDetail | null>(null);

  useEffect(() => {
    getTrendingMovies(10, platformIds, favoriteGenres).then(setTrending).catch(console.error);
    getHiddenGems(10, platformIds, favoriteGenres).then(setGems).catch(console.error);
    getTonightsPick(platformIds, favoriteGenres).then(setTonightsPick).catch(console.error);
  }, [platformIds.join(","), favoriteGenres.join(",")]);

  const handleSelect = async (movie: Movie) => {
    try {
      const detail = await getMovieDetails(movie.id, movie.media_type || "movie");
      onMovieSelect(detail);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="w-full"
    >
      {/* Tonight's Pick */}
      {tonightsPick && (
        <motion.button
          onClick={() => onMovieSelect(tonightsPick)}
          whileTap={{ scale: 0.98 }}
          className="w-full mb-6 relative rounded-2xl overflow-hidden cursor-pointer group"
        >
          <div className="aspect-[16/7] relative">
            <img
              src={getPosterUrl(tonightsPick.backdrop_path || tonightsPick.poster_path, "w780")}
              alt={getDisplayTitle(tonightsPick)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-sans font-semibold text-primary uppercase tracking-widest">
                  Le pick du soir
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-serif text-foreground leading-tight">
                {getDisplayTitle(tonightsPick)}
              </h3>
            </div>
          </div>
        </motion.button>
      )}

      <MovieRow title="Tendances" icon={TrendingUp} movies={trending} onSelect={handleSelect} />
      <MovieRow title="Pépites cachées" icon={Gem} movies={gems} onSelect={handleSelect} />
    </motion.div>
  );
};

export default DiscoverySection;
