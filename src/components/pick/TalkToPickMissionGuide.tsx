import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import PickCharacter from "./PickCharacter";

export type TalkToPickGuideStep = "open-chat" | "mic" | null;

interface TalkToPickMissionGuideProps {
  step: TalkToPickGuideStep;
}

const STEP_CONFIG: Record<Exclude<TalkToPickGuideStep, null>, { message: string; targetSelector: string }> = {
  "open-chat": {
    message: "Clique sur « Parle à Pick » pour ouvrir la conversation.",
    targetSelector: '[data-tour="parle-a-pick"]',
  },
  mic: {
    message: "Appuie sur le micro pour parler à Pick.",
    targetSelector: '[data-tour="voice-chat-mic"]',
  },
};

const TalkToPickMissionGuide = ({ step }: TalkToPickMissionGuideProps) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!step) {
      setTargetRect(null);
      return;
    }

    const config = STEP_CONFIG[step];
    let mounted = true;

    const updateRect = () => {
      if (!mounted) return;
      const el = document.querySelector(config.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    const timeout = setTimeout(updateRect, 250);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  if (!step || !targetRect) return null;

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
  const tooltipBelow = cutout.top < vh / 2;

  return (
    <div className="fixed inset-0 z-[85]">
      <div className="absolute top-0 left-0 right-0 bg-background/80 backdrop-blur-sm pointer-events-auto" style={{ height: Math.max(0, cutout.top) }} />
      <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm pointer-events-auto" style={{ top: cutout.bottom }} />
      <div className="absolute bg-background/80 backdrop-blur-sm pointer-events-auto" style={{ top: cutout.top, left: 0, width: Math.max(0, cutout.left), height: cutout.height }} />
      <div className="absolute bg-background/80 backdrop-blur-sm pointer-events-auto" style={{ top: cutout.top, left: cutout.right, right: 0, height: cutout.height }} />

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
              {STEP_CONFIG[step].message}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TalkToPickMissionGuide;
