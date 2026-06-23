import type { ReactNode } from "react";

interface OnboardingStickyFooterProps {
  children: ReactNode;
}

/** Barre d'action fixée en bas de l'écran pendant le scroll de l'étape. */
export default function OnboardingStickyFooter({ children }: OnboardingStickyFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-border/20 bg-background/95 backdrop-blur-xl px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-xl mx-auto">{children}</div>
    </div>
  );
}
