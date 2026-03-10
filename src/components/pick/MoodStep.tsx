import { motion } from "framer-motion";
import type { Mood } from "@/lib/tmdb";

interface MoodStepProps {
  onSelect: (mood: Mood) => void;
}

const moods: { value: Mood; emoji: string; label: string }[] = [
  { value: "relax", emoji: "😌", label: "Relax" },
  { value: "excited", emoji: "🔥", label: "Excité" },
  { value: "romantic", emoji: "💕", label: "Romantique" },
  { value: "mind-blowing", emoji: "🤯", label: "Mind-blowing" },
  { value: "easy-watch", emoji: "🍿", label: "Facile" },
  { value: "fun", emoji: "😂", label: "Fun" },
];

const MoodStep = ({ onSelect }: MoodStepProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <h2 className="text-3xl md:text-5xl font-serif mb-12 text-center">
        Quelle est votre humeur ?
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-xl w-full">
        {moods.map((mood, i) => (
          <motion.button
            key={mood.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            onClick={() => onSelect(mood.value)}
            className="bg-card rounded-2xl p-6 md:p-8 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-background/50 film-grain cursor-pointer border border-transparent hover:border-border"
          >
            <span className="text-4xl md:text-5xl">{mood.emoji}</span>
            <span className="font-serif text-lg tracking-wide">{mood.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default MoodStep;
