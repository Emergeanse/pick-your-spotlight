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
  badgeClass: string;
  iconClass?: string;
};

const META: Record<FeedbackType, BadgeMeta> = {
  love: {
    icon: Sparkles,
    label: "Adoré",
    badgeClass:
      "bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white border border-pink-300/70 shadow-[0_0_26px_rgba(236,72,153,0.55)] ring-1 ring-white/20",
    iconClass: "fill-current",
  },
  like: {
    icon: Heart,
    label: "Aimé",
    badgeClass:
      "bg-primary text-primary-foreground border border-primary/80 shadow-[0_0_24px_hsl(var(--primary)/0.5)] ring-1 ring-white/15",
    iconClass: "fill-current",
  },
  watchlist: {
    icon: Bookmark,
    label: "À voir",
    badgeClass:
      "bg-sky-500 text-white border border-sky-300/70 shadow-[0_0_24px_rgba(14,165,233,0.48)] ring-1 ring-white/15",
    iconClass: "fill-current",
  },
  seen: {
    icon: Eye,
    label: "Déjà vu",
    badgeClass:
      "bg-emerald-500 text-white border border-emerald-300/70 shadow-[0_0_24px_rgba(16,185,129,0.45)] ring-1 ring-white/15",
  },
  not_for_me: {
    icon: EyeOff,
    label: "Pas pour moi",
    badgeClass:
      "bg-rose-600 text-white border border-rose-300/70 shadow-[0_0_24px_rgba(225,29,72,0.5)] ring-1 ring-white/10",
  },
  unknown: {
    icon: HelpCircle,
    label: "Inconnu",
    badgeClass: "bg-foreground/85 text-background border border-white/15 shadow-[0_0_18px_rgba(255,255,255,0.12)]",
  },
  skip: {
    icon: EyeOff,
    label: "Passé",
    badgeClass: "bg-zinc-600 text-white border border-zinc-300/30 shadow-[0_0_18px_rgba(255,255,255,0.08)]",
  },
  dislike: {
    icon: EyeOff,
    label: "Détesté",
    badgeClass:
      "bg-destructive text-destructive-foreground border border-destructive/80 shadow-[0_0_24px_hsl(var(--destructive)/0.5)] ring-1 ring-white/10",
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
      className={`inline-flex items-center rounded-full font-sans font-bold backdrop-blur-md transition-all ${meta.badgeClass} ${sizeClass} ${className}`}
    >
      <Icon className={meta.iconClass ?? ""} />
      <span>{meta.label}</span>
    </div>
  );
};

export default FeedbackBadge;
