import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding-progress";
import { ONBOARDING_FILM_TARGET } from "@/lib/onboarding-films";

const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: "Bienvenue",
  genres: "Genres",
  films: "Films",
  platforms: "Plateformes",
  search: "Recherche",
};

interface OnboardingChromeProps {
  step: OnboardingStep;
  onPause: () => void;
  onBack?: () => void;
  pausing?: boolean;
  filmsProgress?: number;
}

export default function OnboardingChrome({
  step,
  onPause,
  onBack,
  pausing,
  filmsProgress = 0,
}: OnboardingChromeProps) {
  const stepIndex = ONBOARDING_STEPS.indexOf(step) + 1;
  const totalSteps = ONBOARDING_STEPS.length;
  const stepLabel = STEP_LABELS[step];

  const prevStepIndexRef = useRef(stepIndex);
  const [bounceIndex, setBounceIndex] = useState<number | null>(null);
  useEffect(() => {
    if (stepIndex > prevStepIndexRef.current) {
      setBounceIndex(stepIndex - 1);
      const t = window.setTimeout(() => setBounceIndex(null), 450);
      prevStepIndexRef.current = stepIndex;
      return () => window.clearTimeout(t);
    }
    prevStepIndexRef.current = stepIndex;
  }, [stepIndex]);

  return (
    <div className="w-full max-w-xl mx-auto px-5 pt-[env(safe-area-inset-top)] pb-2">
      <div className="flex items-center gap-2 mb-2">
        {onBack && step !== "welcome" ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Étape précédente"
            className="w-8 h-8 shrink-0 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-8 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-sans uppercase tracking-widest text-foreground/40 truncate">
            Initiation · {stepIndex}/{totalSteps} · {stepLabel}
            {step === "films" && (
              <span className={filmsProgress >= ONBOARDING_FILM_TARGET ? "text-emerald-500" : "text-primary/70"}>
                {" "}· {filmsProgress}/{ONBOARDING_FILM_TARGET}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onPause}
          disabled={pausing}
          className="shrink-0 text-[11px] font-sans font-medium text-foreground/45 hover:text-foreground/70 transition-colors disabled:opacity-40"
        >
          {pausing ? "…" : "Plus tard"}
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {ONBOARDING_STEPS.map((s, i) => (
          <motion.div
            key={s}
            animate={i === bounceIndex ? { scaleY: [1, 1.8, 1] } : { scaleY: 1 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
            className={`h-1 flex-1 rounded-full origin-center transition-colors ${
              i < stepIndex ? "bg-primary" : "bg-foreground/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
