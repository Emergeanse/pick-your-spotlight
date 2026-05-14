import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Star, Zap, Tv, ExternalLink } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getPosterUrl, getBackdropUrl, getWatchProviders } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import FeedbackBadge from "./FeedbackBadge";
import MovieActionBar from "./MovieActionBar";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import { inferCatalogMediaType } from "@/lib/catalog";
import { buildStreamingLinks, type StreamingLink } from "@/lib/streaming-links";

const IMG_BASE = "https://image.tmdb.org/t/p";

export const RecommendationMovieCardHeader = ({
  movie,
  onOpenDetails,
}: {
  movie: MovieDetail;
  onOpenDetails?: () => void;
}) => {
  const interaction = useMovieInteraction(movie.id, inferCatalogMediaType(movie));
  const currentFeedback = interaction.primaryStatus;
  const bookmarked = interaction.watchlist;

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const runtime = movie.runtime || movie.episode_run_time?.[0] || 0;
  const genres = movie.genres?.map((g) => g.name).join(" · ") || "";
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const isDocumentary = movie.genres?.some((g) => g.id === 99);
  const mediaLabel = isDocumentary ? "Documentaire" : mediaType === "tv" ? "Série" : "Film";
  const seasons = (movie as any).number_of_seasons;

  const PosterEl = (
    <>
      <img
        src={getPosterUrl(movie.poster_path, "w342") || ""}
        alt={title}
        className="w-20 h-[120px] md:w-28 md:h-[168px] rounded-xl object-cover shadow-2xl border border-border/20"
      />
      {(currentFeedback || bookmarked) && (
        <div className="absolute top-1.5 left-1.5 pointer-events-none">
          <FeedbackBadge type={currentFeedback} inWatchlist={bookmarked} seen={interaction.seen} size="sm" />
        </div>
      )}
    </>
  );

  return (
    <div className="flex items-end gap-4 mb-3">
      {movie.poster_path && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="relative shrink-0"
        >
          {onOpenDetails ? (
            <button type="button" onClick={onOpenDetails} className="relative block cursor-pointer">
              {PosterEl}
            </button>
          ) : (
            <div className="relative">{PosterEl}</div>
          )}
        </motion.div>
      )}
      <div className="flex-1 min-w-0">
        {onOpenDetails ? (
          <button type="button" onClick={onOpenDetails} className="text-left w-full cursor-pointer">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif mb-1.5 leading-[1.05]">{title}</h1>
          </button>
        ) : (
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif mb-1.5 leading-[1.05]">{title}</h1>
        )}
        <div className="flex items-center gap-2 text-foreground/50 text-xs font-sans mb-1 flex-wrap">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-sans font-semibold uppercase tracking-wide">
            {mediaLabel}
          </span>
          {year && <span className="font-medium text-foreground/70">{year}</span>}
          {mediaType === "tv" && seasons && seasons > 0 && (
            <>
              <span className="text-foreground/20">•</span>
              <span>
                {seasons} saison{seasons > 1 ? "s" : ""}
              </span>
            </>
          )}
          {runtime > 0 && (
            <>
              <span className="text-foreground/20">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {runtime} min
              </span>
            </>
          )}
          {movie.vote_average > 0 && (
            <>
              <span className="text-foreground/20">•</span>
              <span className="flex items-center gap-1 text-primary font-medium">
                <Star className="w-3 h-3 fill-primary" />
                {movie.vote_average.toFixed(1)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {genres && (
            <p className="text-primary/60 text-[10px] md:text-xs tracking-[0.12em] uppercase font-sans font-medium">
              {genres}
            </p>
          )}
          {(movie as any)._surpriseComfortZone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30"
            >
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-amber-400 text-[10px] font-sans font-semibold">Hors de ta zone</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface RecommendationMovieCardProps {
  movie: MovieDetail;
  sessionId?: string | null;
  contextType?: "solo_session" | "group_session" | "browse";
  onOpenDetails?: () => void;
  showPrimaryAction?: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  className?: string;
}

const RecommendationMovieCard = ({
  movie,
  sessionId,
  contextType,
  onOpenDetails,
  showPrimaryAction = true,
  onPrimaryAction,
  primaryActionLabel = "On regarde ?",
  className = "",
}: RecommendationMovieCardProps) => {
  const [streamingLinks, setStreamingLinks] = useState<StreamingLink[]>([]);

  const title = getDisplayTitle(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const overview = movie.overview || "Aucune description disponible.";
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const bgImage = backdrop || poster;

  useEffect(() => {
    getWatchProviders(movie.id, mediaType)
      .then((p) => setStreamingLinks(buildStreamingLinks(p, title)))
      .catch(() => setStreamingLinks([]));
  }, [movie.id, mediaType, title]);

  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${className}`}>
      {bgImage && (
        <motion.div
          initial={{ opacity: 0, scale: 1.15 }}
          animate={{ opacity: 0.6, scale: 0.85 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <div className="absolute inset-0 poster-gradient" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />

      <div className="relative z-10 flex flex-col justify-end min-h-screen px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-12 lg:px-16 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`max-w-xl ${onOpenDetails ? "cursor-pointer" : ""}`}
          onClick={onOpenDetails}
        >
          <RecommendationMovieCardHeader movie={movie} onOpenDetails={onOpenDetails} />

          <p className="text-sm md:text-base text-foreground/78 leading-relaxed font-sans line-clamp-4 mb-5">
            {overview}
          </p>

          {streamingLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mb-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
                Où regarder
              </p>
              <div className="flex flex-wrap gap-2">
                {streamingLinks.map((link) => (
                  <a
                    key={link.providerId}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/[0.04] border border-border/15 hover:border-primary/25 hover:bg-foreground/[0.08] transition-all group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {link.logo_path && (
                      <img
                        src={`${IMG_BASE}/w92${link.logo_path}`}
                        alt={link.name}
                        className="w-5 h-5 rounded-md object-contain"
                      />
                    )}
                    <span className="text-foreground/60 text-[12px] font-sans font-medium group-hover:text-foreground transition-colors">
                      {link.name}
                    </span>
                    <ExternalLink className="w-3 h-3 text-foreground/30 group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {showPrimaryAction && onPrimaryAction && (
            <div className="mb-4" onClick={(e) => e.stopPropagation()}>
              <Button variant="hero" size="xl" className="w-full md:w-auto" onClick={onPrimaryAction}>
                {primaryActionLabel}
              </Button>
            </div>
          )}

          <div onClick={(e) => e.stopPropagation()}>
            <MovieActionBar movie={movie} sessionId={sessionId} contextType={contextType} />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RecommendationMovieCard;
