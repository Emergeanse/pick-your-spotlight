import type { LucideIcon } from "lucide-react";
import {
  Award,
  Clapperboard,
  Crown,
  Film,
  Heart,
  Library,
  Medal,
  MonitorPlay,
  Popcorn,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Tv,
  Video,
} from "lucide-react";

export type TrophyCategoryKey = "recos" | "liked" | "people" | "seen";

export type TrophyMilestone = {
  count: number;
  label: string;
  /** Kept for copy / progressive enhancement; UI prefers Lucide. */
  emoji: string;
  Icon: LucideIcon;
};

export type TrophyCategory = {
  key: TrophyCategoryKey;
  label: string;
  /** Accent used for unlocked medal glow / ring */
  accent: string;
  accentRgb: string;
  milestones: TrophyMilestone[];
};

export type TrophyMilestoneMeta = TrophyMilestone & {
  categoryKey: TrophyCategoryKey;
  categoryLabel: string;
  accent: string;
  accentRgb: string;
};

/** 4 catégories × 7 paliers = 28 trophées */
export const TROPHY_CATEGORIES: TrophyCategory[] = [
  {
    key: "recos",
    label: "Recommandations reçues",
    accent: "rgb(167, 139, 250)",
    accentRgb: "167, 139, 250",
    milestones: [
      { count: 1, label: "Premier pick", emoji: "🎬", Icon: Clapperboard },
      { count: 10, label: "Habitué", emoji: "🎞️", Icon: Film },
      { count: 50, label: "Explorateur", emoji: "🎟️", Icon: Ticket },
      { count: 100, label: "Connaisseur", emoji: "📽️", Icon: Video },
      { count: 250, label: "Cinéphile", emoji: "🎦", Icon: MonitorPlay },
      { count: 500, label: "Critique d'art", emoji: "🏆", Icon: Trophy },
      { count: 1000, label: "Maître absolu", emoji: "👑", Icon: Crown },
    ],
  },
  {
    key: "liked",
    label: "Films & séries likés",
    accent: "rgb(244, 114, 182)",
    accentRgb: "244, 114, 182",
    milestones: [
      { count: 3, label: "Coup de cœur", emoji: "🍿", Icon: Popcorn },
      { count: 10, label: "Passionné", emoji: "🎟️", Icon: Heart },
      { count: 25, label: "Critique", emoji: "🎭", Icon: Award },
      { count: 50, label: "Collectionneur", emoji: "📽️", Icon: Library },
      { count: 100, label: "Oracle du goût", emoji: "🌟", Icon: Sparkles },
      { count: 200, label: "Légende", emoji: "🏆", Icon: Trophy },
      { count: 500, label: "Panthéon", emoji: "👑", Icon: Crown },
    ],
  },
  {
    key: "people",
    label: "Acteurs & réalisateurs",
    accent: "rgb(251, 191, 36)",
    accentRgb: "251, 191, 36",
    milestones: [
      { count: 1, label: "Premier favori", emoji: "🎭", Icon: Star },
      { count: 5, label: "Fan", emoji: "🎬", Icon: Clapperboard },
      { count: 15, label: "Fin connaisseur", emoji: "🎥", Icon: Video },
      { count: 30, label: "Expert casting", emoji: "🎞️", Icon: Film },
      { count: 50, label: "Talent scouter", emoji: "🌟", Icon: Sparkles },
      { count: 100, label: "Maître des talents", emoji: "🏆", Icon: Medal },
      { count: 200, label: "Légende du 7e art", emoji: "👑", Icon: Crown },
    ],
  },
  {
    key: "seen",
    label: "Films lancés via Pick",
    accent: "rgb(103, 232, 249)",
    accentRgb: "103, 232, 249",
    milestones: [
      { count: 1, label: "1er visionnage", emoji: "📺", Icon: Tv },
      { count: 5, label: "Soirée ciné", emoji: "🎞️", Icon: Film },
      { count: 15, label: "Ciné-club", emoji: "🍿", Icon: Popcorn },
      { count: 30, label: "Cinémathèque", emoji: "🎦", Icon: MonitorPlay },
      { count: 75, label: "Vidéothèque", emoji: "📼", Icon: Library },
      { count: 150, label: "Archives Pick", emoji: "🏛️", Icon: Award },
      { count: 300, label: "Grand écran", emoji: "👑", Icon: Crown },
    ],
  },
];

export const TROPHY_TIER_LEVELS = [
  { minUnlocked: 0, title: "Curieux", subtitle: "Chaque trophée raconte une histoire" },
  { minUnlocked: 5, title: "Explorateur", subtitle: "Pick découvre ton profil" },
  { minUnlocked: 10, title: "Passionné", subtitle: "Ta collection prend forme" },
  { minUnlocked: 15, title: "Habitué", subtitle: "Tu maîtrises les codes du 7e art" },
  { minUnlocked: 20, title: "Écureuil cinéphile", subtitle: "Un écureuil qui sait ce qu'il aime" },
  { minUnlocked: 24, title: "Connaisseur", subtitle: "Plus que quelques trophées" },
  { minUnlocked: 28, title: "Légende Pick", subtitle: "Collection complète — bravo !" },
] as const;

export function flattenTrophyMilestones(): TrophyMilestoneMeta[] {
  return TROPHY_CATEGORIES.flatMap((cat) =>
    cat.milestones.map((m) => ({
      ...m,
      categoryKey: cat.key,
      categoryLabel: cat.label,
      accent: cat.accent,
      accentRgb: cat.accentRgb,
    }))
  );
}

export function getTrophyTier(unlocked: number): { title: string; subtitle: string } {
  let tier: (typeof TROPHY_TIER_LEVELS)[number] = TROPHY_TIER_LEVELS[0];
  for (const t of TROPHY_TIER_LEVELS) {
    if (unlocked >= t.minUnlocked) tier = t;
  }
  return { title: tier.title, subtitle: tier.subtitle };
}

export function getNextTrophyHint(
  values: Record<string, number>
): { milestone: TrophyMilestoneMeta; remaining: number } | null {
  let best: { milestone: TrophyMilestoneMeta; remaining: number } | null = null;
  for (const cat of TROPHY_CATEGORIES) {
    const value = values[cat.key] ?? 0;
    const next = cat.milestones.find((m) => value < m.count);
    if (!next) continue;
    const remaining = next.count - value;
    const milestone: TrophyMilestoneMeta = {
      ...next,
      categoryKey: cat.key,
      categoryLabel: cat.label,
      accent: cat.accent,
      accentRgb: cat.accentRgb,
    };
    if (!best || remaining < best.remaining) best = { milestone, remaining };
  }
  return best;
}
