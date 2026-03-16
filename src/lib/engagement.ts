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
}

/**
 * Get the current engagement data for a user.
 */
export async function getEngagementData(userId: string): Promise<EngagementData | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("streak_count, best_streak, total_recommendations, accepted_recommendations, profile_confidence, first_use_date, ritual_time, ritual_enabled")
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
  };
}

/**
 * Record that a recommendation was accepted (user watched/liked/started companion).
 * Updates streak and acceptance rate.
 */
export async function recordAcceptedRecommendation(userId: string): Promise<void> {
  const engagement = await getEngagementData(userId);
  if (!engagement) return;

  const today = new Date().toISOString().split("T")[0];
  const lastDate = engagement.streakCount > 0 ? undefined : undefined; // we update based on current state

  const newTotal = engagement.totalRecommendations + 1;
  const newAccepted = engagement.acceptedRecommendations + 1;
  const newStreak = engagement.streakCount + 1;
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
 */
export async function recordSkippedRecommendation(userId: string): Promise<void> {
  const engagement = await getEngagementData(userId);
  if (!engagement) return;

  const today = new Date().toISOString().split("T")[0];
  const newTotal = engagement.totalRecommendations + 1;
  const newConfidence = calculateConfidence(engagement.acceptedRecommendations, newTotal, 0);

  await supabase.from("profiles").update({
    total_recommendations: newTotal,
    streak_count: 0, // Reset streak on skip
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
 */
function calculateConfidence(accepted: number, total: number, streak: number): number {
  if (total === 0) return 0;
  
  // Base: acceptance rate (max 60 points)
  const acceptanceRate = accepted / total;
  const baseScore = Math.min(acceptanceRate * 60, 60);
  
  // Volume bonus (max 20 points) — more interactions = more data
  const volumeBonus = Math.min(total * 2, 20);
  
  // Streak bonus (max 20 points) — consecutive hits mean we're dialed in
  const streakBonus = Math.min(streak * 4, 20);
  
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
