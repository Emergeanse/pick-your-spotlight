import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RatingStepProps {
  onSelect: (minRating: number) => void;
  onSkip?: () => void;
}

const ratings = [
  { value: 0, label: "Peu importe", sub: "Toutes les notes" },
  { value: 6, label: "6+", sub: "Correct et au-dessus" },
  { value: 7, label: "7+", sub: "Bien noté" },
  { value: 8, label: "8+", sub: "Excellents films uniquement" },
];

const RatingStep = ({ onSelect, onSkip }: RatingStepProps) => {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (rating: number) => {
    setSelected(rating);
    setTimeout(() => onSelect(rating), 300);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-3xl md:text-5xl font-serif mb-12 text-center"
      >
        Quelle note minimum ?
      </motion.h2>

      <div className="flex flex-col gap-3 max-w-md w-full">
        {ratings.map((r, i) => {
          const isSelected = selected === r.value;
          return (
            <motion.button
              key={r.value}
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
              onClick={() => handleSelect(r.value)}
              disabled={selected !== null}
              className={`bg-card rounded-2xl p-6 md:p-8 text-left transition-all duration-200 hover:scale-[1.02] cursor-pointer border flex items-center gap-4 ${
                isSelected
                  ? "border-primary neon-glow bg-primary/10"
                  : "border-transparent hover:border-primary/30"
              } disabled:cursor-default`}
            >
              <Star
                className={`w-6 h-6 shrink-0 transition-colors duration-200 ${
                  isSelected ? "text-yellow-500" : "text-primary/40"
                }`}
              />
              <div>
                <span className="font-serif text-xl md:text-2xl tracking-wide block">{r.label}</span>
                <span className="text-muted-foreground text-sm mt-1 block font-sans">{r.sub}</span>
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
    </div>
  );
};

export default RatingStep;
