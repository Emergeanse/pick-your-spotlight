import { useState } from "react";
import { motion } from "framer-motion";
import { Film, Tv, Clapperboard, Clock, Target, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MEDIA_OPTIONS = [
  { label: "Films & Séries", value: "both" as const, icon: Clapperboard },
  { label: "Films", value: "movie" as const, icon: Film },
  { label: "Séries", value: "tv" as const, icon: Tv },
] as const;

const DURATION_OPTIONS = [
  { label: "Peu importe", value: null },
  { label: "1h30", value: 90 },
  { label: "2h00", value: 120 },
  { label: "2h30", value: 150 },
  { label: "3h00", value: 180 },
] as const;

interface ProfilePreferencesProps {
  matchThreshold: number;
  onMatchThresholdChange: (v: number) => void;
  mediaType: "both" | "movie" | "tv";
  onMediaTypeChange: (v: "both" | "movie" | "tv") => void;
  maxDuration: number | null;
  onMaxDurationChange: (v: number | null) => void;
}

const ProfilePreferences = ({
  matchThreshold,
  onMatchThresholdChange,
  mediaType,
  onMediaTypeChange,
  maxDuration,
  onMaxDurationChange,
}: ProfilePreferencesProps) => {
  return (
    <>
      {/* ─── Match threshold ─── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5 text-primary/60" />
          <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest">Niveau de correspondance</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><button className="text-foreground/20"><Info className="w-3 h-3" /></button></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                <p>Plus le pourcentage est élevé, plus les recommandations seront proches de vos goûts.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-sans text-sm font-medium">{matchThreshold}%</span>
            {matchThreshold >= 95 && <span className="text-[10px] font-sans text-destructive/70">Très sélectif</span>}
            {matchThreshold <= 30 && <span className="text-[10px] font-sans text-primary/70">Très ouvert</span>}
          </div>
          <Slider value={[matchThreshold]} onValueChange={([v]) => onMatchThresholdChange(v)} min={0} max={100} step={5} className="w-full" />
        </div>
      </motion.section>

      {/* ─── Media type ─── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
        <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest mb-3">Type de contenu</h2>
        <div className="flex gap-1.5">
          {MEDIA_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mediaType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onMediaTypeChange(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all active:scale-[0.97] ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-foreground/5 text-foreground/50 border border-transparent hover:bg-foreground/8"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* ─── Duration ─── */}
      {mediaType !== "tv" && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="w-3.5 h-3.5 text-foreground/40" />
            <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest">Durée souhaitée</h2>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DURATION_OPTIONS.map((opt) => {
              const active = maxDuration === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => onMaxDurationChange(opt.value)}
                  className={`px-4 py-2 rounded-xl text-[12px] font-sans font-medium transition-all active:scale-[0.97] ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-foreground/5 text-foreground/50 border border-transparent hover:bg-foreground/8"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </motion.section>
      )}
    </>
  );
};

export default ProfilePreferences;
