import { useState } from "react";
import { motion } from "framer-motion";
import { User, Heart, Users, Home } from "lucide-react";
import type { Context } from "@/lib/tmdb";

interface ContextStepProps {
  onSelect: (context: Context) => void;
  onSkip?: () => void;
}

const contexts: { value: Context; label: string; description: string; icon: React.ElementType }[] = [
  { value: "alone", label: "Seul·e", description: "Juste pour moi", icon: User },
  { value: "couple", label: "En couple", description: "Soirée à deux", icon: Heart },
  { value: "friends", label: "Entre amis", description: "Ambiance groupe", icon: Users },
  { value: "family", label: "En famille", description: "Pour tout le monde", icon: Home },
];

const ContextStep = ({ onSelect, onSkip }: ContextStepProps) => {
  const [selected, setSelected] = useState<Context | null>(null);

  const handleSelect = (ctx: Context) => {
    setSelected(ctx);
    setTimeout(() => onSelect(ctx), 300);
  };

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0 overflow-y-auto">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl md:text-5xl font-serif mb-6 md:mb-12 text-center"
      >
        C'est pour qui ce soir ?
      </motion.h2>

      <div className="grid grid-cols-2 gap-2.5 md:gap-4 max-w-md w-full">
        {contexts.map((ctx, i) => {
          const Icon = ctx.icon;
          const isSelected = selected === ctx.value;
          return (
            <motion.button
              key={ctx.value}
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
              onClick={() => handleSelect(ctx.value)}
              disabled={selected !== null}
              className={`bg-card rounded-2xl p-4 md:p-8 flex flex-col items-center gap-1.5 md:gap-2 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
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
              <span className="font-serif text-lg md:text-2xl tracking-wide">{ctx.label}</span>
              <span className="text-muted-foreground text-[11px] md:text-xs font-sans">{ctx.description}</span>
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
          className="mt-6 md:mt-8 text-muted-foreground/50 text-sm font-sans hover:text-muted-foreground transition-colors pb-4"
        >
          Passer cette étape
        </motion.button>
      )}
    </div>
  );
};

export default ContextStep;
