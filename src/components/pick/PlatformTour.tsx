import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, MessageCircle, Brain, Bookmark, Dna } from "lucide-react";
import pickWave from "@/assets/pick-squirrel-wave.png";

const SLIDES = [
  {
    icon: Sparkles,
    emoji: "🍿",
    title: "Pick pour ce soir",
    desc: "Dis-moi ce que tu veux, je trouve le film parfait pour ta soirée.",
    detail: "En quelques questions, je te recommande un film taillé sur mesure.",
  },
  {
    icon: MessageCircle,
    emoji: "💬",
    title: "Parle à Pick",
    desc: "Demande-moi n'importe quoi sur le cinéma.",
    detail: "Essaie : « Un thriller psychologique récent » ou « Quelque chose de léger avec de l'humour »",
  },
  {
    icon: Brain,
    emoji: "🧠",
    title: "Entraîne ton Pick",
    desc: "Swipe des films pour que je comprenne tes goûts.",
    detail: "Plus tu m'entraînes, plus mes recommandations sont précises.",
  },
  {
    icon: Bookmark,
    emoji: "📌",
    title: "Watchlist & Coups de cœur",
    desc: "Sauvegarde tout ce que tu veux voir et ce que tu as adoré.",
    detail: "Ta collection personnelle, toujours à portée de main.",
  },
  {
    icon: Dna,
    emoji: "🧬",
    title: "Ton ADN Cinéma",
    desc: "Plus tu m'utilises, plus ton profil cinéma se construit.",
    detail: "Découvre ta personnalité cinématographique unique.",
  },
];

interface PlatformTourProps {
  onComplete: () => void;
}

const PlatformTour = ({ onComplete }: PlatformTourProps) => {
  const [currentSlide, setCurrentSlide] = useState(-1); // -1 = intro

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      onComplete();
    }
  };

  const isIntro = currentSlide === -1;
  const slide = !isIntro ? SLIDES[currentSlide] : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-5">
        {/* Progress dots */}
        {!isIntro && (
          <div className="absolute top-8 left-0 right-0 flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <div key={i} className={`h-1 w-8 rounded-full transition-colors duration-300 ${i <= currentSlide ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isIntro ? (
            <motion.div key="intro" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }} className="text-center max-w-sm">
              <motion.img src={pickWave} alt="Pick" className="w-20 h-20 object-contain mx-auto mb-6"
                initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} />
              <h2 className="text-2xl font-serif mb-3">Bienvenue chez toi ! 🎬</h2>
              <p className="text-foreground/50 text-sm font-sans leading-relaxed mb-2">
                Avant de commencer, laisse-moi te faire un petit tour de la plateforme.
              </p>
              <p className="text-primary/50 text-xs font-sans mb-8">30 secondes, promis.</p>
              <Button variant="hero" size="xl" onClick={handleNext}>
                Découvrir Pick <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          ) : slide && (
            <motion.div key={currentSlide} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }} className="text-center max-w-sm">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">{slide.emoji}</span>
              </motion.div>

              <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="text-2xl font-serif mb-3">{slide.title}</motion.h2>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                className="text-foreground/60 text-sm font-sans leading-relaxed mb-2">{slide.desc}</motion.p>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="text-primary/50 text-xs font-sans italic mb-10">{slide.detail}</motion.p>

              <Button variant="hero" size="xl" onClick={handleNext}>
                {currentSlide < SLIDES.length - 1 ? "Suivant" : "C'est compris, on y va !"} <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip button */}
        {!isIntro && (
          <button onClick={onComplete} className="absolute bottom-10 text-foreground/30 text-xs font-sans hover:text-foreground/60 transition-colors">
            Passer le tour
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default PlatformTour;
