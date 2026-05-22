import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Dices, Loader2, Sparkles, Target, Tv, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBackdropUrl, getDisplayTitle, getPosterUrl, type MovieDetail } from "@/lib/tmdb";
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
  onOpenDetail: () => void;
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
  onOpenDetail,
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
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-40 flex flex-col"
        >
          {/* Cinematic background — backdrop bleeds full screen */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
            style={{
              backgroundImage: `url(${getBackdropUrl(movie.backdrop_path) || getPosterUrl(movie.poster_path, "w780")})`,
            }}
          />
          {/* Deep gradient: transparent top → semi-opaque bottom for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-background/55 to-transparent" />
          {/* Subtle vignette sides */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />

          {/* Top bar — Retour + label */}
          <div className="relative z-10 flex justify-between items-center px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-foreground/60 hover:text-foreground text-xs font-sans transition-colors backdrop-blur-sm bg-background/20 px-3 py-1.5 rounded-full border border-border/20"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Retour
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-primary text-[11px] font-sans font-semibold">{getTonightPickLabel()}</span>
            </div>
          </div>

          {/* Main content — anchored to bottom half (Netflix style) */}
          <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">

            {/* Poster + nav — dominant hero image */}
            {movie.poster_path && (
              <div className="flex justify-center mb-5">
                <div className="relative flex items-center gap-4">
                  <motion.button
                    onClick={onPrev}
                    disabled={!canGoPrev}
                    whileTap={{ scale: 0.88 }}
                    className="w-11 h-11 rounded-full bg-background/50 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xl"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </motion.button>

                  <div className="relative">
                    <motion.img
                      key={movie.id}
                      initial={{ opacity: 0, scale: 0.92, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: -8 }}
                      transition={{ duration: 0.35, type: "spring", stiffness: 260, damping: 24 }}
                      src={getPosterUrl(movie.poster_path, "w500") || ""}
                      alt={getDisplayTitle(movie)}
                      className="w-56 h-[336px] md:w-64 md:h-[384px] rounded-2xl object-cover shadow-[0_24px_60px_-8px_rgba(0,0,0,0.7)] border border-white/10 cursor-pointer active:scale-[0.97] transition-transform"
                      onClick={onOpenDetail}
                    />
                    {/* "Tap pour détails" hint */}
                    <div className="absolute bottom-2.5 right-2.5 bg-background/60 backdrop-blur-md rounded-full p-1.5 border border-border/20 pointer-events-none">
                      <Info className="w-3.5 h-3.5 text-foreground/50" />
                    </div>
                    {interaction.hasInteraction && (
                      <div className="absolute top-2.5 left-2.5">
                        <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} size="sm" />
                      </div>
                    )}
                  </div>

                  <motion.button
                    onClick={onNext}
                    disabled={!canGoNext}
                    whileTap={{ scale: 0.88 }}
                    className="w-11 h-11 rounded-full bg-background/50 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xl"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* Film info block */}
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="flex flex-col items-center text-center"
            >
              {/* Pagination dots */}
              {tonightPool.length > 1 && (
                <div className="flex items-center gap-1.5 mb-3">
                  {tonightPool.map((_, i) => (
                    <span
                      key={i}
                      className={`block rounded-full transition-all duration-300 ${
                        i === tonightPickIndex
                          ? "w-4 h-1.5 bg-primary"
                          : "w-1.5 h-1.5 bg-foreground/25"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Title — large, serif, cinematic */}
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground leading-tight mb-1 px-2">
                {getDisplayTitle(movie)}
              </h2>

              {/* Genres + year */}
              <div className="flex items-center gap-2 flex-wrap justify-center mb-2">
                {movie.genres && (
                  <p className="text-foreground/50 text-[11px] tracking-[0.1em] uppercase font-sans font-medium">
                    {movie.genres.map((g) => g.name).join(" · ")}
                  </p>
                )}
                {(movie.release_date || (movie as any).first_air_date) && (
                  <>
                    <span className="text-foreground/20 text-[10px]">·</span>
                    <span className="text-foreground/40 text-[11px] font-sans">
                      {((movie.release_date || (movie as any).first_air_date) as string).substring(0, 4)}
                    </span>
                  </>
                )}
              </div>

              {/* Streaming platforms */}
              {tonightProviders.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-foreground/30 text-[10px] font-sans uppercase tracking-wider">Dispo sur</span>
                  <div className="flex gap-1.5">
                    {tonightProviders.map((p) => (
                      <img
                        key={p.name}
                        src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                        alt={p.name}
                        className="w-6 h-6 rounded-lg object-cover border border-border/20 shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* AI score + teaser — prominent block */}
              {(() => {
                // recFromPool is updated by background enrichment — prefer it over recFromMovie
                // so the personalized movie-match text replaces the generic surprise-personalized reason.
                const recFromPool = (tonightPool || []).find(
                  (m) => m?.id === movie.id && (m as any).recommendationTexts,
                );
                const recFromMovie: any = (movie as any).recommendationTexts || null;

                const rec: any =
                  (recFromPool ? (recFromPool as any).recommendationTexts : null) || recFromMovie || null;

                const adhesionScore = rec?.matchScore ?? rec?.score ?? rec?.confidence ?? matchInfo?.confidence ?? null;

                const asStr = (v: unknown): string | null =>
                  typeof v === "string" && v.length > 0 ? v : null;

                const richTeaser =
                  asStr(rec?.summary) ||
                  asStr(rec?.detailedExplanation) ||
                  asStr(rec?.whyItMatches) ||
                  asStr(rec?.headline) ||
                  asStr(rec?.pickNote);

                // Only fall back to generic reason/matchInfo if no rich text is available
                const recReason = asStr(rec?.reason);
                const matchReason = asStr(matchInfo?.reason);
                const teaser =
                  richTeaser ||
                  (recReason && recReason.length > 40 ? recReason : null) ||
                  (matchReason && matchReason.length > 40 ? matchReason : null) ||
                  null;

                if (adhesionScore != null || teaser) {
                  return (
                    <div className="w-full max-w-xs flex flex-col items-center gap-2 mb-4">
                      {adhesionScore != null && (
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/30 backdrop-blur-md shadow-sm">
                          <Target className="w-3.5 h-3.5 text-primary" />
                          <span className="text-primary text-sm font-sans font-bold tracking-wide">
                            {adhesionScore}% d’adhésion
                          </span>
                        </div>
                      )}
                      {teaser && (
                        <p className="text-foreground/65 text-[12px] font-sans text-center leading-relaxed max-w-[280px]">
                          {teaser.length > 130 ? `${teaser.substring(0, 130).trimEnd()}…` : teaser}
                        </p>
                      )}
                    </div>
                  );
                }

                return (
                  <p className="text-foreground/35 text-[12px] font-sans italic mb-4">
                    Pick pense que {movie.first_air_date ? "cette série est parfaite" : "ce film est parfait"} pour toi.
                  </p>
                );
              })()}

              {/* Actions */}
              <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <Button
                  size="lg"
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-8 h-12 gap-2 text-base neon-glow transition-all active:scale-[0.97] w-full shadow-lg"
                  onClick={onConfirm}
                >
                  <Tv className="w-5 h-5" />
                  On regarde ?
                </Button>

                <div className="flex flex-col items-center gap-1">
                  {tonightAllVisited || tonightLoading ? (
                    <button
                      onClick={onMoreSuggestions}
                      disabled={tonightLoading}
                      className="text-sm font-sans transition-all flex items-center gap-1.5 text-foreground/45 hover:text-foreground/65 disabled:opacity-50"
                    >
                      {tonightLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Dices className="w-3.5 h-3.5" />}
                      {displayCount} autre{displayCount > 1 ? "s" : ""} suggestion{displayCount > 1 ? "s" : ""}
                    </button>
                  ) : tonightPool.length > 0 ? (
                    <p className="text-foreground/25 text-[10px] font-sans text-center">
                      Parcourez les {displayCount} films pour débloquer ({tonightSeenMovieIds.size}/{displayCount})
                    </p>
                  ) : null}
                </div>

                <MovieActionBar key={movie.id} movie={movie} onInteraction={onInteraction} />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TonightPickOverlay;
