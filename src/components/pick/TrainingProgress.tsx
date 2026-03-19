import { motion } from "framer-motion";
import { Brain, Sparkles, ArrowRight } from "lucide-react";

interface TrainingProgressProps {
  evaluated: number;
  confidence: number;
  onStartTraining: () => void;
  compact?: boolean;
}

const THRESHOLDS = {
  minimum: 10,
  ideal: 20,
};

const getProgressLabel = (count: number, confidence: number): string => {
  if (count === 0) return "Pick ne te connaît pas encore";
  if (count < 5) return "Pick commence à te cerner…";
  if (count < THRESHOLDS.minimum) return "Encore quelques films et c'est bon";
  if (count < THRESHOLDS.ideal) return "Pick comprend de mieux en mieux tes goûts";
  if (count < 30) return "Pick te connaît bien maintenant";
  return "Pick lit dans tes pensées";
};

const getProgressPercent = (count: number): number => {
  // Progress scale: 0 → 0%, 10 → 50%, 20 → 85%, 30+ → 100%
  if (count === 0) return 0;
  if (count <= THRESHOLDS.minimum) return Math.round((count / THRESHOLDS.minimum) * 50);
  if (count <= THRESHOLDS.ideal) return 50 + Math.round(((count - THRESHOLDS.minimum) / (THRESHOLDS.ideal - THRESHOLDS.minimum)) * 35);
  if (count <= 30) return 85 + Math.round(((count - THRESHOLDS.ideal) / 10) * 15);
  return 100;
};

const TrainingProgress = ({ evaluated, confidence, onStartTraining, compact = false }: TrainingProgressProps) => {
  const progress = getProgressPercent(evaluated);
  const label = getProgressLabel(evaluated, confidence);
  const needsTraining = evaluated < THRESHOLDS.ideal;

  if (compact) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStartTraining}
        className="w-full rounded-xl p-3 bg-card/50 border border-border/20 hover:border-primary/30 transition-all text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-xs font-sans font-medium text-foreground/70">Profil cinéma</span>
          </div>
          <span className="text-[10px] font-sans text-primary font-semibold">{progress}%</span>
        </div>
        <div className="h-1 rounded-full bg-foreground/10 overflow-hidden mb-1.5">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-sans text-foreground/40">{label}</span>
          {needsTraining && (
            <span className="text-[10px] font-sans text-primary/60 flex items-center gap-1">
              Entraîner <ArrowRight className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      data-tour="entraine-pick"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onStartTraining}
      className="group w-full text-left rounded-2xl p-5 bg-card/60 border-2 border-border/20 hover:border-primary/30 transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-sans font-semibold text-foreground">Entraîne ton Pick</h3>
            <span className="text-xs font-sans text-primary font-semibold">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden mb-1.5">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-foreground/40 text-[11px] font-sans flex items-center gap-1.5">
            {needsTraining ? (
              <>
                <Sparkles className="w-3 h-3 text-primary/40" />
                {label}
              </>
            ) : (
              label
            )}
          </p>
        </div>
      </div>
    </motion.button>
  );
};

export { THRESHOLDS };
export default TrainingProgress;
