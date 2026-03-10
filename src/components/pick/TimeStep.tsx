import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Clapperboard, Tv } from "lucide-react";
import type { TimeAvailable } from "@/lib/tmdb";

interface TimeStepProps {
  onSelect: (time: TimeAvailable) => void;
  onSkip?: () => void;
  loading: boolean;
}

const times: { value: TimeAvailable; label: string; sub: string; icon: React.ElementType }[] = [
  { value: "short", label: "Moins de 90 min", sub: "Court et percutant", icon: Clock },
  { value: "movie-night", label: "Soirée ciné", sub: "Un vrai film complet", icon: Clapperboard },
  { value: "episode", label: "Juste un épisode", sub: "Une série, un épisode", icon: Tv },
];

const TimeStep = ({ onSelect, onSkip, loading }: TimeStepProps) => {
  const [selected, setSelected] = useState<TimeAvailable | null>(null);

  const handleSelect = (time: TimeAvailable) => {
    if (loading) return;
    setSelected(time);
    setTimeout(() => onSelect(time), 300);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-3xl md:text-5xl font-serif mb-12 text-center"
      >
        Vous avez combien de temps ?
      </motion.h2>

      <div className="flex flex-col gap-3 max-w-md w-full">
        {times.map((time, i) => {
          const Icon = time.icon;
          const isSelected = selected === time.value;
          return (
            <motion.button
              key={time.value}
              initial={{ opacity: 0, y: 16 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isSelected ? [1, 1.08, 1.02] : 1,
              }}
              transition={{
                delay: i * 0.06,
                duration: 0.35,
                ease: "easeOut",
                scale: { duration: 0.3 },
              }}
              onClick={() => handleSelect(time.value)}
              disabled={loading || selected !== null}
              className={`bg-card rounded-2xl p-6 md:p-8 text-left transition-all duration-200 hover:scale-[1.02] cursor-pointer border flex items-center gap-4 ${
                isSelected
                  ? "border-primary neon-glow bg-primary/10"
                  : "border-transparent hover:border-primary/30"
              } disabled:opacity-50 disabled:cursor-default`}
            >
              <Icon
                className={`w-6 h-6 shrink-0 transition-colors duration-200 ${
                  isSelected ? "text-primary" : "text-primary/40"
                }`}
              />
              <div>
                <span className="font-serif text-xl md:text-2xl tracking-wide block">{time.label}</span>
                <span className="text-muted-foreground text-sm mt-1 block font-sans">{time.sub}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {onSkip && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          onClick={onSkip}
          className="mt-8 text-muted-foreground/50 text-sm font-sans hover:text-muted-foreground transition-colors"
        >
          Passer cette étape
        </motion.button>
      )}

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 flex items-center gap-3 text-muted-foreground"
        >
          <div className="w-8 h-0.5 bg-primary animate-subtle-pulse rounded-full" />
          <span className="text-sm font-sans">Recherche en cours…</span>
        </motion.div>
      )}
    </div>
  );
};

export default TimeStep;
