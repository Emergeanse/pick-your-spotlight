import { motion } from "framer-motion";
import { Sparkles, Loader2, Users, Film, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingStepProps {
  onCreateSoiree: () => void;
  creating: boolean;
}

const LandingStep = ({ onCreateSoiree, creating }: LandingStepProps) => (
  <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }}
    className="h-full flex flex-col items-center justify-center px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] relative overflow-hidden"
  >
    {/* Atmospheric background orbs */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ delay: 0.3, duration: 1.5 }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.04 }}
        transition={{ delay: 0.6, duration: 1.5 }}
        className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
    </div>

    {/* Icon cluster */}
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 120 }}
      className="relative mb-8"
    >
      <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
        <Users className="w-9 h-9 text-primary/70" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-card border border-border/20 flex items-center justify-center shadow-lg"
      >
        <Film className="w-3.5 h-3.5 text-primary/60" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55, type: "spring" }}
        className="absolute -bottom-1 -left-2 w-7 h-7 rounded-lg bg-card border border-border/20 flex items-center justify-center shadow-lg"
      >
        <Zap className="w-3 h-3 text-primary/50" />
      </motion.div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-center mb-10 max-w-xs"
    >
      <h1 className="text-3xl font-serif mb-3 leading-tight" style={{ lineHeight: "1.1" }}>
        Trouvez votre film<br />à plusieurs
      </h1>
      <p className="text-foreground/40 text-[13px] font-sans leading-relaxed">
        Croisez vos goûts cinématographiques et trouvez le compromis parfait pour votre soirée.
      </p>
    </motion.div>

    {/* Feature pills */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-wrap justify-center gap-2 mb-10"
    >
      {[
        { label: "Jusqu'à 8 personnes", icon: Users },
        { label: "Invités sans compte", icon: Sparkles },
        { label: "QR code & lien", icon: Zap },
      ].map((pill, i) => (
        <motion.div
          key={pill.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/50 border border-border/10 text-foreground/50 text-[11px] font-sans"
        >
          <pill.icon className="w-3 h-3" />
          {pill.label}
        </motion.div>
      ))}
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-sm"
    >
      <Button
        onClick={onCreateSoiree}
        disabled={creating}
        variant="hero"
        size="xl"
        className="w-full gap-2.5 font-sans text-[15px] font-medium"
      >
        {creating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        Lancer une soirée
      </Button>
    </motion.div>
  </motion.div>
);

export default LandingStep;
