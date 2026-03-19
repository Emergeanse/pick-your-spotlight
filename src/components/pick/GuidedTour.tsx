import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain } from "lucide-react";
import pickWave from "@/assets/pick-squirrel-wave.png";

const TOUR_KEY = "pick_tour_completed";

interface GuidedTourProps {
  onComplete: () => void;
  onStartTraining?: () => void;
}

const GuidedTour = ({ onComplete, onStartTraining }: GuidedTourProps) => {
  const [phase, setPhase] = useState<"welcome" | "training-nudge">("welcome");
  const [visible, setVisible] = useState(true);

  const handleFinish = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleStartTraining = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
    setTimeout(() => {
      onComplete();
      onStartTraining?.();
    }, 300);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
      >
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl" />
        
        <div className="relative z-10 flex items-center justify-center h-full px-5">
          <AnimatePresence mode="wait">
            {phase === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-sm rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
              >
                <div className="px-6 pt-6 pb-6 text-center">
                  <img src={pickWave} alt="Pick" className="w-16 h-16 object-contain mx-auto mb-4" />
                  <h3 className="text-xl font-serif mb-2">Bienvenue sur Pick ! 🎬</h3>
                  <p className="text-foreground/50 text-sm font-sans leading-relaxed mb-2">
                    Je suis ton assistant cinéma personnel. Plus tu m'apprends tes goûts, plus mes recommandations sont précises.
                  </p>
                  <p className="text-primary/60 text-xs font-sans mb-6">
                    On commence par un petit entraînement ?
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => setPhase("training-nudge")}
                      className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm h-10 gap-2"
                    >
                      Découvrir Pick
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "training-nudge" && (
              <motion.div
                key="training"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-sm rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
              >
                <div className="px-6 pt-6 pb-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-serif mb-2">Apprends-moi tes goûts</h3>
                  <p className="text-foreground/50 text-sm font-sans leading-relaxed mb-1">
                    Swipe des films pour que je comprenne ce que tu aimes. C'est rapide, promis.
                  </p>
                  <p className="text-primary/50 text-xs font-sans mb-6">
                    ~15 films suffisent pour des recommandations sur-mesure
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleStartTraining}
                      className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm h-10 gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      Commencer l'entraînement
                    </Button>
                    <button
                      onClick={handleFinish}
                      className="text-foreground/30 text-xs font-sans hover:text-foreground/60 transition-colors py-2"
                    >
                      Plus tard, je veux explorer
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export { TOUR_KEY };
export default GuidedTour;
