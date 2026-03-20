import { motion } from "framer-motion";
import type { Friend } from "./WhoStep";

interface LoadingStepProps {
  message: string;
  selectedFriends: Friend[];
}

const LoadingStep = ({ message, selectedFriends }: LoadingStepProps) => (
  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="h-full flex flex-col items-center justify-center px-6 relative overflow-hidden"
  >
    {/* Atmospheric pulse */}
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
    </div>

    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
      className="flex flex-col items-center text-center max-w-sm relative z-10"
    >
      {/* Orbiting avatars */}
      <div className="relative w-40 h-40 mb-8">
        {/* Center spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-full border border-primary/20"
            style={{ borderTopColor: "hsl(var(--primary) / 0.6)" }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center backdrop-blur-sm">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-6 h-6 rounded-lg bg-primary/30"
            />
          </div>
        </div>

        {/* Orbiting member dots */}
        {[{ name: "Toi" }, ...selectedFriends].map((p, i, arr) => {
          const angle = (i / arr.length) * 360;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                rotate: [angle, angle + 360],
              }}
              transition={{
                opacity: { delay: 0.3 + i * 0.12 },
                scale: { delay: 0.3 + i * 0.12, type: "spring" },
                rotate: { duration: 20 + i * 2, repeat: Infinity, ease: "linear" },
              }}
              className="absolute top-1/2 left-1/2"
              style={{ transformOrigin: "0 0" }}
            >
              <div
                className="w-9 h-9 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center shadow-lg -translate-x-1/2 -translate-y-1/2"
                style={{ transform: `translate(${Math.cos((angle * Math.PI) / 180) * 60}px, ${Math.sin((angle * Math.PI) / 180) * 60}px) translate(-50%, -50%)` }}
              >
                {"displayName" in p ? (
                  (p as Friend).avatarUrl ? (
                    <img src={(p as Friend).avatarUrl!} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-sans font-bold text-primary/70">
                      {(p as Friend).displayName[0]}
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-sans font-bold text-primary">
                    {p.name[0]}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Message */}
      <motion.p
        key={message}
        initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-foreground/50 text-[13px] font-sans leading-relaxed"
      >
        {message}
      </motion.p>

      {/* Progress bar */}
      <div className="w-48 h-[3px] bg-border/10 rounded-full mt-6 overflow-hidden">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 10, ease: "linear" }}
          className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary/70"
        />
      </div>
    </motion.div>
  </motion.div>
);

export default LoadingStep;
