import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type TrophyBadgeProps = {
  Icon: LucideIcon;
  reached: boolean;
  accentRgb: string;
  /** compact = grille 7 cols ; preview = rangée collapsed ; detail = cartes catégorie */
  size?: "compact" | "preview" | "detail";
  className?: string;
  label?: string;
  threshold?: number;
  showMeta?: boolean;
};

/**
 * Médaille ciné : anneau + icône Lucide, glow catégorie si débloqué.
 * Remplace les emojis génériques de la grille trophées.
 */
export function TrophyBadge({
  Icon,
  reached,
  accentRgb,
  size = "compact",
  className,
  label,
  threshold,
  showMeta = false,
}: TrophyBadgeProps) {
  const iconSize =
    size === "detail" ? "w-5 h-5" : size === "preview" ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        showMeta && "p-2 rounded-xl border",
        showMeta &&
          (reached
            ? "bg-primary/[0.06] border-primary/20"
            : "bg-card/50 border-border/15"),
        className
      )}
    >
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full border transition-all",
          size === "detail" && "w-11 h-11",
          size === "preview" && "w-9 h-9",
          size === "compact" && "w-full aspect-square",
          reached
            ? "border-transparent"
            : "border-foreground/10 bg-foreground/[0.03]"
        )}
        style={
          reached
            ? {
                background: `radial-gradient(circle at 35% 30%, rgba(${accentRgb}, 0.35), rgba(${accentRgb}, 0.08) 55%, rgba(0,0,0,0.35) 100%)`,
                boxShadow: `0 0 14px rgba(${accentRgb}, 0.28), inset 0 0 0 1.5px rgba(${accentRgb}, 0.55)`,
              }
            : undefined
        }
      >
        {/* anneau intérieur type médaille */}
        <span
          className={cn(
            "absolute inset-[3px] rounded-full border pointer-events-none",
            reached ? "border-white/15" : "border-foreground/[0.06]"
          )}
        />
        <Icon
          className={cn(
            iconSize,
            "relative z-[1]",
            reached ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" : "text-foreground/25"
          )}
          strokeWidth={reached ? 2.1 : 1.6}
        />
        {!reached && (
          <Lock className="absolute bottom-0.5 right-0.5 w-2 h-2 text-foreground/30 z-[2]" strokeWidth={2.5} />
        )}
      </span>

      {showMeta && label && (
        <>
          <span
            className={cn(
              "text-[8px] font-sans text-center leading-tight mt-0.5",
              reached ? "text-foreground/60" : "text-foreground/30"
            )}
          >
            {label}
          </span>
          {typeof threshold === "number" && (
            <span
              className={cn(
                "text-[7px] font-sans tabular-nums",
                reached ? "text-primary/50" : "text-foreground/20"
              )}
            >
              {threshold}
            </span>
          )}
        </>
      )}
    </div>
  );
}
