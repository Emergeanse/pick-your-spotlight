import { motion } from "framer-motion";
import { Film, Tv, Clapperboard, Clock, Target, Info, Compass } from "lucide-react";
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
  /** 0 = pile dans mes goûts, 10 = surprends-moi. N'affecte jamais la note. */
  explorationLevel: number;
  onExplorationLevelChange: (v: number) => void;
  mediaType: "both" | "movie" | "tv";
  onMediaTypeChange: (v: "both" | "movie" | "tv") => void;
  maxDuration: number | null;
  onMaxDurationChange: (v: number | null) => void;
}

const ProfilePreferences = ({
  matchThreshold,
  onMatchThresholdChange,
  explorationLevel,
  onExplorationLevelChange,
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
          <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest">Exigence des reco</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><button className="text-foreground/40"><Info className="w-3 h-3" /></button></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                <p>Plus c&apos;est élevé, moins Pick te propose de titres — mais plus ils collent à ton profil.</p>
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
          <p className="text-[11px] text-foreground/50 mt-3">À quel point Pick doit être exigeant avant de te proposer un titre.</p>
        </div>
      </motion.section>

      {/* ─── Profondeur de découverte ─── */}
      {/* Distinct de l'exigence ci-dessus : celle-ci porte sur la QUALITÉ,
          celui-ci sur la DISTANCE à tes goûts. La note minimale reste un
          plancher quelle que soit la profondeur choisie. */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.075 }} className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-3.5 h-3.5 text-primary/60" />
          <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest">Envie de découverte</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><button className="text-foreground/40"><Info className="w-3 h-3" /></button></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                <p>Ce réglage ne baisse jamais la qualité : les films restent aussi bien notés, ils s&apos;éloignent simplement de tes habitudes.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-sans text-sm font-medium">
              {explorationLevel <= 2
                ? "Pile dans mes goûts"
                : explorationLevel <= 5
                  ? "Un peu à côté"
                  : explorationLevel <= 8
                    ? "Fais-moi voyager"
                    : "Surprends-moi"}
            </span>
            <span className="text-[10px] font-sans text-foreground/40">{explorationLevel}/10</span>
          </div>
          <Slider
            value={[explorationLevel]}
            onValueChange={([v]) => onExplorationLevelChange(v)}
            min={0}
            max={10}
            step={1}
            className="w-full"
          />
          <p className="text-[11px] text-foreground/50 mt-3">
            {explorationLevel <= 2
              ? "Pick reste au cœur de ce que tu aimes."
              : explorationLevel <= 5
                ? "Pick s'autorise le voisinage de tes goûts."
                : explorationLevel <= 8
                  ? "Pick va chercher des genres que tu explores peu."
                  : "Pick part loin de tes habitudes — sans jamais descendre en qualité."}
          </p>
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
            <h2 className="text-sm font-sans font-semibold text-foreground/70 uppercase tracking-widest">Durée souhaitée</h2>
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
