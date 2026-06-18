import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Star, Zap, Tv } from "lucide-react";
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
  matchScore,
}: {
  movie: MovieDetail;
  onOpenDetails?: () => void;
  matchScore?: number | null;
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
  const score =
    matchScore ??
    (movie as any).recommendationTexts?.confidence ??
    (movie as any).recommendationTexts?.matchScore ??
    (movie as any).recommendationTexts?.score ??
    null;

  const emotionalScoreLabel = (s: number | null): string | null => {
    if (s == null) return null;
    if (s >= 92) return "Presque parfait pour toi";
    if (s >= 85) return "Très forte correspondance";
    if (s >= 78) return "Je pense vraiment qu'il va te plaire";
    if (s >= 68) return "Ça devrait te parler";
    return "À tester — ça peut surprendre";
  };
  const scoreLabel = emotionalScoreLabel(typeof score === "number" ? score : null);

  const PosterEl = (
    <>
      {/* Ambient halo behind poster */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -inset-6 rounded-3xl -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.4) 0%, hsl(var(--primary) / 0.12) 45%, transparent 70%)",
          filter: "blur(22px)",
        }}
      />
      <motion.img
        src={getPosterUrl(movie.poster_path, "w342") || ""}
        alt={title}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-20 h-[120px] md:w-28 md:h-[168px] rounded-xl object-cover shadow-[0_22px_60px_-12px_rgba(0,0,0,0.65),0_0_28px_-6px_hsl(var(--primary)/0.45)] border border-white/10"
      />
      {/* Cinematic reflection sweep */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: "-120%" }}
        animate={{ opacity: [0, 0.6, 0], x: "180%" }}
        transition={{ duration: 1.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden"
      >
        <div
          className="absolute inset-y-0 w-1/3"
          style={{
            background:
              "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
            filter: "blur(2px)",
          }}
        />
      </motion.div>
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
          initial={{ opacity: 0, scale: 0.92, filter: "blur(14px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative shrink-0"
        >
          {onOpenDetails ? (
            <button type="button" onClick={onOpenDetails} className="relative block cursor-pointer">
              {PosterEl}
            </button>
          ) : (
            <div className="relative">{PosterEl}</div>
          )}
          {scoreLabel && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="mt-3 max-w-[180px] text-center"
            >
              <p className="font-serif italic text-[12px] leading-tight text-primary/90 tracking-tight">
                « {scoreLabel} »
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
      <div className="flex-1 min-w-0">
        {onOpenDetails ? (
          <button type="button" onClick={onOpenDetails} className="text-left w-full cursor-pointer">
            <motion.h1
              initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl md:text-4xl lg:text-5xl font-serif mb-1.5 leading-[1.05]"
            >
              {title}
            </motion.h1>
          </button>
        ) : (
          <motion.h1
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl md:text-4xl lg:text-5xl font-serif mb-1.5 leading-[1.05]"
          >
            {title}
          </motion.h1>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="flex items-center gap-2 text-foreground/50 text-xs font-sans mb-1 flex-wrap"
        >
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-sans font-semibold uppercase tracking-wide">
            {mediaLabel}
          </span>
          {year && <span className="font-medium text-foreground/70">{year}</span>}
          {mediaType === "tv" && seasons && seasons > 0 && (
            <>
              <span className="text-foreground/40">•</span>
              <span>
                {seasons} saison{seasons > 1 ? "s" : ""}
              </span>
            </>
          )}
          {runtime > 0 && (
            <>
              <span className="text-foreground/40">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {runtime} min
              </span>
            </>
          )}
          {movie.vote_average > 0 && (
            <>
              <span className="text-foreground/40">•</span>
              <span className="flex items-center gap-1 text-primary font-medium">
                <Star className="w-3 h-3 fill-primary" />
                {movie.vote_average.toFixed(1)}
              </span>
            </>
          )}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.5 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {genres && (
            <p className="text-primary/60 text-[10px] md:text-xs tracking-[0.12em] uppercase font-sans font-medium">
              {genres}
            </p>
          )}
          {(movie as any)._surpriseComfortZone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30"
            >
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-amber-400 text-[10px] font-sans font-semibold">Hors de ta zone</span>
            </motion.div>
          )}
        </motion.div>
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
  showActionBar?: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  className?: string;
  matchScore?: number | null;
}

const RecommendationMovieCard = ({
  movie,
  sessionId,
  contextType,
  onOpenDetails,
  showPrimaryAction = true,
  showActionBar = true,
  onPrimaryAction,
  primaryActionLabel = "On regarde ?",
  className = "",
  matchScore,
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
          <RecommendationMovieCardHeader movie={movie} onOpenDetails={onOpenDetails} matchScore={matchScore} />

          <p className="text-sm md:text-base text-foreground/78 leading-relaxed font-sans line-clamp-3 mb-5">
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
              <p className="text-[10px] uppercase tracking-widest text-foreground/45 font-sans font-semibold mb-2">
                Où regarder
              </p>
              <div className="flex flex-wrap gap-2">
                {streamingLinks.map((link) => (
                  <a
                    key={link.providerId}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.name}
                    className="opacity-80 hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {link.logo_path && (
                      <img
                        src={`${IMG_BASE}/original${link.logo_path}`}
                        alt={link.name}
                        className="h-10 w-10 object-cover rounded-xl"
                      />
                    )}
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

          {showActionBar && (
            <div onClick={(e) => e.stopPropagation()}>
              <MovieActionBar movie={movie} sessionId={sessionId} contextType={contextType} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default RecommendationMovieCard;
