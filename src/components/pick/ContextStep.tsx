import { motion } from "framer-motion";
import type { Context } from "@/lib/tmdb";

interface ContextStepProps {
  onSelect: (context: Context) => void;
}

const contexts: { value: Context; label: string }[] = [
  { value: "alone", label: "Seul·e" },
  { value: "couple", label: "En couple" },
  { value: "friends", label: "Entre amis" },
  { value: "family", label: "En famille" },
];

const ContextStep = ({ onSelect }: ContextStepProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <h2 className="text-3xl md:text-5xl font-serif mb-12 text-center">
        Avec qui regardez-vous ?
      </h2>

      <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-md w-full">
        {contexts.map((ctx, i) => (
          <motion.button
            key={ctx.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            onClick={() => onSelect(ctx.value)}
            className="bg-card rounded-2xl p-6 md:p-8 flex items-center justify-center transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-background/50 film-grain cursor-pointer border border-transparent hover:border-border"
          >
            <span className="font-serif text-xl md:text-2xl tracking-wide">{ctx.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ContextStep;
