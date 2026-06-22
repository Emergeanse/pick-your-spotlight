import { ChevronLeft } from "lucide-react";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding-progress";
import { ONBOARDING_FILM_TARGET } from "@/lib/onboarding-films";

const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: "Bienvenue",
  genres: "Genres",
  platforms: "Plateformes",
  films: "Films",
  actors: "Acteurs",
  directors: "Réalisateurs",
  modes: "Solo & Duo",
  soirees: "Soirées",
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
              <span className="text-primary/70">
                {" "}· {Math.min(filmsProgress, ONBOARDING_FILM_TARGET)}/{ONBOARDING_FILM_TARGET}
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
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < stepIndex ? "bg-primary" : "bg-foreground/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
