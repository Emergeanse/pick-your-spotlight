import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import pickDefault from "@/assets/pick-squirrel.png";
import pickWave from "@/assets/pick-squirrel-wave.png";
import pickThink from "@/assets/pick-squirrel-think.png";

export type PickMood = "default" | "wave" | "think";

const PICK_IMAGES: Record<PickMood, string> = {
  default: pickDefault,
  wave: pickWave,
  think: pickThink,
};

const GREETINGS = [
  "Alors… qu'est-ce qu'on regarde ce soir ?",
  "Je peux choisir un film parfait pour toi.",
  "Laisse-moi te trouver quelque chose.",
  "J'ai plein d'idées pour ce soir !",
  "Dis-moi juste ton humeur, je m'occupe du reste.",
];

interface PickCharacterProps {
  mood?: PickMood;
  message?: string;
  showGreeting?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

const SIZE_MAP = {
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-28 h-28",
};

const PickCharacter = ({
  mood = "default",
  message,
  showGreeting = false,
  size = "md",
  className = "",
  animate = true,
}: PickCharacterProps) => {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    if (showGreeting && !message) {
      setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    }
  }, [showGreeting, message]);

  const displayMessage = message || (showGreeting ? greeting : "");

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        {displayMessage && (
          <motion.div
            key={displayMessage}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative max-w-[260px] px-4 py-2.5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-lg"
          >
            <p className="text-foreground/80 text-[13px] font-sans leading-relaxed text-center">
              {displayMessage}
            </p>
            {/* Bubble tail */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card/80 border-r border-b border-border/30" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character */}
      <motion.div
        initial={animate ? { opacity: 0, scale: 0.8 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className="relative"
      >
        <motion.img
          key={mood}
          src={PICK_IMAGES[mood]}
          alt="Pick"
          className={`${SIZE_MAP[size]} object-contain drop-shadow-lg`}
          initial={{ scale: 0.9 }}
          animate={{
            scale: 1,
            y: animate ? [0, -3, 0] : 0,
          }}
          transition={{
            scale: { duration: 0.2 },
            y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
          }}
        />
      </motion.div>
    </div>
  );
};

export default PickCharacter;
