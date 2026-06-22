import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding-progress";

interface OnboardingChromeProps {
  step: OnboardingStep;
  onPause: () => void;
  pausing?: boolean;
}

export default function OnboardingChrome({ step, onPause, pausing }: OnboardingChromeProps) {
  const stepIndex = ONBOARDING_STEPS.indexOf(step) + 1;
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="w-full max-w-lg mx-auto px-5 pt-[env(safe-area-inset-top)] pb-2">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-sans uppercase tracking-widest text-foreground/40">
          Initiation · {stepIndex}/{totalSteps}
        </p>
        <button
          type="button"
          onClick={onPause}
          disabled={pausing}
          className="text-[11px] font-sans font-medium text-foreground/45 hover:text-foreground/70 transition-colors disabled:opacity-40"
        >
          {pausing ? "Enregistrement…" : "Plus tard"}
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
