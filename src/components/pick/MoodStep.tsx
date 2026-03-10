import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, Zap, Heart, Brain, Film, Smile } from "lucide-react";
import type { Mood } from "@/lib/tmdb";

interface MoodStepProps {
  onSelect: (mood: Mood) => void;
  onSkip?: () => void;
}

const moods: { value: Mood; label: string; description: string; icon: React.ElementType }[] = [
  { value: "relax", label: "Détente", description: "Quelque chose d'apaisant", icon: Sun },
  { value: "excited", label: "Adrénaline", description: "Du rythme, de l'action", icon: Zap },
  { value: "romantic", label: "Romance", description: "De l'émotion, du sentiment", icon: Heart },
  { value: "mind-blowing", label: "Vertige", description: "Quelque chose qui marque", icon: Brain },
  { value: "easy-watch", label: "Léger", description: "Sans prise de tête", icon: Film },
  { value: "fun", label: "Rire", description: "Quelque chose de drôle", icon: Smile },
];

const MoodStep = ({ onSelect, onSkip }: MoodStepProps) => {
  const [selected, setSelected] = useState<Mood | null>(null);

  const handleSelect = (mood: Mood) => {
    setSelected(mood);
    setTimeout(() => onSelect(mood), 300);
  };

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0 overflow-y-auto">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl md:text-5xl font-serif mb-6 md:mb-12 text-center"
      >
        Comment vous sentez-vous ce soir ?
      </motion.h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4 max-w-xl w-full">
        {moods.map((mood, i) => {
          const Icon = mood.icon;
          const isSelected = selected === mood.value;
          return (
            <motion.button
              key={mood.value}
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
              onClick={() => handleSelect(mood.value)}
              disabled={selected !== null}
              className={`bg-card rounded-2xl p-4 md:p-7 flex flex-col items-center gap-1.5 md:gap-2 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                isSelected
                  ? "border-primary neon-glow bg-primary/10"
                  : "border-transparent hover:border-primary/30"
              } disabled:cursor-default`}
            >
              <Icon
                className={`w-5 h-5 md:w-6 md:h-6 mb-0.5 md:mb-1 transition-colors duration-200 ${
                  isSelected ? "text-primary" : "text-primary/40"
                }`}
              />
              <span className="font-serif text-base md:text-xl tracking-wide">{mood.label}</span>
              <span className="text-muted-foreground text-[11px] md:text-xs font-sans">{mood.description}</span>
            </motion.button>
          );
        })}
      </div>

      {onSkip && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          onClick={onSkip}
          className="mt-6 md:mt-8 text-muted-foreground/50 text-sm font-sans hover:text-muted-foreground transition-colors pb-4"
        >
          Passer cette étape
        </motion.button>
      )}
    </div>
  );
};

export default MoodStep;
