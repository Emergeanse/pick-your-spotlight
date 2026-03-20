import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJIS = ["🍿", "🎬", "🎞️", "⭐", "✨", "🎥", "🌟", "🍿", "✨", "🎬"];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  delay: number;
  duration: number;
}

function generateParticles(count: number, wave: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: wave * 100 + i,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    x: 10 + Math.random() * 80,
    y: wave === 0 ? 40 + Math.random() * 20 : 20 + Math.random() * 60,
    dx: (Math.random() - 0.5) * (wave === 0 ? 260 : 180),
    dy: wave === 0 ? -(120 + Math.random() * 300) : (Math.random() - 0.5) * 200,
    rotate: (Math.random() - 0.5) * 720,
    scale: 0.5 + Math.random() * 0.9,
    delay: Math.random() * 0.25,
    duration: 1.2 + Math.random() * 0.8,
  }));
}

interface RevealBurstProps {
  trigger: boolean;
}

const RevealBurst = ({ trigger }: RevealBurstProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  const launchWave = useCallback((wave: number) => {
    const count = wave === 0 ? 22 : 14;
    setParticles(prev => [...prev, ...generateParticles(count, wave)]);
  }, []);

  useEffect(() => {
    if (trigger) {
      setParticles([]);
      setVisible(true);
      launchWave(0);
      const t2 = setTimeout(() => launchWave(1), 600);
      const t3 = setTimeout(() => launchWave(2), 1400);
      const tEnd = setTimeout(() => setVisible(false), 3500);
      return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(tEnd); };
    }
  }, [trigger, launchWave]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 bg-primary/8"
          />
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
                opacity: [1, 1, 0.7, 0],
                x: `calc(${p.x}vw + ${p.dx}px)`,
                y: `calc(${p.y}vh + ${p.dy}px)`,
                scale: [0, p.scale * 1.2, p.scale, p.scale * 0.5],
                rotate: p.rotate,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute text-2xl drop-shadow-lg"
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
