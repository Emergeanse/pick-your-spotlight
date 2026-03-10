import { motion } from "framer-motion";
import type { Context } from "@/lib/tmdb";

interface ContextStepProps {
  onSelect: (context: Context) => void;
}

const contexts: { value: Context; label: string; description: string }[] = [
  { value: "alone", label: "Seul·e", description: "Juste pour moi" },
  { value: "couple", label: "En couple", description: "Soirée à deux" },
  { value: "friends", label: "Entre amis", description: "Ambiance groupe" },
  { value: "family", label: "En famille", description: "Pour tout le monde" },
];

const ContextStep = ({ onSelect }: ContextStepProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-3xl md:text-5xl font-serif mb-12 text-center"
      >
        Avec qui regardez-vous ?
      </motion.h2>

      <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-md w-full">
        {contexts.map((ctx, i) => (
          <motion.button
            key={ctx.value}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
            onClick={() => onSelect(ctx.value)}
            className="bg-card rounded-2xl p-6 md:p-8 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:neon-glow cursor-pointer border border-transparent hover:border-primary/30"
          >
            <span className="font-serif text-xl md:text-2xl tracking-wide">{ctx.label}</span>
            <span className="text-muted-foreground text-xs font-sans">{ctx.description}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ContextStep;
