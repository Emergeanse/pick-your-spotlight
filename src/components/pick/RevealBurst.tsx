import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJIS = ["🍿", "🎬", "🎞️", "⭐", "✨", "🎥", "🌟", "🍿", "✨", "🎬"];

interface Particle {
  id: number;
  emoji: string;
  x: number; // start X in %
  y: number; // start Y in %
  dx: number; // horizontal drift
  dy: number; // vertical travel
  rotate: number;
  scale: number;
  delay: number;
  duration: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    x: 30 + Math.random() * 40, // center cluster
    y: 40 + Math.random() * 20,
    dx: (Math.random() - 0.5) * 200, // spread left/right
    dy: -(100 + Math.random() * 250), // burst upward
    rotate: (Math.random() - 0.5) * 720,
    scale: 0.6 + Math.random() * 0.8,
    delay: Math.random() * 0.15,
    duration: 0.8 + Math.random() * 0.6,
  }));
}

interface RevealBurstProps {
  trigger: boolean;
}

const RevealBurst = ({ trigger }: RevealBurstProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      setParticles(generateParticles(18));
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{
                opacity: 1,
                x: `${p.x}vw`,
                y: `${p.y}vh`,
                scale: 0,
                rotate: 0,
              }}
              animate={{
                opacity: [1, 1, 0],
                x: `calc(${p.x}vw + ${p.dx}px)`,
                y: `calc(${p.y}vh + ${p.dy}px)`,
                scale: p.scale,
                rotate: p.rotate,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute text-2xl"
              style={{ willChange: "transform, opacity" }}
            >
              {p.emoji}
            </motion.span>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default RevealBurst;
