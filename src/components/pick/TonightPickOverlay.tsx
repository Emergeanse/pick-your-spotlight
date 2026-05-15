import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Loader2,
  Sparkles,
  Target,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getBackdropUrl,
  getDisplayTitle,
  getPosterUrl,
  type MovieDetail,
} from "@/lib/tmdb";
import { getTonightPickLabel } from "@/lib/time-context";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";

interface TonightPickOverlayProps {
  open: boolean;
  movie: MovieDetail | null;
  tonightPool: MovieDetail[];
  tonightPickIndex: number;
  tonightSeenMovieIds: Set<number>;
  tonightProviders: { name: string; logo_path: string }[];
  movieMatchData: Record<number, { confidence: number; reason: string }>;
  canGoPrev: boolean;
  canGoNext: boolean;
  tonightAllVisited: boolean;
  tonightLoading: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onConfirm: () => void;
  onInteraction: (type: string) => void;
  onMoreSuggestions: () => void;
  expectedCount?: number;
}

const TonightPickOverlay = ({
  open,
  movie,
  tonightPool,
  tonightPickIndex,
  tonightSeenMovieIds,
  tonightProviders,
  movieMatchData,
  canGoPrev,
  canGoNext,
  tonightAllVisited,
  tonightLoading,
  onClose,
  onPrev,
  onNext,
  onConfirm,
  onInteraction,
  onMoreSuggestions,
  expectedCount,
}: TonightPickOverlayProps) => {
  const interaction = useMovieInteraction(movie?.id);
  const displayCount = expectedCount ?? tonightPool.length;

  if (!movie) return null;

  const matchInfo = movieMatchData[movie.id];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex flex-col"
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${
                getBackdropUrl(movie.backdrop_path) ||
                getPosterUrl(movie.poster_path, "w780")
              })`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />

          <div className="relative z-10 flex justify-between items-center px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              onClick={onClose}
              className="text-foreground/50 hover:text-foreground text-xs font-sans transition-colors"
            >
              ← Retour
            </button>
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 mb-3">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-primary text-[11px] font-sans font-semibold">
                  {getTonightPickLabel()}
                </span>
              </div>

              {movie.poster_path && (
                <div className="relative flex items-center gap-3 mb-3">
                  <button
                    onClick={onPrev}
                    disabled={!canGoPrev}
                    className="w-10 h-10 rounded-full bg-card/60 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>

                  <motion.img
                    key={movie.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
                    src={getPosterUrl(movie.poster_path, "w342") || ""}
                    alt={getDisplayTitle(movie)}
                    className="w-32 h-48 md:w-40 md:h-56 rounded-xl object-cover shadow-2xl border border-border/20 cursor-pointer active:scale-95 transition-transform"
                    onClick={onConfirm}
                  />

                  {interaction.hasInteraction && (
                    <div className="absolute top-2 left-14 md:left-16">
                      <FeedbackBadge
                        type={interaction.primaryStatus}
                        inWatchlist={interaction.watchlist}
                        size="sm"
                      />
                    </div>
                  )}

                  <button
                    onClick={onNext}
                    disabled={!canGoNext}
                    className="w-10 h-10 rounded-full bg-card/60 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                </div>
              )}

              <p className="text-foreground text-sm font-sans font-semibold tabular-nums px-3 py-1 rounded-full bg-card/60 backdrop-blur-md border border-border/30 shadow-lg mb-2">
                {tonightPickIndex + 1} / {displayCount}
              </p>

              <h2 className="text-lg md:text-xl font-serif text-foreground mb-0.5">
                {getDisplayTitle(movie)}
              </h2>

              {movie.genres && (
                <p className="text-primary/60 text-[10px] tracking-[0.12em] uppercase font-sans font-medium mb-2">
                  {movie.genres.map((g) => g.name).join(" · ")}
                </p>
              )}

              {tonightProviders.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-foreground/30 text-[10px] font-sans">
                    Dispo sur
                  </span>
                  <div className="flex gap-1.5">
                    {tonightProviders.map((p) => (
                      <img
                        key={p.name}
                        src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                        alt={p.name}
                        className="w-5 h-5 rounded-md object-cover border border-border/20"
                      />
                    ))}
                  </div>
                </div>
              )}

              {matchInfo?.confidence ? (
                <div className="flex flex-col items-center gap-1.5 mb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Target className="w-3 h-3 text-primary/70" />
                    <span className="text-primary/90 text-[12px] font-sans font-semibold">
                      {matchInfo.confidence}% match
                    </span>
                  </div>
                  {matchInfo.reason && (
                    <p className="text-foreground/50 text-[11px] font-sans text-center leading-snug max-w-[260px]">
                      {matchInfo.reason}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-foreground/40 text-[12px] font-sans italic mb-3">
                  Pick pense que{" "}
                  {movie.first_air_date
                    ? "cette série est parfaite"
                    : "ce film est parfait"}{" "}
                  pour toi.
                </p>
              )}

              <div className="flex flex-col items-center gap-4 w-full">
                <Button
                  size="lg"
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-8 h-12 gap-2 text-base neon-glow transition-all active:scale-[0.97] w-full max-w-xs"
                  onClick={onConfirm}
                >
                  <Tv className="w-5 h-5" />
                  On regarde ?
                </Button>

                <MovieActionBar
                  key={movie.id}
                  movie={movie}
                  onInteraction={onInteraction}
                />

                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <button
                    onClick={onMoreSuggestions}
                    disabled={tonightLoading || !tonightAllVisited}
                    className={`text-[12px] font-sans transition-all flex items-center gap-1.5 ${
                      tonightAllVisited
                        ? "text-foreground/40 hover:text-foreground/60"
                        : "text-foreground/20 cursor-not-allowed"
                    } disabled:opacity-50`}
                  >
                    {tonightLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Dices className="w-3 h-3" />
                    )}
                    {Math.max(displayCount - 1, 1)} autre{Math.max(displayCount - 1, 1) > 1 ? "s" : ""} suggestion{Math.max(displayCount - 1, 1) > 1 ? "s" : ""}
                  </button>

                  {!tonightAllVisited && tonightPool.length > 0 && (
                    <p className="text-foreground/25 text-[10px] font-sans text-center">
                      Parcourez les {displayCount} films pour débloquer (
                      {tonightSeenMovieIds.size}/{displayCount})
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TonightPickOverlay;
