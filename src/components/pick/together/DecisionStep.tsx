import { motion } from "framer-motion";
import { PartyPopper, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPosterUrl, getDisplayTitle, type MovieDetail } from "@/lib/tmdb";
import FeedbackBadge from "@/components/pick/FeedbackBadge";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";

interface DecisionStepProps {
  movie: MovieDetail;
  participantNames: string[];
  onLaunch: () => void;
  onChangeMind: () => void;
}

const DecisionStep = ({ movie, participantNames, onLaunch, onChangeMind }: DecisionStepProps) => {
const interaction = useMovieInteraction(movie.id);
  <motion.div
    key="decision"
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
    className="h-full flex flex-col items-center justify-center px-6 pt-16 pb-[calc(env(safe-area-inset-bottom)+24px)] text-center"
  >
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 180, delay: 0.1 }}
      className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-5"
    >
      <PartyPopper className="w-6 h-6 text-primary" />
    </motion.div>

    <p className="text-foreground/45 text-[12px] font-sans uppercase tracking-wider mb-2">Ce soir on regarde</p>
    <h1 className="text-2xl md:text-3xl font-serif mb-5 leading-tight max-w-xs">{getDisplayTitle(movie)}</h1>

    {movie.poster_path && (
      <motion.img
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        src={getPosterUrl(movie.poster_path, "w342") || ""}
        alt={getDisplayTitle(movie)}
        className="w-40 h-60 rounded-2xl object-cover shadow-2xl border border-border/20 mb-6"
      />
    )}

    {participantNames.length > 0 && (
      <p className="text-foreground/55 text-[12px] font-sans mb-8 max-w-xs">Avec {participantNames.join(", ")}</p>
    )}

    <div className="w-full max-w-sm flex flex-col gap-2">
      <Button onClick={onLaunch} variant="hero" size="xl" className="w-full gap-2">
        <Play className="w-4 h-4" /> Lancer la séance
      </Button>
      <Button onClick={onChangeMind} variant="ghost" size="lg" className="w-full gap-2 text-foreground/55">
        <RotateCcw className="w-3.5 h-3.5" /> Revoir les options
      </Button>
    </div>
  </motion.div>
);

export default DecisionStep;
