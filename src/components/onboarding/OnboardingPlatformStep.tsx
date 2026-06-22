import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_PLATFORMS } from "@/lib/platforms";
import {
  DEFAULT_ONBOARDING_PLATFORM_IDS,
  ensureOnboardingPlatforms,
  isLockedFreePlatform,
} from "@/lib/onboarding-platforms";

interface OnboardingPlatformStepProps {
  initialPlatformIds?: number[];
  onBack: () => void;
  onContinue: (platformIds: number[]) => void;
}

export default function OnboardingPlatformStep({
  initialPlatformIds,
  onBack,
  onContinue,
}: OnboardingPlatformStepProps) {
  const [selected, setSelected] = useState<number[]>(() =>
    ensureOnboardingPlatforms(initialPlatformIds?.length ? initialPlatformIds : DEFAULT_ONBOARDING_PLATFORM_IDS),
  );

  useEffect(() => {
    if (initialPlatformIds?.length) {
      setSelected(ensureOnboardingPlatforms(initialPlatformIds));
    }
  }, [initialPlatformIds?.join(",")]);

  const toggle = (id: number) => {
    if (isLockedFreePlatform(id)) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleContinue = () => {
    onContinue(ensureOnboardingPlatforms(selected));
  };

  return (
    <div className="flex flex-col min-h-full px-5 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <h1 className="text-2xl md:text-3xl font-serif mb-2 max-w-lg">Où tu regardes ?</h1>
      <p className="text-sm text-muted-foreground font-sans mb-1 max-w-lg leading-relaxed">
        Pick ne te propose que des films disponibles sur tes plateformes.
      </p>
      <p className="text-[10px] font-sans text-foreground/45 mb-5 max-w-lg uppercase tracking-wide">
        Arte, TF1+, Rakuten et M6+ sont inclus par défaut (gratuits)
      </p>

      <div className="grid grid-cols-3 gap-2.5 max-w-lg mb-6">
        {ALL_PLATFORMS.map((platform, i) => {
          const isSelected = selected.includes(platform.id);
          const locked = isLockedFreePlatform(platform.id);
          return (
            <motion.button
              key={platform.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={locked ? undefined : { scale: 0.96 }}
              onClick={() => toggle(platform.id)}
              className={`relative rounded-xl p-3 flex flex-col items-center gap-2 border transition-all min-h-[80px] ${
                isSelected
                  ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.4)]"
                  : "border-border/25 bg-card/50 hover:border-primary/20"
              } ${locked ? "cursor-default" : "cursor-pointer"}`}
            >
              {isSelected && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  {locked ? (
                    <Lock className="w-2 h-2 text-primary-foreground" />
                  ) : (
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  )}
                </span>
              )}
              <img
                src={platform.logo}
                alt={platform.label}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <span className="text-[10px] font-sans text-center leading-tight text-foreground/85">
                {platform.label}
              </span>
              {locked && (
                <span className="text-[8px] font-sans uppercase tracking-wider text-primary/70">Gratuit</span>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="text-[10px] font-sans text-muted-foreground text-center max-w-lg mb-6">
        {selected.length} plateforme{selected.length > 1 ? "s" : ""} · tu pourras modifier dans ton profil
      </p>

      <Button variant="hero" size="xl" className="w-full max-w-lg" onClick={handleContinue}>
        Continuer <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
