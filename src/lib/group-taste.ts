/**
 * Profil de goût fusionné d'une soirée à plusieurs (côté client).
 *
 * La fusion elle-même se fait dans l'edge function `group-taste-profile` :
 * la RLS interdit de lire les vecteurs de goût des autres participants depuis
 * le navigateur, et on ne veut pas l'ouvrir — seuls des agrégats redescendent.
 *
 * Ce module ne fait qu'appeler la fonction et adapter sa réponse au format
 * d'overrides déjà utilisé par le Duo, pour que le pipeline de recommandation
 * n'ait pas à changer.
 */
import { supabase } from "@/integrations/supabase/client";

export interface GroupTasteProfile {
  eventId: string;
  context: string | null;
  memberCount: number;
  guestCount: number;
  contributingVectorCount: number;
  userTasteVector: number[] | null;
  recentTasteVector: number[] | null;
  avoidanceVector: number[] | null;
  tasteProfileOverrides: {
    topGenres: string[];
    tasteClusters: string[];
    rejectedClusters: string[];
    excludeIds: number[];
    confidence: { score: number };
  };
  constraints: {
    sharedPlatforms: number[];
    excludedGenres: string[];
    minRating: number;
  };
}

/** Forme attendue par `generateTonightPick` (identique à celle du Duo). */
export interface GroupOverrides {
  topGenres: string[];
  excludedGenres: string[];
  tasteVector: number[] | null;
  avoidanceVector: number[] | null;
  topClusters: string[];
  rejectedClusters: string[];
  partnerExcludeIds: number[];
  user1Name: string | null;
  user2Name: string | null;
  user1Id?: string;
  user2Id?: string;
}

/**
 * Récupère le profil fusionné d'une soirée.
 *
 * Renvoie `null` en cas d'échec (fonction non déployée, accès refusé, réseau) :
 * l'appelant doit alors retomber sur le comportement solo. Une soirée qui
 * recommande sur le profil de l'organisateur reste préférable à une soirée qui
 * ne recommande rien.
 */
export async function fetchGroupTasteProfile(eventId: string): Promise<GroupTasteProfile | null> {
  if (!eventId) return null;
  try {
    const { data, error } = await supabase.functions.invoke("group-taste-profile", {
      body: { eventId },
    });
    if (error) {
      console.warn("[GROUP] profil fusionné indisponible :", error.message);
      return null;
    }
    if (!data || typeof data !== "object" || (data as any).error) {
      console.warn("[GROUP] réponse inattendue :", (data as any)?.error ?? data);
      return null;
    }
    const profile = data as GroupTasteProfile;
    console.log(
      `[GROUP] profil fusionné — ${profile.memberCount} membre(s) dont ${profile.contributingVectorCount} avec vecteur, ` +
        `${profile.guestCount} invité(s) | ${profile.tasteProfileOverrides?.excludeIds?.length ?? 0} exclusions | ` +
        `note mini ${profile.constraints?.minRating}`,
    );
    return profile;
  } catch (e) {
    console.warn("[GROUP] appel group-taste-profile échoué :", e);
    return null;
  }
}

/**
 * Un profil de groupe n'a d'intérêt que s'il agrège plusieurs personnes.
 * À un seul membre, le pipeline solo habituel est déjà le bon outil — et il
 * dispose de signaux que la fusion ne transporte pas (historique de session).
 */
export function isUsableGroupProfile(profile: GroupTasteProfile | null): profile is GroupTasteProfile {
  return !!profile && profile.memberCount > 1;
}

/** Adapte le profil fusionné au format d'overrides du pipeline. */
export function toGroupOverrides(profile: GroupTasteProfile): GroupOverrides {
  return {
    topGenres: profile.tasteProfileOverrides?.topGenres ?? [],
    excludedGenres: profile.constraints?.excludedGenres ?? [],
    tasteVector: profile.userTasteVector ?? null,
    avoidanceVector: profile.avoidanceVector ?? null,
    topClusters: profile.tasteProfileOverrides?.tasteClusters ?? [],
    rejectedClusters: profile.tasteProfileOverrides?.rejectedClusters ?? [],
    partnerExcludeIds: profile.tasteProfileOverrides?.excludeIds ?? [],
    // Champs d'affichage propres au Duo : un groupe n'a pas deux noms à montrer.
    user1Name: null,
    user2Name: null,
  };
}

/**
 * Fusionne les agrégats du groupe dans le corps d'appel à
 * `surprise-personalized`, en conservant tout ce que l'appelant a déjà posé.
 */
export function applyGroupToRequestBody<T extends Record<string, any>>(
  body: T,
  profile: GroupTasteProfile,
): T {
  const overrides = profile.tasteProfileOverrides ?? ({} as GroupTasteProfile["tasteProfileOverrides"]);
  const baseTaste = (body.tasteProfile ?? {}) as Record<string, any>;

  return {
    ...body,
    userTasteVector: profile.userTasteVector ?? body.userTasteVector ?? null,
    recentTasteVector: profile.recentTasteVector ?? body.recentTasteVector ?? null,
    avoidanceVector: profile.avoidanceVector ?? body.avoidanceVector ?? null,
    tasteProfile: {
      ...baseTaste,
      topGenres: overrides.topGenres ?? baseTaste.topGenres ?? [],
      tasteClusters: overrides.tasteClusters ?? baseTaste.tasteClusters ?? [],
      rejectedClusters: overrides.rejectedClusters ?? baseTaste.rejectedClusters ?? [],
      // Union : les exclusions du groupe s'ajoutent à celles déjà calculées.
      excludeIds: [
        ...new Set([...(baseTaste.excludeIds ?? []), ...(overrides.excludeIds ?? [])].map(Number).filter(Number.isFinite)),
      ],
      confidence: overrides.confidence ?? baseTaste.confidence,
    },
    minMatchScore: body.minMatchScore,
  };
}
