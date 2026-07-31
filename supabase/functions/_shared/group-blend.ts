/**
 * Fusion des profils de goût pour une soirée à plusieurs.
 *
 * Ce fichier ne contient que des fonctions pures : aucune API Deno, aucun accès
 * réseau ou base. C'est volontaire — il est importé à la fois par l'edge
 * function `group-taste-profile` et par les tests Vitest côté `src/test/`.
 *
 * Sémantique retenue, alignée sur ce que fait déjà le Duo :
 *  - vecteurs de goût  → moyenne des participants qui en ont un
 *  - genres aimés      → intersection, avec repli sur l'union si elle est vide
 *  - genres exclus     → union (un seul refus suffit à exclure)
 *  - plateformes       → intersection, avec repli sur l'union si elle est vide
 *  - note minimale     → maximum (le plus exigeant impose son seuil)
 *  - films déjà vus    → union (personne ne revoit ce qu'un autre a déjà vu)
 */

export const VECTOR_DIM = 32;

export interface MemberSignals {
  userId: string;
  stableVector: number[] | null;
  recentVector: number[] | null;
  avoidanceVector: number[] | null;
  topClusters: string[];
  rejectedClusters: string[];
  confidence: number;
  likedGenres: string[];
  excludedGenres: string[];
  platforms: number[];
  minRating: number;
  seenTmdbIds: number[];
}

export interface BlendedGroupProfile {
  memberCount: number;
  contributingVectorCount: number;
  stableTasteVector: number[] | null;
  recentTasteVector: number[] | null;
  avoidanceVector: number[] | null;
  topClusters: string[];
  rejectedClusters: string[];
  confidence: number;
  likedGenres: string[];
  excludedGenres: string[];
  sharedPlatforms: number[];
  minRating: number;
  excludeIds: number[];
}

/** Moyenne composante par composante. Ignore les vecteurs absents ou mal dimensionnés. */
export function averageVectors(vectors: (number[] | null | undefined)[]): number[] | null {
  const valid = vectors.filter(
    (v): v is number[] => Array.isArray(v) && v.length === VECTOR_DIM && v.every((n) => Number.isFinite(n)),
  );
  if (valid.length === 0) return null;

  const out = new Array<number>(VECTOR_DIM).fill(0);
  for (const v of valid) {
    for (let i = 0; i < VECTOR_DIM; i++) out[i] += v[i];
  }
  for (let i = 0; i < VECTOR_DIM; i++) out[i] /= valid.length;
  return out;
}

/** Union dédupliquée, ordre stable (première apparition). */
export function unionAll<T>(lists: (T[] | null | undefined)[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const list of lists ?? []) {
    for (const item of list ?? []) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
  }
  return out;
}

/**
 * Intersection des listes non vides. Si elle est vide — cas courant dès qu'un
 * participant a des goûts très différents — on retombe sur l'union plutôt que
 * de ne rien proposer du tout.
 */
export function intersectWithUnionFallback<T>(lists: (T[] | null | undefined)[]): {
  values: T[];
  usedFallback: boolean;
} {
  const nonEmpty = (lists ?? []).filter((l): l is T[] => Array.isArray(l) && l.length > 0);
  if (nonEmpty.length === 0) return { values: [], usedFallback: false };

  const [first, ...rest] = nonEmpty;
  const intersection = first.filter((item) => rest.every((l) => l.includes(item)));
  if (intersection.length > 0) return { values: [...new Set(intersection)], usedFallback: false };

  return { values: unionAll(nonEmpty), usedFallback: true };
}

/** Fusionne les signaux de tous les participants en un profil de groupe unique. */
export function blendGroupProfile(members: MemberSignals[]): BlendedGroupProfile {
  const list = members ?? [];

  const stable = averageVectors(list.map((m) => m.stableVector));
  const recent = averageVectors(list.map((m) => m.recentVector));
  const avoidance = averageVectors(list.map((m) => m.avoidanceVector));

  const liked = intersectWithUnionFallback(list.map((m) => m.likedGenres));
  const platforms = intersectWithUnionFallback(list.map((m) => m.platforms));

  // La confiance du groupe est celle du membre le moins bien profilé : on ne
  // peut pas être plus sûr du groupe que de son maillon le plus faible.
  const confidences = list.map((m) => m.confidence).filter((c) => Number.isFinite(c));
  const confidence = confidences.length > 0 ? Math.min(...confidences) : 50;

  const ratings = list.map((m) => m.minRating).filter((r) => Number.isFinite(r));
  const minRating = ratings.length > 0 ? Math.max(...ratings) : 0;

  return {
    memberCount: list.length,
    contributingVectorCount: list.filter((m) => Array.isArray(m.stableVector) && m.stableVector.length === VECTOR_DIM).length,
    stableTasteVector: stable,
    recentTasteVector: recent,
    avoidanceVector: avoidance,
    topClusters: intersectWithUnionFallback(list.map((m) => m.topClusters)).values,
    rejectedClusters: unionAll(list.map((m) => m.rejectedClusters)),
    confidence,
    likedGenres: liked.values,
    excludedGenres: unionAll(list.map((m) => m.excludedGenres)),
    sharedPlatforms: platforms.values,
    minRating,
    excludeIds: unionAll(list.map((m) => m.seenTmdbIds)),
  };
}
