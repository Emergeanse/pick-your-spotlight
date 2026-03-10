import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export interface Genre {
  id: number;
  label: string;
}

const genres: Genre[] = [
  { id: 28, label: "Action" },
  { id: 35, label: "Comédie" },
  { id: 18, label: "Drame" },
  { id: 878, label: "Science-fiction" },
  { id: 53, label: "Thriller" },
  { id: 27, label: "Horreur" },
  { id: 10749, label: "Romance" },
  { id: 16, label: "Animation" },
  { id: 99, label: "Documentaire" },
  { id: 12, label: "Aventure" },
  { id: 14, label: "Fantastique" },
  { id: 9648, label: "Mystère" },
];

type GenreState = "neutral" | "included" | "excluded";

interface GenreStepProps {
  onSelect: (genreIds: number[], excludedGenreIds: number[]) => void;
}

const GenreStep = ({ onSelect }: GenreStepProps) => {
  const [states, setStates] = useState<Record<number, GenreState>>({});

  const cycle = (id: number) => {
    setStates((prev) => {
      const current = prev[id] || "neutral";
      const next: GenreState = current === "neutral" ? "included" : current === "included" ? "excluded" : "neutral";
      return { ...prev, [id]: next };
    });
  };

  const included = Object.entries(states).filter(([, s]) => s === "included").map(([id]) => Number(id));
  const excluded = Object.entries(states).filter(([, s]) => s === "excluded").map(([id]) => Number(id));
  const hasSelection = included.length > 0 || excluded.length > 0;

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0 overflow-y-auto">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl md:text-5xl font-serif mb-2 md:mb-3 text-center"
      >
        Qu'est-ce qui vous ferait vibrer ?
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-muted-foreground text-[11px] md:text-sm font-sans mb-1.5 md:mb-2 text-center"
      >
        Appuyez une fois pour inclure, deux fois pour exclure
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs text-muted-foreground/60 font-sans mb-4 md:mb-8"
      >
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-primary/40" /> Inclus
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/40" /> Exclu
        </span>
      </motion.div>

      <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-xl w-full mb-6 md:mb-10">
        {genres.map((genre, i) => {
          const state = states[genre.id] || "neutral";
          return (
            <motion.button
              key={genre.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: i * 0.03, duration: 0.3, ease: "easeOut" }}
              onClick={() => cycle(genre.id)}
              className={`relative rounded-xl px-2 py-2.5 md:px-3 md:py-4 text-xs md:text-sm font-sans transition-all duration-200 hover:scale-[1.03] cursor-pointer border ${
                state === "included"
                  ? "bg-primary/15 border-primary text-foreground neon-glow"
                  : state === "excluded"
                  ? "bg-destructive/10 border-destructive/50 text-foreground/50 line-through"
                  : "bg-card border-transparent text-foreground/80 hover:border-primary/30"
              }`}
            >
              {state === "included" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
              {state === "excluded" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5 text-destructive-foreground" />
                </motion.div>
              )}
              {genre.label}
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="pb-4"
      >
        <Button
          variant="hero"
          size="xl"
          onClick={() => onSelect(included, excluded)}
        >
          {!hasSelection ? "Peu importe" : "Continuer"}
        </Button>
      </motion.div>
    </div>
  );
};

export default GenreStep;
