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
    if (!step || step === "continue") return;

    const config = STEP_CONFIG[step];
    if (!config) return;

    const updateRect = () => {
      const el = document.querySelector(config.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    // Small delay to let DOM settle
    const timeout = setTimeout(() => {
      updateRect();
    }, 300);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  if (!step) return null;

  // "Continue" step — just a floating message
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
    borderRadius: 16,
  };

  // Tooltip position: below or above the target
  const tooltipBelow = cutout.top < window.innerHeight / 2;
  const tooltipTop = tooltipBelow
    ? cutout.top + cutout.height + 12
    : cutout.top - 12;

  return (
    <div className="fixed inset-0 z-[85] pointer-events-auto">
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="watchlist-guide-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={cutout.left}
              y={cutout.top}
              width={cutout.width}
              height={cutout.height}
              rx={cutout.borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="hsl(var(--background) / 0.75)"
          mask="url(#watchlist-guide-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Pulsing ring around target */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute pointer-events-none"
        style={{
          top: cutout.top - 2,
          left: cutout.left - 2,
          width: cutout.width + 4,
          height: cutout.height + 4,
          borderRadius: cutout.borderRadius + 2,
        }}
      >
        <div className="w-full h-full rounded-[18px] border-2 border-primary animate-pulse shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
      </motion.div>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: tooltipBelow ? -10 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute left-4 right-4 flex justify-center pointer-events-none"
        style={{ top: tooltipBelow ? tooltipTop : undefined, bottom: tooltipBelow ? undefined : window.innerHeight - tooltipTop }}
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

      {/* Allow clicks only on the target area */}
      <div
        className="absolute"
        style={{
          top: cutout.top,
          left: cutout.left,
          width: cutout.width,
          height: cutout.height,
          borderRadius: cutout.borderRadius,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default WatchlistMissionGuide;
