import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Clock, ChevronRight, ThumbsUp, ThumbsDown, Bookmark } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getPosterUrl, getDisplayTitle, getYear, getBackdropUrl } from "@/lib/tmdb";
import MovieActionBar from "@/components/pick/MovieActionBar";
import FeedbackBadge from "@/components/pick/FeedbackBadge";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";

export type RecommendationReasonType = "session_wish" | "taste_match" | "constraint_ok" | "tonight_fit";

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

const ResultsStep = ({
  hero,
  alternatives,
  selectedCount,
  heroReaction,
  sessionId,
  onReject,
  onSelectMovie,
  onAddToWatchlist,
  onRestart,
}: ResultsStepProps) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const allIds = [hero.movie.id, ...alternatives.map((a) => a.movie.id)];
  const interactions = useMovieInteractions(allIds);
  const heroState = interactions[hero.movie.id];

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto"
    >
      <div className="relative min-h-[70vh]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getBackdropUrl(hero.movie.backdrop_path) || getPosterUrl(hero.movie.poster_path, "w780")})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent h-24" />

        <div className="relative z-10 flex flex-col items-center justify-end min-h-[70vh] px-6 pb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/40 backdrop-blur-md border border-primary/20 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-primary/80 text-[11px] font-sans font-semibold tracking-wide uppercase">
              Together
            </span>
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
                  <FeedbackBadge
                    type={heroState.primaryStatus}
                    inWatchlist={heroState.watchlist}
                    seen={heroState.seen}
                    size="sm"
                  />
                </div>
              )}
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl md:text-3xl font-serif text-foreground text-center mb-1"
          >
            {getDisplayTitle(hero.movie)}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 text-foreground/40 text-xs font-sans mb-4"
          >
            <span>{getYear(hero.movie)}</span>
            {hero.movie.runtime > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {hero.movie.runtime} min
                </span>
              </>
            )}
            {hero.movie.vote_average > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-gold text-gold" />
                  {hero.movie.vote_average.toFixed(1)}
                </span>
              </>
            )}
          </motion.div>
        </div>
      </div>

      <div className="px-6 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <MovieActionBar key={hero.movie.id} movie={hero.movie} sessionId={sessionId} contextType="group_session" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ResultsStep;
