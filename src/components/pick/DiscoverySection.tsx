import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, TrendingUp, Gem, Sparkles } from "lucide-react";
import {
  getTrendingMovies,
  getHiddenGems,
  getTonightsPick,
  getPosterUrl,
  getDisplayTitle,
  getMovieDetails,
} from "@/lib/tmdb";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";
import type { MovieInteractionState } from "@/lib/feedback";
import { inferCatalogMediaType } from "@/lib/catalog";

interface DiscoverySectionProps {
  onMovieSelect: (movie: MovieDetail) => void;
  platformIds?: number[];
  favoriteGenres?: string[];
  minRating?: number;
  excludedGenres?: string[];
}

const DiscoveryMovieCard = ({
  movie,
  onSelect,
  interaction,
}: {
  movie: Movie;
  onSelect: (m: Movie) => void;
  interaction?: MovieInteractionState;
}) => {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [showActions, setShowActions] = useState(false);

  const handleToggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!detail) {
      const mediaType = movie.first_air_date ? "tv" : "movie";
      getMovieDetails(movie.id, mediaType)
        .then((d) => {
          setDetail(d);
          setShowActions(true);
        })
        .catch(() => {});
    } else {
      setShowActions(!showActions);
    }
  };

  return (
    <div className="flex-shrink-0 w-28 md:w-32">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelect(movie)}
        onContextMenu={(e) => {
          e.preventDefault();
          handleToggleActions(e);
        }}
        className="cursor-pointer group w-full"
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
          {interaction?.hasInteraction && (
            <div className="absolute top-1.5 left-1.5">
              <FeedbackBadge
                type={interaction.primaryStatus}
                inWatchlist={interaction.watchlist}
                seen={interaction.seen}
              />
            </div>
          )}
        </div>
        <p className="text-[11px] font-sans text-foreground/70 line-clamp-1 leading-tight px-0.5">
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

const MovieRow = ({
  title,
  icon: Icon,
  movies,
  onSelect,
}: {
  title: string;
  icon: React.ElementType;
  movies: Movie[];
  onSelect: (movie: Movie) => void;
}) => {
  const interactions = useMovieInteractions(movies.map((m) => ({ tmdbId: m.id, mediaType: inferCatalogMediaType(m) })));
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-sans font-semibold text-foreground/80 tracking-wide">{title}</h3>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
        {movies.map((movie) => (
          <DiscoveryMovieCard key={movie.id} movie={movie} onSelect={onSelect} interaction={interactions[movie.id]} />
        ))}
      </div>
    </div>
  );
};

const DiscoverySection = ({
  onMovieSelect,
  platformIds = [],
  favoriteGenres = [],
  minRating = 0,
  excludedGenres = [],
}: DiscoverySectionProps) => {
  const [trending, setTrending] = useState<Movie[]>([]);
  const [gems, setGems] = useState<Movie[]>([]);
  const filterOpts = { minRating, excludedGenres };

  useEffect(() => {
    getTrendingMovies(10, platformIds, favoriteGenres, filterOpts).then(setTrending).catch(console.error);
    getHiddenGems(10, platformIds, favoriteGenres, filterOpts).then(setGems).catch(console.error);
  }, [platformIds.join(","), favoriteGenres.join(","), minRating, excludedGenres.join(",")]);

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
    ></motion.div>
  );
};

export default DiscoverySection;
