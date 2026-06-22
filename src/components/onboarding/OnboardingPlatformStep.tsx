import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_PLATFORMS } from "@/lib/platforms";
import {
  DEFAULT_ONBOARDING_PLATFORM_IDS,
  ensureOnboardingPlatforms,
  isLockedFreePlatform,
} from "@/lib/onboarding-platforms";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";

interface OnboardingPlatformStepProps {
  initialPlatformIds?: number[];
  onContinue: (platformIds: number[]) => void;
}

function PlatformLogo({ src, label }: { src: string; label: string }) {
  return (
    <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex items-center justify-center p-1 shrink-0">
      <img src={src} alt={label} className="max-w-full max-h-full object-contain rounded-sm" />
    </div>
  );
}

export default function OnboardingPlatformStep({
  initialPlatformIds,
  onContinue,
}: OnboardingPlatformStepProps) {
  const [selected, setSelected] = useState<number[]>(() =>
    ensureOnboardingPlatforms(initialPlatformIds?.length ? initialPlatformIds : DEFAULT_ONBOARDING_PLATFORM_IDS),
  );

  const { includedFree, optional } = useMemo(() => {
    const includedFree = ALL_PLATFORMS.filter((p) => isLockedFreePlatform(p.id));
    const optional = ALL_PLATFORMS.filter((p) => !isLockedFreePlatform(p.id));
    return { includedFree, optional };
  }, []);

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

  const optionalSelectedCount = optional.filter((p) => selected.includes(p.id)).length;

  return (
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">Où tu regardes ?</h1>
      <p className="text-sm text-muted-foreground font-sans mb-5 leading-relaxed">
        Pick ne te propose que des films disponibles sur tes plateformes.
      </p>

      <div className="mb-5">
        <p className="text-[10px] font-sans font-semibold uppercase tracking-widest text-emerald-400/90 mb-2.5">
          Gratuits · toujours inclus
        </p>
        <div className="grid grid-cols-2 gap-2">
          {includedFree.map((platform) => (
            <div
              key={platform.id}
              className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2.5 min-h-[56px]"
            >
              <PlatformLogo src={platform.logo} label={platform.label} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-sans font-semibold text-foreground/90 truncate">
                  {platform.label}
                </p>
                <p className="text-[9px] font-sans text-emerald-400/80">Inclus</p>
              </div>
              <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/90 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-sans font-semibold uppercase tracking-widest text-foreground/45 mb-2.5">
          Tes abonnements · optionnel
        </p>
        <div className="grid grid-cols-3 gap-2">
          {optional.map((platform, i) => {
            const isSelected = selected.includes(platform.id);
            return (
              <motion.button
                key={platform.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(platform.id)}
                className={`relative rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 border transition-all h-[92px] ${
                  isSelected
                    ? "border-primary/45 bg-primary/10"
                    : "border-border/20 bg-card/40 hover:border-primary/25"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={2.5} />
                  </span>
                )}
                <PlatformLogo src={platform.logo} label={platform.label} />
                <span className="text-[9px] font-sans text-center leading-tight text-foreground/80 line-clamp-2 px-0.5">
                  {platform.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] font-sans text-muted-foreground text-center mb-6">
        {includedFree.length} gratuit{includedFree.length > 1 ? "s" : ""}
        {optionalSelectedCount > 0 && ` + ${optionalSelectedCount} abonnement${optionalSelectedCount > 1 ? "s" : ""}`}
        {" · "}modifiable dans ton profil
      </p>

      <Button variant="hero" size="xl" className="w-full" onClick={() => onContinue(ensureOnboardingPlatforms(selected))}>
        Continuer <ArrowRight className="w-4 h-4" />
      </Button>
    </OnboardingStepLayout>
  );
}
