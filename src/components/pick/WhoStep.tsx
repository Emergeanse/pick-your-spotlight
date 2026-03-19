import { useState } from "react";
import { motion } from "framer-motion";
import { User, Users, UsersRound } from "lucide-react";

export type WhoOption = "alone" | "duo" | "group";

interface WhoStepProps {
  onSelect: (who: WhoOption) => void;
}

const options: { value: WhoOption; label: string; description: string; icon: React.ElementType }[] = [
  { value: "alone", label: "Seul·e", description: "Juste pour moi", icon: User },
  { value: "duo", label: "À deux", description: "Soirée en duo", icon: Users },
  { value: "group", label: "En groupe", description: "3 personnes ou plus", icon: UsersRound },
];

const WhoStep = ({ onSelect }: WhoStepProps) => {
  const [selected, setSelected] = useState<WhoOption | null>(null);

  const handleSelect = (who: WhoOption) => {
    setSelected(who);
    setTimeout(() => onSelect(who), 300);
  };

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0 overflow-y-auto">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl md:text-5xl font-serif mb-6 md:mb-12 text-center"
      >
        Tu regardes avec qui ?
      </motion.h2>

      <div className="flex flex-col gap-2.5 md:gap-3 max-w-md w-full">
        {options.map((opt, i) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <motion.button
              key={opt.value}
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
              onClick={() => handleSelect(opt.value)}
              disabled={selected !== null}
              className={`bg-card rounded-2xl p-4 md:p-8 text-left transition-all duration-200 hover:scale-[1.02] cursor-pointer border flex items-center gap-3 md:gap-4 ${
                isSelected
                  ? "border-primary neon-glow bg-primary/10"
                  : "border-transparent hover:border-primary/30"
              } disabled:cursor-default`}
            >
              <Icon
                className={`w-5 h-5 md:w-6 md:h-6 shrink-0 transition-colors duration-200 ${
                  isSelected ? "text-primary" : "text-primary/40"
                }`}
              />
              <div>
                <span className="font-serif text-lg md:text-2xl tracking-wide block">{opt.label}</span>
                <span className="text-muted-foreground text-xs md:text-sm mt-0.5 md:mt-1 block font-sans">{opt.description}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default WhoStep;
