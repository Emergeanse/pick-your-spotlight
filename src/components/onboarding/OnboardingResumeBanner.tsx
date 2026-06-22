import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { fetchOnboardingPaused } from "@/lib/onboarding-progress";

export default function OnboardingResumeBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || dismissed) return;
    fetchOnboardingPaused().then(setVisible);
  }, [user, dismissed]);

  if (!visible || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-[60] px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] md:pointer-events-none"
    >
      <div className="mx-auto max-w-lg md:max-w-[420px] pointer-events-auto">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-background/95 backdrop-blur-xl px-4 py-3 shadow-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-sans font-semibold text-foreground">Initiation en pause</p>
            <p className="text-[10px] font-sans text-foreground/50 truncate">
              Reprends où tu t&apos;es arrêté pour calibrer Pick.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-sans font-semibold"
          >
            Reprendre
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Masquer"
            className="shrink-0 p-1 rounded-full text-foreground/40 hover:text-foreground/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
