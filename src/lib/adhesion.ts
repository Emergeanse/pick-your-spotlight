import { supabase } from "@/integrations/supabase/client";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import type { MovieDetail } from "@/lib/tmdb";
import type { RecommendationMatchData } from "@/lib/recommendation-batch";

/**
 * Adhésion d'un film au profil de l'utilisateur : pourcentage, accroche et
 * raisons, calculés par la fonction `movie-match` — le même calcul que la page
 * Match. Consomme un jeton de quota : à appeler quand on ouvre une fiche qui
 * en a besoin (un film conseillé par un ami), pas pour chaque carte affichée.
 *
 * Renvoie null en cas d'échec : l'adhésion n'est jamais bloquante.
 */
export async function evaluerAdhesion(userId: string, film: MovieDetail): Promise<RecommendationMatchData | null> {
  try {
    const [tasteProfile, liked, multiProfile] = await Promise.all([
      getUserTasteProfile(),
      getLikedMovies(),
      computeMultiVectorProfile(userId),
    ]);
    const { data } = await supabase.functions.invoke("movie-match", {
      body: {
        movie: film,
        tasteProfile,
        userTasteVector: multiProfile?.stableTasteVector ?? null,
        likedMovieTitles: liked.slice(0, 15).map((m: { title?: string }) => m.title).filter(Boolean),
        minMatchScore: 0,
      },
    });
    return (data as RecommendationMatchData) ?? null;
  } catch {
    return null;
  }
}

/** Au format attendu par la fiche (FlipCardDetail.recommendationTexts). */
export function versTextesFiche(m: RecommendationMatchData) {
  const brut = m as RecommendationMatchData & { score?: number };
  return {
    confidence: brut.matchScore ?? brut.score ?? undefined,
    headline: m.headline ?? undefined,
    whyItMatches: m.whyItMatches ?? undefined,
    detailedExplanation: m.detailedExplanation ?? undefined,
    emotionalJourney: m.emotionalJourney ?? undefined,
    perfectFor: m.perfectFor ?? undefined,
    funFact: m.funFact ?? undefined,
    matchingReasons: m.matchingReasons ?? undefined,
  };
}
