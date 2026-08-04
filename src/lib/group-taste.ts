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

export interface GroupGuest {
  name: string;
  ageRange: string | null;
  genres: string[];
}

export interface GroupTasteProfile {
  eventId: string;
  context: string | null;
  memberCount: number;
  guestCount: number;
  participantCount: number;
  contributingVectorCount: number;
  /** Tranche du plus jeune participant — contraint le contenu de la soirée. */
  youngestAgeRange: string | null;
  /** Certification française maximale acceptable. `null` = aucune limite. */
  maxCertification: string | null;
  /** Plafond 0-4 exploitable par le filtre. `null` = aucune contrainte. */
  maxCertificationLevel: number | null;
  maxCertificationLabel: string | null;
  guests: GroupGuest[];
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
  /** Plafond d'âge du groupe, transmis tel quel au moteur. */
  maxCertificationLevel?: number | null;
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
        `note mini ${profile.constraints?.minRating} | âge ${profile.youngestAgeRange ?? "non déclaré"}` +
        (profile.maxCertification ? ` → certif max ${profile.maxCertification}` : ""),
    );
    return profile;
  } catch (e) {
    console.warn("[GROUP] appel group-taste-profile échoué :", e);
    return null;
  }
}

/**
 * Profil fusionné pour une séance de groupe improvisée, sans soirée planifiée.
 *
 * `group-taste-profile` exige un `eventId` : c'est ce qui lui permet de
 * vérifier que l'appelant fait bien partie du groupe avant de lire les profils
 * des autres. Sans ce garde-fou, n'importe qui pourrait demander la fusion de
 * n'importe quels utilisateurs.
 *
 * Pour une séance lancée dans l'instant, on crée donc une soirée technique le
 * temps de l'appel, puis on la supprime. Elle naît avec le statut `done`, que
 * les deux listages de soirées écartent déjà — si une suppression échouait,
 * elle n'apparaîtrait nulle part.
 */
export async function fetchAdHocGroupProfile(
  participantIds: string[],
  context: "famille" | "amis",
): Promise<GroupTasteProfile | null> {
  const ids = [...new Set((participantIds ?? []).filter(Boolean))];
  if (ids.length === 0) return null;

  let eventId: string | null = null;
  try {
    const { data: user } = await supabase.auth.getUser();
    const organizerId = user?.user?.id;
    if (!organizerId) return null;

    const { data: event, error: createError } = await supabase
      .from("events")
      .insert({
        organizer_id: organizerId,
        title: "Séance improvisée",
        event_date: new Date().toISOString().slice(0, 10),
        context,
        status: "done",
        media_type: "both",
      } as any)
      .select("id")
      .single();

    if (createError || !event) {
      console.warn("[GROUP] séance technique non créée :", createError?.message);
      return null;
    }
    eventId = (event as any).id;

    const others = ids.filter((id) => id !== organizerId);
    if (others.length > 0) {
      await supabase.from("event_participants" as any).insert(
        others.map((id) => ({ event_id: eventId, user_id: id, status: "confirmed" })),
      );
    }

    return await fetchGroupTasteProfile(eventId!);
  } catch (e) {
    console.warn("[GROUP] profil improvisé indisponible :", e);
    return null;
  } finally {
    // La soirée technique n'a plus de raison d'exister une fois le profil lu.
    if (eventId) {
      await supabase.from("events").delete().eq("id", eventId).then(
        undefined,
        (e) => console.warn("[GROUP] séance technique non supprimée :", e),
      );
    }
  }
}

/**
 * Un profil de groupe n'a d'intérêt que s'il agrège plusieurs personnes.
 * À un seul participant, le pipeline solo habituel est déjà le bon outil — et
 * il dispose de signaux que la fusion ne transporte pas (historique de
 * session). Un invité sans compte compte comme un participant : ses genres et
 * son âge changent la recommandation.
 */
export function isUsableGroupProfile(profile: GroupTasteProfile | null): profile is GroupTasteProfile {
  if (!profile) return false;
  const total = profile.participantCount ?? profile.memberCount + (profile.guestCount ?? 0);
  return total > 1;
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
    maxCertificationLevel: profile.maxCertificationLevel ?? null,
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
    // Filtré en amont par la requête SQL des candidats : un titre au-dessus du
    // plafond n'est jamais remonté, plutôt qu'écarté après coup.
    maxCertificationLevel: profile.maxCertificationLevel ?? null,
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
