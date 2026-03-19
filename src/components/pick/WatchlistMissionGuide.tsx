import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PickCharacter from "./PickCharacter";

export type WatchlistGuideStep = "pick-ce-soir" | "autre-suggestion" | "sauvegarder" | "continue" | null;

interface WatchlistMissionGuideProps {
  step: WatchlistGuideStep;
  savedCount: number;
  target: number;
}

const STEP_CONFIG: Record<string, { message: string; targetSelector: string }> = {
  "pick-ce-soir": {
    message: "Clique sur « Pick pour ce soir » pour découvrir un film ! 🍿",
    targetSelector: '[data-tour="pick-ce-soir"]',
  },
  "autre-suggestion": {
    message: "Celui-ci ne te plaît pas ? Clique sur « Autre suggestion » pour en voir un autre ! 🔄",
    targetSelector: '[data-tour="autre-suggestion"]',
  },
  "sauvegarder": {
    message: "Celui-ci te plaît ? Sauvegarde-le dans ta watchlist ! 📌",
    targetSelector: '[data-tour="sauvegarder"]',
  },
};

const WatchlistMissionGuide = ({ step, savedCount, target }: WatchlistMissionGuideProps) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!step || step === "continue") {
      setTargetRect(null);
      return;
    }

    const config = STEP_CONFIG[step];
    if (!config) return;

    let mounted = true;

    const updateRect = () => {
      if (!mounted) return;
      const el = document.querySelector(config.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    const timeout = setTimeout(updateRect, 300);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  if (!step) return null;

  // "Continue" step — floating encouragement message
  if (step === "continue") {
    const remaining = target - savedCount;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed top-16 left-4 right-4 z-[85] flex justify-center pointer-events-none"
      >
        <div className="bg-card/95 backdrop-blur-xl border border-primary/30 rounded-2xl px-4 py-3 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)] max-w-sm pointer-events-auto">
          <div className="flex items-center gap-3">
            <PickCharacter mood="wave" size="sm" animate={false} />
            <div>
              <p className="text-foreground text-sm font-sans font-medium">
                Bravo ! 🎉
              </p>
              <p className="text-foreground/60 text-xs font-sans">
                {remaining > 0
                  ? `Continue comme ça ! Sauvegarde encore ${remaining} film${remaining > 1 ? "s" : ""} pour compléter la mission.`
                  : "Mission accomplie !"
                }
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const config = STEP_CONFIG[step];
  if (!config || !targetRect) return null;

  const padding = 8;
  const cutout = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    right: targetRect.right + padding,
    bottom: targetRect.bottom + padding,
  };

  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // Tooltip below or above
  const tooltipBelow = cutout.top < vh / 2;

  return (
    <div className="fixed inset-0 z-[85]">
      {/* 4 overlay panels around the cutout */}
      {/* Top */}
      <div
        className="absolute top-0 left-0 right-0 bg-background/80 backdrop-blur-sm"
        style={{ height: Math.max(0, cutout.top) }}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm"
        style={{ top: cutout.bottom }}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Left */}
      <div
        className="absolute bg-background/80 backdrop-blur-sm"
        style={{ top: cutout.top, left: 0, width: Math.max(0, cutout.left), height: cutout.height }}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Right */}
      <div
        className="absolute bg-background/80 backdrop-blur-sm"
        style={{ top: cutout.top, left: cutout.right, right: 0, height: cutout.height }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Pulsing ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute pointer-events-none"
        style={{
          top: cutout.top - 2,
          left: cutout.left - 2,
          width: cutout.width + 4,
          height: cutout.height + 4,
          borderRadius: 16,
        }}
      >
        <div className="w-full h-full rounded-2xl border-2 border-primary animate-pulse shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
      </motion.div>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: tooltipBelow ? -10 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute left-4 right-4 flex justify-center pointer-events-none"
        style={{
          top: tooltipBelow ? cutout.bottom + 12 : undefined,
          bottom: !tooltipBelow ? vh - cutout.top + 12 : undefined,
        }}
      >
        <div className="bg-card/95 backdrop-blur-xl border border-primary/30 rounded-2xl px-4 py-3 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)] max-w-sm">
          <div className="flex items-center gap-3">
            <PickCharacter mood="default" size="sm" animate={false} />
            <p className="text-foreground text-sm font-sans font-medium leading-snug">
              {config.message}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WatchlistMissionGuide;
