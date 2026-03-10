import { motion } from "framer-motion";
import type { TimeAvailable } from "@/lib/tmdb";

interface TimeStepProps {
  onSelect: (time: TimeAvailable) => void;
  loading: boolean;
}

const times: { value: TimeAvailable; label: string; sub: string }[] = [
  { value: "short", label: "Moins de 90 min", sub: "Court et percutant" },
  { value: "movie-night", label: "Soirée ciné", sub: "Un vrai film complet" },
  { value: "episode", label: "Juste un épisode", sub: "Une série, un épisode" },
];

const TimeStep = ({ onSelect, loading }: TimeStepProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <h2 className="text-3xl md:text-5xl font-serif mb-12 text-center">
        Combien de temps avez-vous ?
      </h2>

      <div className="flex flex-col gap-4 max-w-md w-full">
        {times.map((time, i) => (
          <motion.button
            key={time.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            onClick={() => onSelect(time.value)}
            disabled={loading}
            className="bg-card rounded-2xl p-6 md:p-8 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-background/50 film-grain cursor-pointer border border-transparent hover:border-border disabled:opacity-50"
          >
            <span className="font-serif text-xl md:text-2xl tracking-wide block">{time.label}</span>
            <span className="text-muted-foreground text-sm mt-1 block">{time.sub}</span>
          </motion.button>
        ))}
      </div>

      {loading && (
        <div className="mt-8 flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-0.5 bg-primary animate-pulse" />
          <span className="text-sm">Recherche en cours...</span>
        </div>
      )}
    </div>
  );
};

export default TimeStep;
