import { motion } from "framer-motion";
import { ArrowRight, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import pickLogo from "@/assets/pick-logo.png";

interface ActivationOverlayProps {
  onStartTraining: () => void;
  onSkip: () => void;
}

const ActivationOverlay = ({ onStartTraining, onSkip }: ActivationOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-background/90 backdrop-blur-xl" />
      
      <div className="relative z-10 flex flex-col items-center px-6 max-w-sm text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-6"
        >
          <Brain className="w-8 h-8 text-primary" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-2xl font-serif mb-3"
        >
          Entraîne Pick en 2 minutes
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-foreground/50 text-sm font-sans leading-relaxed mb-2"
        >
          Swipe quelques films pour que Pick comprenne tes goûts. Plus tu swipes, plus les recommandations sont précises.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="flex items-center gap-2 mb-8"
        >
          <Sparkles className="w-3 h-3 text-primary/50" />
          <span className="text-primary/60 text-xs font-sans">
            15 films suffisent pour des recos sur-mesure
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col items-center gap-3 w-full"
        >
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={onStartTraining}
          >
            <Brain className="w-4 h-4" />
            Commencer l'entraînement
            <ArrowRight className="w-4 h-4" />
          </Button>
          
          <button
            onClick={onSkip}
            className="text-foreground/30 text-xs font-sans hover:text-foreground/50 transition-colors"
          >
            Plus tard
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ActivationOverlay;
