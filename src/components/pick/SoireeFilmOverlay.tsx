import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Info, Loader2 } from "lucide-react";
import {
  getBackdropUrl,
  getDisplayTitle,
  getPosterUrl,
  getYear,
  type MovieDetail,
} from "@/lib/tmdb";
import { buildStreamingLinks } from "@/lib/streaming-links";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import AppOverlayPortal from "./AppOverlayPortal";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";

type WatchProvider = { name: string; logo_path: string; provider_id?: number };

interface SoireeFilmOverlayProps {
  open: boolean;
  movie: MovieDetail | null;
  eventTitle?: string;
  matchData?: Record<string, unknown> | null;
  matchLoading?: boolean;
  providers?: WatchProvider[];
  onClose: () => void;
  onOpenDetail: () => void;
}

const IMG_BASE = "https://image.tmdb.org/t/p";

const getTeaser = (
  matchData: Record<string, unknown> | null | undefined,
  overview: string,
) => {
  const md = matchData as {
    summary?: string;
    detailedExplanation?: string;
    pickNote?: string | null;
    whyItMatches?: string;
    reason?: string;
    headline?: string;
    reasons?: string[];
    matchingReasons?: string[];
  } | null | undefined;

  const raw =
    md?.summary ||
    md?.detailedExplanation ||
    md?.pickNote ||
    md?.whyItMatches ||
    md?.reason ||
    md?.headline ||
    md?.reasons?.[0] ||
    md?.matchingReasons?.[0] ||
    overview ||
    "";

  if (!raw) return "";
  return raw.length > 280 ? `${raw.substring(0, 280).trimEnd()}…` : raw;
};

const SoireeFilmOverlay = ({
  open,
  movie,
  eventTitle,
  matchData,
  matchLoading = false,
  providers = [],
  onClose,
  onOpenDetail,
}: SoireeFilmOverlayProps) => {
  const interaction = useMovieInteraction(movie?.id);
  const year = movie ? getYear(movie) : null;
  const primaryGenre = movie?.genres?.[0]?.name ?? null;
  const overview = movie?.overview?.trim() ?? "";
  const title = movie ? getDisplayTitle(movie) : "";
  const teaser = getTeaser(matchData, overview);
  const streamingLinks = useMemo(
    () => (movie && providers.length > 0 ? buildStreamingLinks(providers, title) : []),
    [movie, providers, title],
  );

  const bgImage = movie
    ? getBackdropUrl(movie.backdrop_path) || getPosterUrl(movie.poster_path, "w780")
    : null;

  return (
    <AppOverlayPortal>
    <AnimatePresence>
      {open && movie && (
        <motion.div
          key={`soiree-film-${movie.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 flex flex-col bg-background overflow-hidden"
        >
          {bgImage && (
            <motion.div
              initial={{ scale: 1.08, opacity: 0, filter: "blur(18px)" }}
              animate={{ scale: 1.02, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${bgImage})` }}
            />
          )}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background via-background/85 to-transparent" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/50 via-transparent to-transparent h-32" />

          <div className="relative z-10 flex justify-between items-center px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              onClick={onClose}
              aria-label="Retour à la soirée"
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {eventTitle && (
              <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-primary/70 max-w-[50%] truncate">
                {eventTitle}
              </p>
            )}
          </div>

          <div className="relative z-10 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-center gap-4 mt-4 px-6">
              {movie.poster_path && (
                <button
                  type="button"
                  onClick={onOpenDetail}
                  className="relative group active:scale-[0.97] transition-transform"
                  aria-label="Voir la fiche détaillée"
                >
                  <motion.img
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    src={getPosterUrl(movie.poster_path, "w500") || ""}
                    alt={getDisplayTitle(movie)}
                    className="w-40 h-60 rounded-2xl object-cover shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Info className="w-3.5 h-3.5 text-foreground/70" />
                  </div>
                  {interaction.hasInteraction && (
                    <div className="absolute top-2 left-2">
                      <FeedbackBadge
                        type={interaction.primaryStatus}
                        inWatchlist={interaction.watchlist}
                        size="sm"
                      />
                    </div>
                  )}
                </button>
              )}
            </div>

            <div className="relative z-10 mt-auto px-7 pb-[calc(2rem+60px+env(safe-area-inset-bottom))] overflow-y-auto scrollbar-hide max-h-[55vh]">
              <div className="flex gap-2 mb-4 flex-wrap">
                {year && (
                  <span className="px-2.5 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold font-sans">
                    {year}
                  </span>
                )}
                {primaryGenre && (
                  <span className="px-2.5 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold font-sans">
                    {primaryGenre}
                  </span>
                )}
                <span className="px-2.5 py-1.5 bg-primary/15 backdrop-blur-xl border border-primary/25 rounded-lg text-[9px] text-primary uppercase tracking-widest font-bold font-sans">
                  Pick de la soirée
                </span>
                {providers.slice(0, 3).map((p) => p.logo_path && (
                  <span
                    key={p.provider_id ?? p.name}
                    title={p.name}
                    className="p-1.5 bg-primary/25 backdrop-blur-xl border border-primary/40 rounded-lg flex items-center"
                  >
                    <img
                      src={`${IMG_BASE}/w45${p.logo_path}`}
                      alt={p.name}
                      className="h-5 w-auto rounded object-contain"
                    />
                  </span>
                ))}
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.15 }}
                className="font-serif text-foreground text-[36px] leading-[0.95] tracking-tight mb-4"
              >
                {getDisplayTitle(movie)}
              </motion.h2>

              {matchLoading ? (
                <div className="flex items-center gap-2 text-foreground/45 text-sm font-sans mb-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pick analyse ce choix…
                </div>
              ) : teaser ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.25 }}
                  className="flex items-start gap-3 mb-6"
                >
                  <div className="w-1 self-stretch min-h-[40px] bg-primary rounded-full shrink-0" />
                  <p className="text-foreground/80 text-[14px] italic font-sans leading-relaxed pt-0.5">
                    {teaser}
                  </p>
                </motion.div>
              ) : null}

              {streamingLinks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.3 }}
                  className="mb-6"
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

              <div className="rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/[0.06] p-1.5">
                <MovieActionBar movie={movie} contextType="group_session" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </AppOverlayPortal>
  );
};

export default SoireeFilmOverlay;

