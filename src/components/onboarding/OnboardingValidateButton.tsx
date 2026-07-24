import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingValidateButtonProps {
  onValidate: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  label?: string;
}

/** Bouton "Continuer" des étapes de l'initiation — petit pulse + coche au tap avant de passer à la suite. */
export default function OnboardingValidateButton({
  onValidate,
  disabled,
  loading = false,
  loadingLabel = "Enregistrement…",
  label = "Continuer",
}: OnboardingValidateButtonProps) {
  const [validated, setValidated] = useState(false);

  const handleClick = () => {
    if (disabled || loading || validated) return;
    setValidated(true);
    window.setTimeout(() => void onValidate(), 260);
  };

  return (
    <Button variant="hero" size="xl" className="w-full" disabled={disabled || loading} onClick={handleClick}>
      <motion.span
        key={loading ? "loading" : validated ? "validated" : "idle"}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: [1, 1.08, 1], opacity: 1 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}
          </>
        ) : validated ? (
          <>
            <Check className="w-4 h-4" /> {label}
          </>
        ) : (
          <>
            {label} <ArrowRight className="w-4 h-4" />
          </>
        )}
      </motion.span>
    </Button>
  );
}
