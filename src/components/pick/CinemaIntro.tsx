import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getBackdropUrl } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";

interface CinemaIntroProps {
  movie: MovieDetail;
  onComplete: () => void;
}

export default function CinemaIntro({ movie, onComplete }: CinemaIntroProps) {
  const [phase, setPhase] = useState<"dark" | "screen" | "pick-enters" | "settled">("dark");

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("screen"), 600),
      setTimeout(() => setPhase("pick-enters"), 1600),
      setTimeout(() => setPhase("settled"), 2800),
      setTimeout(() => onComplete(), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[70] bg-[#050505] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Ambient glow from screen */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase !== "dark" ? 0.15 : 0 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 30%, hsl(var(--primary) / 0.3), transparent)",
        }}
      />

      {/* Cinema screen */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{
          opacity: phase !== "dark" ? 1 : 0,
          scale: phase !== "dark" ? 1 : 0.85,
        }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative w-[75vw] max-w-lg aspect-video rounded-lg overflow-hidden border border-foreground/5 shadow-2xl"
        style={{
          boxShadow: phase !== "dark"
            ? "0 0 80px 20px hsl(var(--primary) / 0.1), 0 0 200px 40px rgba(0,0,0,0.5)"
            : "none",
        }}
      >
        {/* Movie backdrop as "screen" */}
        {movie.backdrop_path ? (
          <motion.img
            src={getBackdropUrl(movie.backdrop_path)}
            alt=""
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{
              opacity: phase !== "dark" ? 1 : 0,
              scale: phase !== "dark" ? 1 : 1.1,
            }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        ) : (
          <div className="w-full h-full bg-primary/5" />
        )}

        {/* Projector flicker effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.08, 0, 0.05, 0] }}
          transition={{ duration: 2, times: [0, 0.1, 0.3, 0.5, 1] }}
          className="absolute inset-0 bg-foreground/10"
        />

        {/* Screen border glow */}
        <div className="absolute inset-0 border border-foreground/5 rounded-lg" />
      </motion.div>

      {/* Cinema seats area */}
      <div className="relative mt-8 flex items-end justify-center gap-3 sm:gap-6">
        {/* Left seat (user) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase !== "dark" ? 1 : 0, y: phase !== "dark" ? 0 : 20 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="text-3xl sm:text-4xl">💺</div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "settled" ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            className="text-[10px] text-foreground/30 font-sans mt-1"
          >
            Toi
          </motion.span>
        </motion.div>

        {/* Right seat (Pick) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase !== "dark" ? 1 : 0, y: phase !== "dark" ? 0 : 20 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col items-center relative"
        >
          <div className="text-3xl sm:text-4xl">💺</div>

          {/* Pick character sitting down */}
          <AnimatePresence>
            {(phase === "pick-enters" || phase === "settled") && (
              <motion.div
                initial={{ y: -60, opacity: 0, scale: 0.7 }}
                animate={{ y: -42, opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  mass: 0.8,
                }}
                className="absolute -top-2 left-1/2 -translate-x-1/2"
              >
                <img
                  src="/lovable-uploads/pick-squirrel.png"
                  alt="Pick"
                  className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                  onError={(e) => {
                    // Fallback to assets version
                    (e.target as HTMLImageElement).src = "/src/assets/pick-squirrel.png";
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "settled" ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            className="text-[10px] text-primary/50 font-sans mt-1 font-medium"
          >
            Pick
          </motion.span>
        </motion.div>

        {/* Popcorn between seats */}
        <AnimatePresence>
          {(phase === "pick-enters" || phase === "settled") && (
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 15 }}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2"
            >
              <span className="text-xl sm:text-2xl">🍿</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pick's message */}
      <AnimatePresence>
        {phase === "settled" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 text-center px-6"
          >
            <p className="text-foreground/70 text-sm sm:text-base font-serif italic">
              « Installe-toi, ça va être bien. »
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              className="h-px w-16 mx-auto mt-3 bg-primary/20"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1.5 }}
        whileHover={{ opacity: 0.7 }}
        onClick={onComplete}
        className="absolute bottom-8 text-foreground/30 text-xs font-sans hover:text-foreground/60 transition-colors"
      >
        Passer
      </motion.button>
    </motion.div>
  );
}
