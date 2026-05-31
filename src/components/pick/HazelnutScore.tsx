import { useState } from "react";
import { motion } from "framer-motion";

interface HazelnutScoreProps {
  score: number | null;
  size?: number; // px, défaut 56
}

export function hazelnutStyle(s: number) {
  const scale = 0.55 + (s / 100) * 1.05;
  if (s >= 90) return {
    filter: "grayscale(0%) sepia(0.25) saturate(2.6) brightness(1.15) hue-rotate(-12deg) drop-shadow(0 0 10px rgba(251,146,60,0.9))",
    opacity: 1, scale, textColor: "text-white", rings: 3,
  };
  if (s >= 80) return {
    filter: "grayscale(0%) sepia(0.2) saturate(2.0) brightness(1.1) hue-rotate(-10deg) drop-shadow(0 0 7px rgba(234,179,8,0.75))",
    opacity: 0.97, scale, textColor: "text-white", rings: 2,
  };
  if (s >= 70) return {
    filter: "grayscale(10%) sepia(0.1) saturate(1.4) brightness(1.0) drop-shadow(0 0 4px rgba(234,179,8,0.3))",
    opacity: 0.85, scale, textColor: "text-white", rings: 0,
  };
  if (s >= 55) return {
    filter: "grayscale(55%) brightness(0.8) saturate(0.7)",
    opacity: 0.58, scale, textColor: "text-white/80", rings: 0,
  };
  const pct = Math.max(0, s) / 55;
  return {
    filter: `grayscale(${Math.round(92 - pct * 37)}%) brightness(${0.4 + pct * 0.4})`,
    opacity: 0.15 + pct * 0.3, scale, textColor: "text-white/50", rings: 0,
  };
}

export default function HazelnutScore({ score, size = 56 }: HazelnutScoreProps) {
  const [imgError, setImgError] = useState(false);

  if (score == null) return null;

  const style = hazelnutStyle(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {style.rings >= 1 && (
        <motion.div
          animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(251,146,60,0.55) 0%, transparent 70%)" }}
        />
      )}
      {style.rings >= 2 && (
        <motion.div
          animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, delay: 0.65, ease: "easeOut" }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(234,179,8,0.5) 0%, transparent 70%)" }}
        />
      )}
      {style.rings >= 3 && (
        <motion.div
          animate={{ scale: [1, 3.0], opacity: [0.35, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: 1.2, ease: "easeOut" }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,210,60,0.35) 0%, transparent 70%)" }}
        />
      )}

      {imgError ? (
        <motion.span
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: style.opacity, scale: style.scale }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute text-5xl select-none leading-none"
          style={{ filter: style.filter }}
        >
          🌰
        </motion.span>
      ) : (
        <motion.img
          src="/hazelnut.png"
          alt=""
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: style.opacity, scale: style.scale }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="select-none absolute"
          style={{ width: size * 0.86, height: size * 0.86, filter: style.filter }}
          onError={() => setImgError(true)}
        />
      )}

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className={`relative z-10 text-[13px] font-black font-sans select-none tracking-tight ${style.textColor}`}
        style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.75)" }}
        aria-label={`Adhésion ${score}%`}
      >
        {score}%
      </motion.span>
    </div>
  );
}
