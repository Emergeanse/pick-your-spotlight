import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import pickWave from "@/assets/pick-squirrel-wave.webp";

interface TourStep {
  selector: string; // data-tour attribute value OR CSS selector
  title: string;
  desc: string;
  position: "bottom" | "top"; // tooltip position relative to element
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="pick-ce-soir"]',
    title: "Trouver ton film 🎬",
    desc: "Ton bouton principal ! Appuie ici pour que Pick te trouve le film parfait — en automatique ou en discutant avec lui.",
    position: "bottom",
  },
  {
    selector: '[data-tour="tab-together"]',
    title: "Pick Ensemble 👥",
    desc: "Vous êtes plusieurs ? Pick croise vos profils et trouve LE film qui plaît à tout le monde.",
    position: "top",
  },
  {
    selector: '[data-tour="tab-watchlist"]',
    title: "Ta Watchlist 🔖",
    desc: "Sauvegarde les films qui t'intéressent pour ne rien oublier. Tu les retrouveras toujours ici.",
    position: "top",
  },
  {
    selector: '[data-tour="tab-cinema"]',
    title: "Mon Cinéma 🎞️",
    desc: "Ton espace perso : tes coups de cœur, ton ADN Cinéma, tes stats… Tout ce qui te rend unique.",
    position: "top",
  },
  {
    selector: '[data-tour="tab-profile"]',
    title: "Ton Profil ⚙️",
    desc: "Gère tes préférences, tes plateformes de streaming et tes amis depuis ici.",
    position: "top",
  },
];

interface PlatformTourProps {
  onComplete: () => void;
}

const PlatformTour = ({ onComplete }: PlatformTourProps) => {
  const [phase, setPhase] = useState<"intro" | "spotlight">("intro");
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Raise target element above overlay during spotlight
  useEffect(() => {
    if (phase !== "spotlight") return;
    const step = TOUR_STEPS[currentStep];
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) return;

    // Also raise the parent fixed container (e.g. BottomTabBar) if the element is inside one
    const fixedParent = el.closest('.fixed, [style*="position: fixed"]') as HTMLElement | null;
    const targetEl = fixedParent && fixedParent !== el ? fixedParent : null;

    el.style.position = 'relative';
    el.style.zIndex = '110';
    if (targetEl) {
      targetEl.style.zIndex = '110';
    }

    return () => {
      el.style.position = '';
      el.style.zIndex = '';
      if (targetEl) {
        targetEl.style.zIndex = '';
      }
    };
  }, [phase, currentStep]);

  const measureTarget = useCallback(() => {
    if (phase !== "spotlight") return;
    const step = TOUR_STEPS[currentStep];
    const el = document.querySelector(step.selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [phase, currentStep]);

  useEffect(() => {
    measureTarget();
    // Re-measure on resize/scroll
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [measureTarget]);

  // Re-measure periodically in case elements render late
  useEffect(() => {
    if (phase !== "spotlight") return;
    const interval = setInterval(measureTarget, 500);
    return () => clearInterval(interval);
  }, [phase, measureTarget]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onComplete();
    }
  };

  const step = TOUR_STEPS[currentStep];
  const padding = 8;

  // Compute tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const margin = 12;
    const maxW = Math.min(320, window.innerWidth - margin * 2);
    const tooltipEstimatedHeight = 180; // approximate tooltip height
    const gap = 16;

    // Decide if we should flip: if preferred position overflows, use the other side
    const spaceBelow = window.innerHeight - targetRect.bottom - gap;
    const spaceAbove = targetRect.top - gap;
    let pos = step.position;
    if (pos === "bottom" && spaceBelow < tooltipEstimatedHeight && spaceAbove > spaceBelow) {
      pos = "top";
    } else if (pos === "top" && spaceAbove < tooltipEstimatedHeight && spaceBelow > spaceAbove) {
      pos = "bottom";
    }

    const base: React.CSSProperties = {
      left: margin,
      right: margin,
      maxWidth: maxW,
      marginLeft: "auto",
      marginRight: "auto",
    };

    if (pos === "bottom") {
      return { ...base, top: Math.min(targetRect.bottom + gap, window.innerHeight - tooltipEstimatedHeight - margin) };
    } else {
      return { ...base, bottom: Math.max(window.innerHeight - targetRect.top + gap, margin) };
    }
  };

  // SVG cutout mask
  const renderMask = () => {
    if (!targetRect) return null;
    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const w = targetRect.width + padding * 2;
    const h = targetRect.height + padding * 2;
    const r = 16;

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="hsl(var(--background) / 0.85)" mask="url(#spotlight-mask)" />
      </svg>
    );
  };

  return (
    <motion.div ref={overlayRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100]" onClick={(e) => { if (e.target === overlayRef.current) handleNext(); }}>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
            <div className="absolute inset-0 bg-background/90 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }} className="relative z-10 text-center max-w-sm px-5">
              <motion.img src={pickWave} alt="Pick" className="w-20 h-20 object-contain mx-auto mb-6"
                initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} />
              <h2 className="text-2xl font-serif mb-3">Bienvenue chez toi ! 🎬</h2>
              <p className="text-foreground/50 text-sm font-sans leading-relaxed mb-2">
                Laisse-moi te montrer comment ça marche.
              </p>
              <p className="text-primary/50 text-xs font-sans mb-8">Je te montre les boutons importants !</p>
              <Button variant="hero" size="xl" onClick={() => setPhase("spotlight")}>
                C'est parti <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        )}

        {phase === "spotlight" && (
          <motion.div key={`step-${currentStep}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0">
            {/* Dark overlay with cutout */}
            {renderMask()}

            {/* Glowing border around target */}
            {targetRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute pointer-events-none rounded-2xl"
                style={{
                  left: targetRect.left - padding,
                  top: targetRect.top - padding,
                  width: targetRect.width + padding * 2,
                  height: targetRect.height + padding * 2,
                  boxShadow: "0 0 0 3px hsl(var(--primary) / 0.6), 0 0 30px 5px hsl(var(--primary) / 0.2)",
                  zIndex: 2,
                }}
              />
            )}

            {/* Tooltip card */}
            <motion.div
              initial={{ opacity: 0, y: step.position === "bottom" ? -10 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15 }}
              className="absolute z-10 bg-card border border-border/30 rounded-2xl p-5 shadow-2xl"
              style={{ ...getTooltipStyle(), zIndex: 3 }}
            >
              {/* Progress */}
              <div className="flex items-center gap-1.5 mb-3">
                {TOUR_STEPS.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= currentStep ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>

              <h3 className="text-lg font-serif mb-1.5">{step.title}</h3>
              <p className="text-foreground/50 text-sm font-sans leading-relaxed mb-4">{step.desc}</p>

              <div className="flex items-center justify-between">
                <button onClick={onComplete} className="text-foreground/45 text-xs font-sans hover:text-foreground/60 transition-colors">
                  Passer le tour
                </button>
                <Button variant="hero" size="sm" onClick={handleNext}>
                  {currentStep < TOUR_STEPS.length - 1 ? "Suivant" : "C'est compris !"} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PlatformTour;
