/**
 * Cinematic reveal animation — dramatizes the moment Pick finds the perfect movie.
 * Replaces the simple spinner with a suspenseful build-up.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Film } from "lucide-react";
import PickCharacter from "./PickCharacter";

interface RevealAnimationProps {
  active: boolean;
  message?: string;
  phase?: "searching" | "found" | "revealing";
}

const SEARCH_PHASES = [
  { text: "Je parcours ma cinémathèque…", mood: "think" as const, delay: 0 },
  { text: "Hmm, j'ai quelques pistes…", mood: "think" as const, delay: 2000 },
  { text: "Attends, je tiens quelque chose…", mood: "default" as const, delay: 4000 },
  { text: "Ooh, celui-là est parfait.", mood: "wave" as const, delay: 6000 },
];

const RevealAnimation = ({ active, message }: RevealAnimationProps) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [particles, setParticles] = useState<number[]>([]);

  useEffect(() => {
    if (!active) {
      setPhaseIndex(0);
      setParticles([]);
      return;
    }

    // Progress through phases
    const timers = SEARCH_PHASES.map((phase, i) => {
      if (i === 0) return null;
      return setTimeout(() => setPhaseIndex(i), phase.delay);
    }).filter(Boolean);

    // Sparkle particles
    const particleInterval = setInterval(() => {
      setParticles(prev => {
        const next = [...prev, Date.now()];
        return next.slice(-8); // Keep max 8 particles
      });
    }, 400);

    return () => {
      timers.forEach(t => t && clearTimeout(t));
      clearInterval(particleInterval);
    };
  }, [active]);

  if (!active) return null;

  const currentPhase = SEARCH_PHASES[phaseIndex];
  const displayMessage = message || currentPhase.text;
  const progress = ((phaseIndex + 1) / SEARCH_PHASES.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
    >
      {/* Ambient sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((id, i) => (
          <motion.div
            key={id}
            initial={{
              opacity: 0,
              x: Math.random() * 100 + "%",
              y: Math.random() * 100 + "%",
              scale: 0,
            }}
            animate={{
              opacity: [0, 0.6, 0],
              scale: [0, 1.2, 0],
              y: `${Math.random() * 80 + 10}%`,
            }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute"
          >
            <Sparkles className="w-3 h-3 text-primary/40" />
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-6 px-8">
        {/* Pick character with mood */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: phaseIndex >= 3 ? [0, -3, 3, 0] : 0,
          }}
          transition={{ 
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 0.5, ease: "easeInOut" },
          }}
        >
          <PickCharacter mood={currentPhase.mood} size="lg" animate />
        </motion.div>

        {/* Message bubble */}
        <AnimatePresence mode="wait">
          <motion.div
            key={displayMessage}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-[280px]"
          >
            <p className="text-foreground/80 text-base font-sans font-medium leading-relaxed">
              {displayMessage}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar — cinematic style */}
        <div className="w-48 h-1 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>

        {/* Film reel icon spinning */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="text-primary/20"
        >
          <Film className="w-5 h-5" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default RevealAnimation;
