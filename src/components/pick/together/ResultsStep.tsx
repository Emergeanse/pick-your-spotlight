import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Clock, ChevronRight, ThumbsUp, ThumbsDown, Bookmark } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getPosterUrl, getDisplayTitle, getYear, getBackdropUrl } from "@/lib/tmdb";
import MovieActionBar from "@/components/pick/MovieActionBar";
import FeedbackBadge from "@/components/pick/FeedbackBadge";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";

export type RecommendationReasonType =
  | "session_wish"
  | "taste_match"
  | "constraint_ok"
  | "tonight_fit";

interface GroupRecommendation {
  movie: MovieDetail;
  groupScore: number;
  reason: string;
  reasonType?: RecommendationReasonType;
  reasonText?: string;
  memberNotes: Record<string, string>;
  providers: { name: string; logo_path: string; provider_id: number }[];
}

const REASON_LABELS: Record<RecommendationReasonType, string> = {
  session_wish: "Envie du moment respectée",
  taste_match: "Goût compatible",
  constraint_ok: "Contrainte respectée",
  tonight_fit: "Bon match pour ce soir",
};

interface ResultsStepProps {
  hero: GroupRecommendation;
  alternatives: GroupRecommendation[];
  selectedCount: number;
  heroReaction: "like" | "meh" | "reject" | null;
  sessionId?: string | null;
  onReject: () => void;
  onSelectMovie: (rec: GroupRecommendation) => void;
  onAddToWatchlist: (movie: MovieDetail) => void;
  onRestart: () => void;
}

const ResultsStep = ({ hero, alternatives, selectedCount, heroReaction, sessionId, onReject, onSelectMovie, onAddToWatchlist, onRestart }: ResultsStepProps) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const allIds = [hero.movie.id, ...alternatives.map(a => a.movie.id)];
  const interactions = useMovieInteractions(allIds);
  const heroState = interactions[hero.movie.id];

  return (
    <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="h-full overflow-y-auto"
    >
      {/* Hero backdrop */}
      <div className="relative min-h-[70vh]">
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${getBackdropUrl(hero.movie.backdrop_path) || getPosterUrl(hero.movie.poster_path, "w780")})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent h-24" />

        <div className="relative z-10 flex flex-col items-center justify-end min-h-[70vh] px-6 pb-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/40 backdrop-blur-md border border-primary/20 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-primary/80 text-[11px] font-sans font-semibold tracking-wide uppercase">Together</span>
          </motion.div>

          {hero.movie.poster_path && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 180 }}
              className="relative mb-5"
            >
              <img
                src={getPosterUrl(hero.movie.poster_path, "w342") || ""}
                alt={getDisplayTitle(hero.movie)}
                className="w-40 h-60 md:w-48 md:h-72 rounded-2xl object-cover shadow-2xl border border-border/20"
              />
              {heroState?.hasInteraction && (
                <div className="absolute top-2 left-2">
                  <FeedbackBadge type={heroState.primaryStatus} inWatchlist={heroState.watchlist} size="sm" />
                </div>
              )}
            </motion.div>
          )}

          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="text-2xl md:text-3xl font-serif text-foreground text-center mb-1"
          >
            {getDisplayTitle(hero.movie)}
          </motion.h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex items-center gap-2 text-foreground/40 text-xs font-sans mb-4"
          >
            <span>{getYear(hero.movie)}</span>
            {hero.movie.runtime > 0 && (
              <><span className="text-border">·</span><span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{hero.movie.runtime} min</span></>
            )}
            {hero.movie.vote_average > 0 && (
              <><span className="text-border">·</span><span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-gold text-gold" />{hero.movie.vote_average.toFixed(1)}</span></>
            )}
          </motion.div>

          {/* Group Match Score */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: "spring" }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/60 backdrop-blur-md border border-border/15 mb-4"
          >
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" strokeWidth="3" stroke="hsl(var(--muted))" fill="none" />
                <motion.circle cx="28" cy="28" r="24" strokeWidth="3" stroke="hsl(var(--primary))" fill="none" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - hero.groupScore / 100) }}
                  transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-primary text-sm font-sans font-bold">{hero.groupScore}%</span>
            </div>
            <div>
              <p className="text-foreground text-sm font-sans font-semibold">Compatibilité groupe</p>
              <p className="text-foreground/40 text-[11px] font-sans">{selectedCount} personnes · Recommandé par Pick</p>
            </div>
          </motion.div>

          {hero.reasonType && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2"
            >
              <span className="text-primary text-[10px] font-sans font-semibold uppercase tracking-wide">
                {REASON_LABELS[hero.reasonType]}
              </span>
            </motion.div>
          )}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className="text-foreground/50 text-[13px] font-sans text-center leading-relaxed max-w-sm mb-3 italic"
          >
            "{hero.reasonText || hero.reason}"
          </motion.p>

          {hero.providers && hero.providers.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center gap-2 mb-6">
              <span className="text-foreground/25 text-[10px] font-sans">Disponible sur</span>
              <div className="flex gap-1.5">
                {hero.providers.map(p => (
                  <img key={p.provider_id} src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.name}
                    className="w-6 h-6 rounded-lg object-cover border border-border/20" />
                ))}
              </div>
            </motion.div>
          )}

          {hero.memberNotes && Object.keys(hero.memberNotes).length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
              className="w-full max-w-sm space-y-2 mb-6"
            >
              {Object.entries(hero.memberNotes).map(([name, note]) => (
                <div key={name} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-card/40 backdrop-blur-sm border border-border/10">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-primary">{name[0]}</span>
                  </div>
                  <div>
                    <span className="text-foreground/70 text-xs font-sans font-medium">{name}</span>
                    <p className="text-foreground/40 text-[11px] font-sans">{note}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-6 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <MovieActionBar key={hero.movie.id} movie={hero.movie} sessionId={sessionId} contextType="group_session" />
        </motion.div>
      </div>

      {/* Reaction buttons */}
      <div className="px-6 pb-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          className="flex items-center justify-center gap-4 mb-6"
        >
          <motion.button whileTap={{ scale: 0.85 }} onClick={onReject}
            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
              heroReaction === "reject" ? "border-destructive bg-destructive/10 scale-110" : "border-border/20 bg-card/40 hover:border-destructive/40"
            }`}
          >
            <ThumbsDown className={`w-5 h-5 ${heroReaction === "reject" ? "text-destructive" : "text-foreground/40"}`} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onSelectMovie(hero)}
            className="w-16 h-16 rounded-full bg-primary flex items-center justify-center neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform"
          >
            <ThumbsUp className="w-6 h-6 text-primary-foreground" />
          </motion.button>
        </motion.div>
        <div className="flex items-center justify-center gap-6 text-[10px] font-sans text-foreground/25 mb-8">
          <span>Pas pour nous</span><span>On regarde !</span>
        </div>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="px-6 pb-10">
          <button onClick={() => setShowAlternatives(!showAlternatives)}
            className="flex items-center gap-2 mb-4 text-foreground/40 text-xs font-sans hover:text-foreground/60 transition-colors"
          >
            <span>{showAlternatives ? "Masquer" : "Voir"} les alternatives</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAlternatives ? "rotate-90" : ""}`} />
          </button>
          <AnimatePresence>
            {showAlternatives && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                {alternatives.map((rec, idx) => {
                  const altState = interactions[rec.movie.id];
                  return (
                  <motion.button key={rec.movie.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                    whileTap={{ scale: 0.98 }} onClick={() => onSelectMovie(rec)}
                    className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/10 hover:border-border/25 transition-all text-left"
                  >
                    {rec.movie.poster_path && (
                      <div className="relative shrink-0">
                        <img src={getPosterUrl(rec.movie.poster_path, "w92") || ""} alt={getDisplayTitle(rec.movie)}
                          className="w-14 h-20 rounded-xl object-cover" />
                        {altState?.hasInteraction && (
                          <div className="absolute top-1 left-1">
                            <FeedbackBadge type={altState.primaryStatus} inWatchlist={altState.watchlist} />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-serif text-foreground leading-tight mb-1 truncate">{getDisplayTitle(rec.movie)}</h3>
                      <div className="flex items-center gap-1.5 text-foreground/30 text-[10px] font-sans mb-1.5">
                        <span>{getYear(rec.movie)}</span>
                        {rec.movie.vote_average > 0 && (
                          <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-gold text-gold" />{rec.movie.vote_average.toFixed(1)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${rec.groupScore}%` }} />
                        </div>
                        <span className="text-primary/70 text-[10px] font-sans font-semibold">{rec.groupScore}%</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground/15 shrink-0" />
                  </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={onRestart}
            className="w-full mt-6 text-center text-foreground/25 text-xs font-sans hover:text-foreground/40 transition-colors"
          >
            ← Recommencer avec d'autres amis
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default ResultsStep;
export type { GroupRecommendation };
