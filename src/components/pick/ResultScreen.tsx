import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl } from "@/lib/tmdb";

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: () => void;
  onRestart: () => void;
  hasMore: boolean;
}

const ResultScreen = ({ movie, onShowAnother, onRestart, hasMore }: ResultScreenProps) => {
  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const runtime = movie.runtime || (movie.episode_run_time?.[0]) || 0;
  const genres = movie.genres?.map(g => g.name).join(", ") || "";
  const overview = movie.overview || "Aucune description disponible.";

  const bgImage = backdrop || poster;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative min-h-screen w-full">
        {/* Full-screen backdrop */}
        {bgImage && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 poster-gradient" />

        {/* Content overlay at the bottom */}
        <div className="relative z-10 flex flex-col justify-end min-h-screen p-6 md:p-12 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl"
          >
            {/* Genres */}
            {genres && (
              <p className="text-muted-foreground text-sm mb-3 tracking-wider uppercase font-sans">
                {genres}
              </p>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif mb-4 leading-tight">
              {title}
            </h1>

            {/* Metadata row */}
            <div className="flex items-center gap-4 text-muted-foreground text-sm mb-6 font-sans">
              {year && <span>{year}</span>}
              {runtime > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <span>{runtime} min</span>
                </>
              )}
              {movie.vote_average > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <span>★ {movie.vote_average.toFixed(1)}</span>
                </>
              )}
            </div>

            {/* Overview */}
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mb-10 max-w-lg font-sans font-light">
              {overview.length > 200 ? overview.substring(0, 200) + "…" : overview}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              {hasMore && (
                <Button
                  variant="heroOutline"
                  size="xl"
                  onClick={onShowAnother}
                >
                  Autre suggestion
                </Button>
              )}
              <Button
                variant="ghost"
                size="xl"
                className="text-muted-foreground hover:text-foreground"
                onClick={onRestart}
              >
                Recommencer
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;
