import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Trophy } from "lucide-react";
import { TrophyBadge } from "@/components/pick/TrophyBadge";
import {
  TROPHY_CATEGORIES,
  flattenTrophyMilestones,
  getNextTrophyHint,
  getTrophyTier,
  type TrophyMilestoneMeta,
} from "@/lib/trophies";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "pick_trophies_expanded";
const PREVIEW_COUNT = 7;

type TrophySectionProps = {
  values: Record<string, number>;
};

function readStoredExpanded(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredExpanded(expanded: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function MilestoneButton({
  milestone,
  reached,
  remaining,
  size = "compact",
}: {
  milestone: TrophyMilestoneMeta;
  reached: boolean;
  remaining: number;
  size?: "compact" | "preview";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={
            size === "preview"
              ? "w-9 h-9 shrink-0 rounded-full active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              : "aspect-square w-full rounded-lg active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          }
        >
          <TrophyBadge
            Icon={milestone.Icon}
            reached={reached}
            accentRgb={milestone.accentRgb}
            size={size}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px] text-center">
        <p className="font-semibold">{reached ? milestone.label : "À débloquer"}</p>
        <p className="text-[10px] opacity-80 mt-0.5">{milestone.categoryLabel}</p>
        {!reached && (
          <p className="text-[10px] opacity-70 mt-0.5 tabular-nums">
            {remaining} restant{remaining > 1 ? "s" : ""}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Section trophées Profil — version compressée (aperçu) / dépliée (grille + catégories).
 * Défaut : collapsed mobile, expanded desktop ; préférence mémorisée en localStorage.
 */
export function TrophySection({ values }: TrophySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showByCategory, setShowByCategory] = useState(false);

  useEffect(() => {
    const stored = readStoredExpanded();
    if (stored !== null) {
      setExpanded(stored);
    } else {
      setExpanded(window.innerWidth >= 768);
    }
    setHydrated(true);
  }, []);

  const allMilestones = useMemo(() => flattenTrophyMilestones(), []);
  const unlocked = useMemo(
    () => allMilestones.filter((m) => (values[m.categoryKey] ?? 0) >= m.count),
    [allMilestones, values]
  );
  const totalUnlocked = unlocked.length;
  const totalMilestones = allMilestones.length;
  const progressPct = totalMilestones > 0 ? (totalUnlocked / totalMilestones) * 100 : 0;
  const tier = getTrophyTier(totalUnlocked);
  const nextHint = getNextTrophyHint(values);

  const previewMilestones = useMemo(() => {
    if (unlocked.length > 0) {
      return unlocked.slice(-PREVIEW_COUNT).reverse();
    }
    // Aucun débloqué : teaser des 4 premiers locked
    return allMilestones.slice(0, 4);
  }, [unlocked, allMilestones]);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      writeStoredExpanded(next);
      if (!next) setShowByCategory(false);
      return next;
    });
  };

  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
      {/* Header toujours visible */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
            <span className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest">
              Trophées
            </span>
          </div>
          <h3 className="text-base font-serif text-foreground leading-tight">{tier.title}</h3>
          <p className="text-[11px] font-sans text-foreground/50 mt-0.5 leading-snug">{tier.subtitle}</p>
        </div>
        <div className="text-right shrink-0 pt-0.5">
          <span className="text-2xl font-serif font-bold text-primary tabular-nums">{totalUnlocked}</span>
          <span className="text-[11px] font-sans text-foreground/40 tabular-nums">/{totalMilestones}</span>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden mb-3">
        <motion.div
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ delay: hydrated ? 0 : 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-amber-500/40 via-primary/60 to-primary"
        />
      </div>

      <TooltipProvider delayDuration={200}>
        {/* Compressée : aperçu médailles */}
        <AnimatePresence initial={false} mode="wait">
          {!expanded && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-dark pb-0.5 -mx-0.5 px-0.5">
                {previewMilestones.map((m) => {
                  const reached = (values[m.categoryKey] ?? 0) >= m.count;
                  const remaining = Math.max(0, m.count - (values[m.categoryKey] ?? 0));
                  return (
                    <MilestoneButton
                      key={`${m.categoryKey}-${m.count}-preview`}
                      milestone={m}
                      reached={reached}
                      remaining={remaining}
                      size="preview"
                    />
                  );
                })}
                {unlocked.length > PREVIEW_COUNT && (
                  <span className="text-[10px] font-sans text-foreground/35 tabular-nums shrink-0 pl-0.5">
                    +{unlocked.length - PREVIEW_COUNT}
                  </span>
                )}
              </div>

              {nextHint && <NextTrophyHint hint={nextHint} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dépliée : grille complète */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {allMilestones.map((m) => {
                  const reached = (values[m.categoryKey] ?? 0) >= m.count;
                  const remaining = Math.max(0, m.count - (values[m.categoryKey] ?? 0));
                  return (
                    <MilestoneButton
                      key={`${m.categoryKey}-${m.count}`}
                      milestone={m}
                      reached={reached}
                      remaining={remaining}
                      size="compact"
                    />
                  );
                })}
              </div>

              {nextHint && <NextTrophyHint hint={nextHint} />}

              <button
                type="button"
                onClick={() => setShowByCategory((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border/10 text-[11px] font-sans text-primary/50 hover:text-primary/70 transition-colors"
              >
                {showByCategory ? "Masquer les catégories" : "Voir par catégorie"}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${showByCategory ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {showByCategory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5 pt-4">
                      {TROPHY_CATEGORIES.map((cat) => {
                        const value = values[cat.key] ?? 0;
                        const nextM = cat.milestones.find((m) => value < m.count);
                        const unlockedCount = cat.milestones.filter((m) => value >= m.count).length;
                        const catProgress =
                          cat.milestones.length > 0 ? (unlockedCount / cat.milestones.length) * 100 : 0;
                        return (
                          <div key={cat.key}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-sans font-semibold text-foreground/50 uppercase tracking-widest">
                                {cat.label}
                              </p>
                              <span className="text-[10px] font-sans text-primary/50 tabular-nums">
                                {unlockedCount}/{cat.milestones.length}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden mb-2.5">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${catProgress}%`,
                                  backgroundColor: `rgba(${cat.accentRgb}, 0.45)`,
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {cat.milestones.map((m) => {
                                const reached = value >= m.count;
                                return (
                                  <TrophyBadge
                                    key={m.count}
                                    Icon={m.Icon}
                                    reached={reached}
                                    accentRgb={cat.accentRgb}
                                    size="detail"
                                    showMeta
                                    label={m.label}
                                    threshold={m.count}
                                  />
                                );
                              })}
                            </div>
                            {nextM && (
                              <p className="text-foreground/45 text-[10px] font-sans mt-2 text-center">
                                Plus que{" "}
                                <span className="text-primary/60 font-medium tabular-nums">
                                  {nextM.count - value}
                                </span>{" "}
                                pour « {nextM.label} »
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </TooltipProvider>

      {/* CTA principal collapsed / expanded */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border/10 text-[11px] font-sans text-primary/60 hover:text-primary/80 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? "Réduire" : "Voir tous les trophées"}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}

function NextTrophyHint({
  hint,
}: {
  hint: NonNullable<ReturnType<typeof getNextTrophyHint>>;
}) {
  const NextIcon = hint.milestone.Icon;
  return (
    <p className="text-[11px] font-sans text-foreground/50 text-center leading-snug px-1 flex items-center justify-center gap-1.5 flex-wrap">
      <span>Prochain trophée :</span>
      <span className="inline-flex items-center gap-1 text-foreground/70">
        <NextIcon className="w-3 h-3" style={{ color: hint.milestone.accent }} />
        {hint.milestone.label}
      </span>
      <span>
        — encore{" "}
        <span className="text-primary/70 font-medium tabular-nums">{hint.remaining}</span> (
        {hint.milestone.categoryLabel.toLowerCase()})
      </span>
    </p>
  );
}
