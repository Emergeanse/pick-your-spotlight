import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";
import pickWave from "@/assets/pick-squirrel-wave.png";

interface SpotlightStep {
  selector: string;
  title: string;
  description: string;
  position?: "top" | "bottom";
}

const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    selector: "[data-tour='pick-ce-soir']",
    title: "🍿 Pick pour ce soir",
    description:
      "C'est le bouton principal. Un tap et je te trouve LE film parfait pour ta soirée, basé sur tes goûts.",
    position: "bottom",
  },
  {
    selector: "[data-tour='parle-a-pick']",
    title: "🎙 Parle à Pick",
    description:
      "Tu peux me parler directement. Dis-moi ton humeur, ton contexte, ce que t'as envie de ressentir.",
    position: "bottom",
  },
  {
    selector: "[data-tour='surprends-moi']",
    title: "🎲 Surprends-moi",
    description:
      "Envie de laisser faire le hasard ? Ce bouton te propose un film inattendu qui colle à tes goûts.",
    position: "bottom",
  },
  {
    selector: "[data-tour='entraine-pick']",
    title: "🧠 Entraîne ton Pick",
    description:
      "Plus tu me dis ce que t'aimes, plus mes recommandations sont précises. Swipe des films pour m'apprendre tes goûts.",
    position: "bottom",
  },
];

const TOUR_KEY = "pick_tour_completed";

interface GuidedTourProps {
  onComplete: () => void;
}

const GuidedTour = ({ onComplete }: GuidedTourProps) => {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [visible, setVisible] = useState(true);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  const updateSpotlight = useCallback((stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= SPOTLIGHT_STEPS.length) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(SPOTLIGHT_STEPS[stepIndex].selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    } else {
      // Skip steps whose elements don't exist (e.g. "Entraîne ton Pick" when not logged in)
      if (stepIndex < SPOTLIGHT_STEPS.length - 1) {
        setCurrentStep(stepIndex + 1);
      } else {
        handleFinish();
      }
    }
  }, []);

  useEffect(() => {
    updateSpotlight(currentStep);
  }, [currentStep, updateSpotlight]);

  // Recalculate on resize
  useEffect(() => {
    const handler = () => updateSpotlight(currentStep);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [currentStep, updateSpotlight]);

  const handleFinish = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleNext = () => {
    if (currentStep === -1) {
      setCurrentStep(0);
      return;
    }
    const nextStep = currentStep + 1;
    if (nextStep >= SPOTLIGHT_STEPS.length) {
      handleFinish();
    } else {
      setCurrentStep(nextStep);
    }
  };

  const totalSteps = SPOTLIGHT_STEPS.length + 1; // +1 for welcome
  const displayStep = currentStep + 1; // 0-indexed display (welcome = 0)

  if (!visible) return null;

  const step = currentStep >= 0 ? SPOTLIGHT_STEPS[currentStep] : null;
  const isWelcome = currentStep === -1;
  const isLastSpotlight = currentStep === SPOTLIGHT_STEPS.length - 1;

  // Calculate tooltip position
  const padding = 12;
  let tooltipStyle: React.CSSProperties = {};
  if (spotlightRect && step) {
    const pos = step.position || "bottom";
    if (pos === "bottom") {
      tooltipStyle = {
        top: spotlightRect.bottom + padding,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(90vw, 340px)",
      };
    } else {
      tooltipStyle = {
        bottom: window.innerHeight - spotlightRect.top + padding,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(90vw, 340px)",
      };
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
      >
        {isWelcome ? (
          /* Welcome screen — centered card */
          <>
            <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
            <div className="relative z-10 flex items-center justify-center h-full px-5">
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-sm rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
              >
                <div className="px-6 pt-6 pb-6 text-center">
                  <img src={pickWave} alt="Pick" className="w-16 h-16 object-contain mx-auto mb-4" />
                  <h3 className="text-xl font-serif mb-2">Bienvenue sur Pick ! 🎬</h3>
                  <p className="text-foreground/50 text-sm font-sans leading-relaxed mb-6">
                    Je vais te montrer les boutons principaux. Promis, c'est rapide !
                  </p>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleFinish}
                      className="text-foreground/30 text-xs font-sans hover:text-foreground/60 transition-colors"
                    >
                      Passer
                    </button>
                    <Button
                      onClick={handleNext}
                      className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-5 h-9 gap-2"
                    >
                      C'est parti
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        ) : spotlightRect && step ? (
          /* Spotlight mode */
          <>
            {/* Dark overlay with cutout */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
              <defs>
                <mask id="spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect
                    x={spotlightRect.left - 8}
                    y={spotlightRect.top - 8}
                    width={spotlightRect.width + 16}
                    height={spotlightRect.height + 16}
                    rx="16"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0" y="0" width="100%" height="100%"
                fill="rgba(0,0,0,0.75)"
                mask="url(#spotlight-mask)"
                style={{ pointerEvents: "auto" }}
                onClick={handleNext}
              />
            </svg>

            {/* Pulsing ring around element */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute rounded-2xl border-2 border-primary/60 pointer-events-none"
              style={{
                left: spotlightRect.left - 8,
                top: spotlightRect.top - 8,
                width: spotlightRect.width + 16,
                height: spotlightRect.height + 16,
                boxShadow: "0 0 0 4px hsl(var(--primary) / 0.15), 0 0 30px -5px hsl(var(--primary) / 0.3)",
              }}
            />

            {/* Tooltip card */}
            <motion.div
              key={`tooltip-${currentStep}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 25 }}
              className="absolute z-20 rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
              style={tooltipStyle}
            >
              {/* Progress dots */}
              <div className="flex items-center gap-1 px-4 pt-3">
                {Array.from({ length: SPOTLIGHT_STEPS.length }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i <= currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              <div className="px-5 pt-3 pb-4">
                <h3 className="text-base font-serif mb-1">{step.title}</h3>
                <p className="text-foreground/50 text-[13px] font-sans leading-relaxed mb-4">
                  {step.description}
                </p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleFinish}
                    className="text-foreground/30 text-xs font-sans hover:text-foreground/60 transition-colors"
                  >
                    Passer
                  </button>
                  <Button
                    onClick={handleNext}
                    size="sm"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-4 h-8 gap-1.5"
                  >
                    {isLastSpotlight ? "C'est parti ! 🚀" : "Suivant"}
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};

export { TOUR_KEY };
export default GuidedTour;
