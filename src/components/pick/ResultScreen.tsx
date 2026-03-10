import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders } from "@/lib/tmdb";

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: () => void;
  onRestart: () => void;
  hasMore: boolean;
}

const IMG_BASE = "https://image.tmdb.org/t/p";

const ResultScreen = ({ movie, onShowAnother, onRestart, hasMore }: ResultScreenProps) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);

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
  }, [movie.id, mediaType]);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative min-h-screen w-full">
        {bgImage && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}

        <div className="absolute inset-0 poster-gradient" />

        <div className="relative z-10 flex flex-col justify-end min-h-screen p-6 md:p-12 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl"
          >
            <p className="text-primary text-xs mb-4 tracking-widest uppercase font-sans font-medium">
              Recommandé pour vous
            </p>

            {genres && (
              <p className="text-muted-foreground text-sm mb-3 tracking-wider uppercase font-sans">
                {genres}
              </p>
            )}

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif mb-4 leading-tight">
              {title}
            </h1>

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

            {/* Streaming platforms */}
            {providers.length > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <span className="text-muted-foreground text-xs font-sans">Disponible sur</span>
                <div className="flex gap-2">
                  {providers.map((p) => (
                    <img
                      key={p.name}
                      src={`${IMG_BASE}/w92${p.logo_path}`}
                      alt={p.name}
                      title={p.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mb-10 max-w-lg font-sans font-light">
              {overview.length > 200 ? overview.substring(0, 200) + "…" : overview}
            </p>

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
