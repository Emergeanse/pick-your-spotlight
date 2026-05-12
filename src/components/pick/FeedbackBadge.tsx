import { Eye, EyeOff, Heart, Bookmark, HelpCircle, Sparkles } from "lucide-react";
import type { FeedbackType } from "@/lib/feedback";

interface FeedbackBadgeProps {
  type: FeedbackType | null | undefined;
  inWatchlist?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

type BadgeMeta = {
  icon: typeof Heart;
  label: string;
  className: string;
};

const META: Record<FeedbackType, BadgeMeta> = {
  love: {
    icon: Sparkles,
    label: "Adoré",
    className: "bg-pink-500/95 text-white border border-pink-300/60 shadow-[0_0_24px_rgba(236,72,153,0.45)]",
  },
  like: {
    icon: Heart,
    label: "Aimé",
    className:
      "bg-primary/95 text-primary-foreground border border-primary/60 shadow-[0_0_24px_hsl(var(--primary)/0.45)]",
  },
  watchlist: {
    icon: Bookmark,
    label: "À voir",
    className: "bg-amber-500/95 text-white border border-amber-300/60 shadow-[0_0_24px_rgba(245,158,11,0.4)]",
  },
  seen: {
    icon: Eye,
    label: "Déjà vu",
    className: "bg-emerald-600/95 text-white border border-emerald-300/60 shadow-[0_0_24px_rgba(5,150,105,0.4)]",
  },
  not_for_me: {
    icon: EyeOff,
    label: "Pas pour moi",
    className: "bg-rose-600/95 text-white border border-rose-300/60 shadow-[0_0_24px_rgba(225,29,72,0.42)]",
  },
  unknown: {
    icon: HelpCircle,
    label: "Inconnu",
    className: "bg-foreground/80 text-background border border-foreground/30 shadow-[0_0_18px_rgba(255,255,255,0.12)]",
  },
  skip: {
    icon: EyeOff,
    label: "Passé",
    className: "bg-muted-foreground/90 text-background border border-white/20 shadow-[0_0_18px_rgba(255,255,255,0.10)]",
  },
  dislike: {
    icon: EyeOff,
    label: "Détesté",
    className:
      "bg-destructive/95 text-destructive-foreground border border-destructive/60 shadow-[0_0_24px_hsl(var(--destructive)/0.45)]",
  },
};

const FeedbackBadge = ({ type, inWatchlist, size = "xs", className = "" }: FeedbackBadgeProps) => {
  const effectiveType: FeedbackType | null = type ?? (inWatchlist ? "watchlist" : null);

  if (!effectiveType) return null;

  const meta = META[effectiveType];
  if (!meta) return null;

  const Icon = meta.icon;

  const sizeClass =
    size === "sm"
      ? "text-[11px] px-2.5 py-1 gap-1.5 [&>svg]:w-3.5 [&>svg]:h-3.5"
      : "text-[9px] px-2 py-0.5 gap-1 [&>svg]:w-3 [&>svg]:h-3";

  return (
    <div
      title={meta.label}
      className={`inline-flex items-center rounded-full font-sans font-semibold backdrop-blur-md ring-1 ring-white/10 ${meta.className} ${sizeClass} ${className}`}
    >
      <Icon />
      <span>{meta.label}</span>
    </div>
  );
};

export default FeedbackBadge;
