/**
 * Hook Model engagement engine for Pick.
 * Tracks streaks, profile confidence, and generates progression messages.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EngagementData {
  streakCount: number;
  bestStreak: number;
  totalRecommendations: number;
  acceptedRecommendations: number;
  profileConfidence: number;
  firstUseDate: string | null;
  ritualTime: string | null;
  ritualEnabled: boolean;
  lastRecommendationDate: string | null;
}

/**
 * Get the current engagement data for a user.
 */
export async function getEngagementData(userId: string): Promise<EngagementData | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("streak_count, best_streak, total_recommendations, accepted_recommendations, profile_confidence, first_use_date, ritual_time, ritual_enabled, last_recommendation_date")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  const d = data as any;
  return {
    streakCount: d.streak_count || 0,
    bestStreak: d.best_streak || 0,
    totalRecommendations: d.total_recommendations || 0,
    acceptedRecommendations: d.accepted_recommendations || 0,
    profileConfidence: d.profile_confidence || 0,
    firstUseDate: d.first_use_date || null,
    ritualTime: d.ritual_time || null,
    ritualEnabled: d.ritual_enabled || false,
    lastRecommendationDate: d.last_recommendation_date || null,
  };
}

/**
 * Check if the streak should continue or be reset based on time since last activity.
 * Streak resets only if more than 48h have passed since last recommendation.
 */
function shouldResetStreak(lastDate: string | null): boolean {
  if (!lastDate) return false;
  const hoursSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60);
  return hoursSince > 48;
}

/**
 * Record that a recommendation was accepted (user watched/liked/started companion).
 * Updates streak and acceptance rate.
 */
export async function recordAcceptedRecommendation(userId: string, incrementTotal = true): Promise<void> {
  const engagement = await getEngagementData(userId);
  if (!engagement) return;

  const today = new Date().toISOString().split("T")[0];

  // Reset streak if user has been inactive for 48h+
  const currentStreak = shouldResetStreak(engagement.lastRecommendationDate) ? 0 : engagement.streakCount;

  // incrementTotal=false quand appelé depuis le flow principal (le skip incrémente déjà total)
  const newTotal = incrementTotal ? engagement.totalRecommendations + 1 : engagement.totalRecommendations;
  const newAccepted = engagement.acceptedRecommendations + 1;
  const newStreak = currentStreak + 1;
  const newBestStreak = Math.max(engagement.bestStreak, newStreak);
  const newConfidence = calculateConfidence(newAccepted, newTotal, newStreak);

  await supabase.from("profiles").update({
    total_recommendations: newTotal,
    accepted_recommendations: newAccepted,
    streak_count: newStreak,
    best_streak: newBestStreak,
    profile_confidence: newConfidence,
    last_recommendation_date: today,
    first_use_date: engagement.firstUseDate || today,
  } as any).eq("id", userId);
}

/**
 * Record that a recommendation was skipped/rejected.
 * Does NOT reset the streak — only inactivity resets it.
 */
export async function recordSkippedRecommendation(userId: string): Promise<void> {
  const engagement = await getEngagementData(userId);
  if (!engagement) return;

  const today = new Date().toISOString().split("T")[0];

  // Reset streak only on inactivity, not on skip
  const currentStreak = shouldResetStreak(engagement.lastRecommendationDate) ? 0 : engagement.streakCount;

  const newTotal = engagement.totalRecommendations + 1;
  const newConfidence = calculateConfidence(engagement.acceptedRecommendations, newTotal, currentStreak);

  await supabase.from("profiles").update({
    total_recommendations: newTotal,
    streak_count: currentStreak,
    profile_confidence: newConfidence,
    last_recommendation_date: today,
    first_use_date: engagement.firstUseDate || today,
  } as any).eq("id", userId);
}

/**
 * Save ritual preferences.
 */
export async function saveRitualPreferences(userId: string, time: string | null, enabled: boolean): Promise<void> {
  await supabase.from("profiles").update({
    ritual_time: time,
    ritual_enabled: enabled,
  } as any).eq("id", userId);
}

/**
 * Calculate profile confidence percentage (0-100).
 * Based on acceptance rate, volume, and streak.
 */
function calculateConfidence(accepted: number, total: number, streak: number): number {
  if (total === 0) return 0;
  
  // Base: acceptance rate (max 50 points)
  const acceptanceRate = accepted / total;
  const baseScore = Math.min(acceptanceRate * 50, 50);
  
  // Volume bonus (max 30 points) — more interactions = more data, with diminishing returns
  const volumeBonus = Math.min(Math.sqrt(total) * 5, 30);
  
  // Streak bonus (max 20 points) — consecutive hits mean we're dialed in
  const streakBonus = Math.min(streak * 3, 20);
  
  return Math.round(baseScore + volumeBonus + streakBonus);
}

/**
 * Get a contextual progression message based on engagement data.
 */
export function getProgressionMessage(engagement: EngagementData): string | null {
  const { streakCount, bestStreak, totalRecommendations, profileConfidence, firstUseDate } = engagement;

  // New user
  if (totalRecommendations === 0) {
    return null;
  }

  // Streak milestones
  if (streakCount === 3) return "🔥 3 recos validées d'affilée ! Pick commence à te cerner.";
  if (streakCount === 5) return "🎯 5 en série ! Pick est en mode sniper.";
  if (streakCount === 10) return "🏆 10 d'affilée ! Pick lit dans tes pensées.";
  if (streakCount > 10 && streakCount % 5 === 0) return `🔥 ${streakCount} en série ! Record battu !`;

  // Confidence milestones
  if (profileConfidence >= 80 && totalRecommendations >= 10) {
    return "🧠 Pick te connaît à 80%+ — tes goûts n'ont plus de secrets.";
  }
  if (profileConfidence >= 50 && totalRecommendations >= 5) {
    return `📈 Confiance à ${profileConfidence}% — Pick s'améliore à chaque film.`;
  }

  // Volume milestones
  if (totalRecommendations === 5) return "🎬 5 films découverts ensemble ! L'aventure commence.";
  if (totalRecommendations === 20) return "🍿 20 films ! Pick a bien mémorisé tes goûts.";
  if (totalRecommendations === 50) return "🎪 50 films ! Tu es un cinéphile accompli.";

  // Days since first use
  if (firstUseDate) {
    const daysSince = Math.floor((Date.now() - new Date(firstUseDate).getTime()) / 86400000);
    if (daysSince === 7 && totalRecommendations >= 3) {
      return "📅 1 semaine avec Pick ! Ton profil s'affine de jour en jour.";
    }
    if (daysSince === 30 && totalRecommendations >= 10) {
      return "🗓️ 1 mois ensemble ! Pick te connaît maintenant bien mieux qu'au début.";
    }
  }

  // Default periodic message
  if (totalRecommendations > 3 && totalRecommendations % 7 === 0) {
    return `📊 ${totalRecommendations} recommandations — ton profil est de plus en plus précis.`;
  }

  return null;
}

/**
 * Get a streak display label.
 */
export function getStreakLabel(streak: number): string {
  if (streak === 0) return "";
  if (streak < 3) return `${streak} ✓`;
  if (streak < 5) return `${streak} 🔥`;
  if (streak < 10) return `${streak} 🎯`;
  return `${streak} 🏆`;
}
