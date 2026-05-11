import { Eye, EyeOff, Heart, Bookmark, HelpCircle, Sparkles } from "lucide-react";
import type { FeedbackType } from "@/lib/feedback";

interface FeedbackBadgeProps {
  type: FeedbackType | null | undefined;
  inWatchlist?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

const META: Record<FeedbackType, { icon: typeof Heart; label: string; color: string }> = {
  love:       { icon: Heart,       label: "Adoré",     color: "bg-pink-500/90 text-white" },
  like:       { icon: Heart,       label: "Aimé",      color: "bg-primary/90 text-primary-foreground" },
  watchlist:  { icon: Bookmark,    label: "À voir",    color: "bg-amber-500/90 text-white" },
  seen:       { icon: Eye,         label: "Déjà vu",   color: "bg-emerald-600/90 text-white" },
  not_for_me: { icon: EyeOff,      label: "Pas pour moi", color: "bg-rose-600/90 text-white" },
  unknown:    { icon: HelpCircle,  label: "Inconnu",   color: "bg-foreground/60 text-background" },
  skip:       { icon: EyeOff,      label: "Passé",     color: "bg-muted-foreground/80 text-background" },
  dislike:    { icon: EyeOff,      label: "Détesté",   color: "bg-destructive/90 text-destructive-foreground" },
};

const FeedbackBadge = ({ type, inWatchlist, size = "xs", className = "" }: FeedbackBadgeProps) => {
  // Show watchlist badge if no other feedback and item is in wishlist
  const effective = type ?? (inWatchlist ? "watchlist" : null);
  if (!effective) return null;
  const meta = META[effective];
  if (!meta) return null;
  const Icon = meta.icon;

  const sizeCls = size === "sm"
    ? "text-[11px] px-2 py-1 gap-1.5 [&>svg]:w-3.5 [&>svg]:h-3.5"
    : "text-[9px] px-1.5 py-0.5 gap-1 [&>svg]:w-3 [&>svg]:h-3";

  return (
    <div
      className={`inline-flex items-center rounded-full font-sans font-semibold backdrop-blur-md shadow-sm ${meta.color} ${sizeCls} ${className}`}
      title={meta.label}
    >
      <Icon />
      <span>{meta.label}</span>
    </div>
  );
};

export default FeedbackBadge;
