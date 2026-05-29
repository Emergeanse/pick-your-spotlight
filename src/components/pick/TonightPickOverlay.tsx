import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Dices, Loader2, Info } from "lucide-react";
import { getBackdropUrl, getDisplayTitle, getPosterUrl, type MovieDetail } from "@/lib/tmdb";
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
  const [hazelnutError, setHazelnutError] = useState(false);

  if (!movie) return null;

  const matchInfo = movieMatchData[movie.id];

  // Resolve rich recommendation text + adhesion score (same logic as before)
  const recFromPool = (tonightPool || []).find(
    (m) => m?.id === movie.id && (m as any).recommendationTexts,
  );
  const recFromMovie: any = (movie as any).recommendationTexts || null;
  const rec: any =
    (recFromPool ? (recFromPool as any).recommendationTexts : null) || recFromMovie || null;
  const adhesionScore = rec?.matchScore ?? rec?.score ?? rec?.confidence ?? matchInfo?.confidence ?? null;
  const asStr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  const richTeaser =
    asStr(rec?.summary) ||
    asStr(rec?.detailedExplanation) ||
    asStr(rec?.whyItMatches) ||
    asStr(rec?.headline) ||
    asStr(rec?.pickNote);
  const recReason = asStr(rec?.reason);
  const matchReason = asStr(matchInfo?.reason);
  const teaser =
    richTeaser ||
    (recReason && recReason.length > 40 ? recReason : null) ||
    (matchReason && matchReason.length > 40 ? matchReason : null) ||
    `Pick pense que ${movie.first_air_date ? "cette série est faite" : "ce film est fait"} pour toi.`;

  const year = ((movie.release_date || (movie as any).first_air_date) as string | undefined)?.substring(0, 4);
  const primaryGenre = movie.genres?.[0]?.name;

  // Hazelnut match indicator
  const hazelnutStyle = (() => {
    const s = adhesionScore ?? 0;
    const scale = 0.55 + (s / 100) * 1.05; // 0.55 → 1.6

    if (s >= 90) return {
      filter: "grayscale(0%) sepia(0.25) saturate(2.6) brightness(1.15) hue-rotate(-12deg) drop-shadow(0 0 10px rgba(251,146,60,0.9))",
      opacity: 1, scale, textColor: "text-white", glow: true, rings: 3,
    };
    if (s >= 80) return {
      filter: "grayscale(0%) sepia(0.2) saturate(2.0) brightness(1.1) hue-rotate(-10deg) drop-shadow(0 0 7px rgba(234,179,8,0.75))",
      opacity: 0.97, scale, textColor: "text-white", glow: true, rings: 2,
    };
    if (s >= 70) return {
      filter: "grayscale(10%) sepia(0.1) saturate(1.4) brightness(1.0) drop-shadow(0 0 4px rgba(234,179,8,0.3))",
      opacity: 0.85, scale, textColor: "text-white", glow: false, rings: 0,
    };
    if (s >= 55) return {
      filter: "grayscale(55%) brightness(0.8) saturate(0.7)",
      opacity: 0.58, scale, textColor: "text-white/80", glow: false, rings: 0,
    };
    const pct = Math.max(0, s) / 55;
    return {
      filter: `grayscale(${Math.round(92 - pct * 37)}%) brightness(${0.4 + pct * 0.4})`,
      opacity: 0.15 + pct * 0.3, scale, textColor: "text-white/50", glow: false, rings: 0,
    };
  })();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col"
        >
          {/* Fullscreen cinematic backdrop */}
          <motion.div
            key={movie.id}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${getBackdropUrl(movie.backdrop_path) || getPosterUrl(movie.poster_path, "w780")})`,
            }}
          />
          {/* Cinematic gradient — bottom-heavy for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent h-32" />

          {/* Top bar: back + match ring */}
          <div className="relative z-10 flex justify-between items-center px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              onClick={onClose}
              aria-label="Retour"
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {adhesionScore != null && (
              <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>

                {/* Expanding glow rings at ≥80% */}
                {hazelnutStyle.rings >= 1 && (
                  <motion.div
                    animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
                    transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(251,146,60,0.55) 0%, transparent 70%)" }}
                  />
                )}
                {hazelnutStyle.rings >= 2 && (
                  <motion.div
                    animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
                    transition={{ duration: 1.9, repeat: Infinity, delay: 0.65, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(234,179,8,0.5) 0%, transparent 70%)" }}
                  />
                )}
                {hazelnutStyle.rings >= 3 && (
                  <motion.div
                    animate={{ scale: [1, 3.0], opacity: [0.35, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: 1.2, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(255,210,60,0.35) 0%, transparent 70%)" }}
                  />
                )}

                {/* Hazelnut — image or emoji fallback */}
                {hazelnutError ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: hazelnutStyle.opacity, scale: hazelnutStyle.scale }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute text-5xl select-none leading-none"
                    style={{ filter: hazelnutStyle.filter }}
                  >
                    🌰
                  </motion.span>
                ) : (
                  <motion.img
                    src="/hazelnut.png"
                    alt=""
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: hazelnutStyle.opacity, scale: hazelnutStyle.scale }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="w-12 h-12 select-none absolute"
                    style={{ filter: hazelnutStyle.filter }}
                    onError={() => setHazelnutError(true)}
                  />
                )}

                {/* Score text */}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className={`relative z-10 text-[13px] font-black font-sans select-none tracking-tight ${hazelnutStyle.textColor}`}
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.75)" }}
                  aria-label={`Adhésion ${adhesionScore}%`}
                >
                  {adhesionScore}%
                </motion.span>
              </div>
            )}
          </div>

          {/* Poster + flèches de navigation de chaque côté */}
          <div className="relative z-10 flex items-center justify-center gap-4 mt-4">
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              aria-label="Proposition précédente"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground transition-all disabled:opacity-20 hover:bg-black/60"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {movie.poster_path && (
              <button
                onClick={onOpenDetail}
                className="relative group active:scale-[0.97] transition-transform"
                aria-label="Voir les détails"
              >
                <motion.img
                  key={`poster-${movie.id}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  src={getPosterUrl(movie.poster_path, "w500") || ""}
                  alt={getDisplayTitle(movie)}
                  className="w-40 h-60 rounded-2xl object-cover shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10"
                />
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info className="w-3.5 h-3.5 text-foreground/70" />
                </div>
                {interaction.hasInteraction && (
                  <div className="absolute top-2 left-2">
                    <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} size="sm" />
                  </div>
                )}
              </button>
            )}

            <button
              onClick={onNext}
              disabled={!canGoNext}
              aria-label="Proposition suivante"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground transition-all disabled:opacity-20 hover:bg-black/60"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom-anchored info block */}
          <div className="relative z-10 mt-auto px-7 pb-[calc(5rem+env(safe-area-inset-bottom))]">
            {/* Chips: year, genre, first streaming platform */}
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
              {tonightProviders[0] && (
                <span className="px-2.5 py-1.5 bg-primary/25 backdrop-blur-xl border border-primary/40 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold font-sans flex items-center gap-1.5">
                  <img
                    src={`https://image.tmdb.org/t/p/w45${tonightProviders[0].logo_path}`}
                    alt=""
                    className="w-3.5 h-3.5 rounded object-cover"
                  />
                  {tonightProviders[0].name}
                </span>
              )}
            </div>

            {/* Hero serif title */}
            <motion.h2
              key={`title-${movie.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="font-serif text-foreground text-[42px] leading-[0.95] tracking-tight mb-5 cursor-pointer"
              onClick={onOpenDetail}
            >
              {getDisplayTitle(movie)}
            </motion.h2>

            {/* Vertical accent bar + italic teaser from Pick */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.32 }}
              className="flex items-start gap-3 mb-7 cursor-pointer"
              onClick={onOpenDetail}
            >
              <div className="w-1 self-stretch min-h-[40px] bg-primary rounded-full shrink-0" />
              <p className="text-foreground/80 text-[14px] italic font-sans leading-relaxed pt-0.5">
                {teaser.length > 140 ? `${teaser.substring(0, 140).trimEnd()}…` : teaser}
              </p>
            </motion.div>

            {/* Glass action bar (Save / Like / Seen via MovieActionBar) */}
            <div className="mb-5 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/[0.06] p-1.5">
              <MovieActionBar key={movie.id} movie={movie} onInteraction={onInteraction} />
            </div>

            {/* Primary CTA: white pill — premium contrast */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              className="w-full py-[18px] bg-foreground text-background rounded-[28px] font-sans font-bold text-[13px] tracking-[0.18em] uppercase mb-5 shadow-[0_18px_50px_-12px_rgba(255,255,255,0.25)]"
            >
              On regarde ?
            </motion.button>

            {/* Progress segments — uniquement si plusieurs propositions */}
            {tonightPool.length > 1 && (
              <div className="flex flex-col items-center gap-2.5 mb-1">
                <div className="flex gap-1.5">
                  {tonightPool.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (i < tonightPickIndex) onPrev();
                        else if (i > tonightPickIndex) onNext();
                      }}
                      disabled={(i < tonightPickIndex && !canGoPrev) || (i > tonightPickIndex && !canGoNext)}
                      aria-label={`Suggestion ${i + 1}`}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        i === tonightPickIndex ? "w-10 bg-foreground" : "w-2 bg-foreground/20 hover:bg-foreground/40"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-foreground/30 text-[9px] font-sans tracking-[0.3em] uppercase">
                  Suggestion {tonightPickIndex + 1} / {tonightPool.length}
                </span>
              </div>
            )}

            {/* Bouton "nouvelles suggestions" :
                - proposition unique → actif immédiatement (on l'a forcément vue)
                - plusieurs propositions → actif seulement quand toutes visitées */}
            {(tonightPool.length <= 1 || tonightAllVisited || tonightLoading) && (
              <button
                onClick={onMoreSuggestions}
                disabled={tonightLoading}
                className="mt-1 text-xs font-sans transition-all flex items-center gap-1.5 text-foreground/55 hover:text-foreground/80 disabled:opacity-50"
              >
                {tonightLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Dices className="w-3.5 h-3.5" />
                )}
                {displayCount} autre{displayCount > 1 ? "s" : ""} suggestion{displayCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TonightPickOverlay;
