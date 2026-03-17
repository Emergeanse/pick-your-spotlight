import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, Bookmark, Clapperboard, User, Zap, Mic, Shuffle, Brain, ArrowRight, X } from "lucide-react";
import pickWave from "@/assets/pick-squirrel-wave.png";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bienvenue sur Pick ! 🎬",
    description: "Je vais te faire un petit tour rapide pour que tu saches où tout se trouve. Promis, c'est rapide !",
    icon: <img src={pickWave} alt="Pick" className="w-12 h-12 object-contain" />,
  },
  {
    title: "🍿 Pick pour ce soir",
    description: "C'est le bouton principal. Un tap et je te trouve LE film parfait pour ta soirée, basé sur tes goûts. C'est la magie de Pick.",
    icon: <Zap className="w-6 h-6 text-primary" />,
    highlight: "home",
  },
  {
    title: "🎙 Parle à Pick",
    description: "Tu peux aussi me parler directement. Dis-moi ton humeur, ton contexte, ce que t'as envie de ressentir — je comprends tout.",
    icon: <Mic className="w-6 h-6 text-primary" />,
    highlight: "home",
  },
  {
    title: "🎲 Surprends-moi",
    description: "Envie de laisser faire le hasard ? Ce bouton te propose un film inattendu qui colle quand même à tes goûts.",
    icon: <Shuffle className="w-6 h-6 text-primary" />,
    highlight: "home",
  },
  {
    title: "🧠 Entraîne ton Pick",
    description: "Plus tu me dis ce que t'aimes (ou pas), plus mes recommandations sont précises. Swipe des films pour m'apprendre tes goûts.",
    icon: <Brain className="w-6 h-6 text-primary" />,
    highlight: "home",
  },
  {
    title: "📑 Watchlist",
    description: "Quand un film t'intéresse mais que c'est pas le bon moment, sauvegarde-le ici. Tu le retrouveras en un tap.",
    icon: <Bookmark className="w-6 h-6 text-primary" />,
    highlight: "watchlist",
  },
  {
    title: "🎬 Mon Cinéma",
    description: "Ton espace perso : tes films aimés, ton ADN Cinéma (ta personnalité ciné), et toutes tes stats.",
    icon: <Clapperboard className="w-6 h-6 text-primary" />,
    highlight: "cinema",
  },
  {
    title: "👤 Profil",
    description: "Gère tes plateformes de streaming, tes genres préférés et tous tes réglages ici.",
    icon: <User className="w-6 h-6 text-primary" />,
    highlight: "profile",
  },
  {
    title: "C'est parti ! 🚀",
    description: "Tu sais tout. Maintenant, dis-moi ce que tu veux regarder ce soir !",
    icon: <img src={pickWave} alt="Pick" className="w-12 h-12 object-contain" />,
  },
];

const TOUR_KEY = "pick_tour_completed";

interface GuidedTourProps {
  onComplete: () => void;
}

const GuidedTour = ({ onComplete }: GuidedTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(TOUR_KEY, "true");
      setVisible(false);
      setTimeout(onComplete, 300);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
    setTimeout(onComplete, 300);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={handleSkip} />

        {/* Card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-sm mx-4 mb-8 md:mb-0 rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
        >
          {/* Progress dots */}
          <div className="flex items-center gap-1 px-5 pt-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Content */}
          <div className="px-6 pt-5 pb-6">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              {step.icon}
            </div>

            <h3 className="text-lg font-serif text-center mb-2">{step.title}</h3>
            <p className="text-foreground/50 text-sm font-sans text-center leading-relaxed mb-6">
              {step.description}
            </p>

            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-foreground/30 text-xs font-sans hover:text-foreground/60 transition-colors"
              >
                Passer le tour
              </button>

              <Button
                onClick={handleNext}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-5 h-9 gap-2"
              >
                {isLast ? "C'est parti !" : "Suivant"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <p className="text-center text-foreground/20 text-[10px] font-sans mt-3">
              {currentStep + 1} / {TOUR_STEPS.length}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export { TOUR_KEY };
export default GuidedTour;
