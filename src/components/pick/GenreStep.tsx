import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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

interface GenreStepProps {
  onSelect: (genreIds: number[]) => void;
}

const GenreStep = ({ onSelect }: GenreStepProps) => {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-3xl md:text-5xl font-serif mb-4 text-center"
      >
        Quel genre vous tente ?
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-muted-foreground text-sm font-sans mb-10 text-center"
      >
        Choisissez un ou plusieurs genres
      </motion.p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 md:gap-3 max-w-xl w-full mb-10">
        {genres.map((genre, i) => {
          const isSelected = selected.includes(genre.id);
          return (
            <motion.button
              key={genre.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3, ease: "easeOut" }}
              onClick={() => toggle(genre.id)}
              className={`rounded-xl px-3 py-3 md:py-4 text-sm font-sans transition-all duration-200 hover:scale-[1.03] cursor-pointer border ${
                isSelected
                  ? "bg-primary/15 border-primary text-foreground neon-glow"
                  : "bg-card border-transparent text-foreground/80 hover:border-primary/30"
              }`}
            >
              {genre.label}
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <Button
          variant="hero"
          size="xl"
          onClick={() => onSelect(selected)}
        >
          {selected.length === 0 ? "Peu importe" : "Continuer"}
        </Button>
      </motion.div>
    </div>
  );
};

export default GenreStep;
