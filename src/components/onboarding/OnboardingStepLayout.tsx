import type { ReactNode } from "react";

interface OnboardingStepLayoutProps {
  children: ReactNode;
}

/** Colonne centrée pour les étapes initiatique (mobile + desktop). */
export default function OnboardingStepLayout({ children }: OnboardingStepLayoutProps) {
  return (
    <div className="flex flex-col items-center min-h-full w-full px-5 pb-8 pt-2">
      <div className="w-full max-w-xl mx-auto flex flex-col">{children}</div>
    </div>
  );
}
