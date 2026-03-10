import { motion } from "framer-motion";
import type { Mood } from "@/lib/tmdb";

interface MoodStepProps {
  onSelect: (mood: Mood) => void;
  onSkip?: () => void;
}

const moods: { value: Mood; label: string; description: string }[] = [
  { value: "relax", label: "Détente", description: "Quelque chose d'apaisant" },
  { value: "excited", label: "Adrénaline", description: "Du rythme, de l'action" },
  { value: "romantic", label: "Romance", description: "De l'émotion, du sentiment" },
  { value: "mind-blowing", label: "Vertige", description: "Quelque chose qui marque" },
  { value: "easy-watch", label: "Léger", description: "Sans prise de tête" },
  { value: "fun", label: "Rire", description: "Quelque chose de drôle" },
];

const MoodStep = ({ onSelect, onSkip }: MoodStepProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-3xl md:text-5xl font-serif mb-12 text-center"
      >
        Quelle est votre humeur ?
      </motion.h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-xl w-full">
        {moods.map((mood, i) => (
          <motion.button
            key={mood.value}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
            onClick={() => onSelect(mood.value)}
            className="bg-card rounded-2xl p-5 md:p-7 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:neon-glow cursor-pointer border border-transparent hover:border-primary/30"
          >
            <span className="font-serif text-lg md:text-xl tracking-wide">{mood.label}</span>
            <span className="text-muted-foreground text-xs font-sans">{mood.description}</span>
          </motion.button>
        ))}
      </div>

      {onSkip && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          onClick={onSkip}
          className="mt-8 text-muted-foreground/50 text-sm font-sans hover:text-muted-foreground transition-colors"
        >
          Passer cette étape
        </motion.button>
      )}
    </div>
  );
};

export default MoodStep;
