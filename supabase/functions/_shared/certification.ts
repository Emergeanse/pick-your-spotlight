/**
 * Certification d'âge — normalisation et filtre.
 *
 * Fonctions pures, sans API Deno : importées par les edge functions et
 * directement par les tests Vitest.
 *
 * Pourquoi combiner France et États-Unis :
 *  - la certification française est culturellement permissive. « Il faut
 *    sauver le soldat Ryan », « Matrix » et « Whiplash » sont tous « tous
 *    publics » en France, et classés R aux États-Unis. C'est exact, mais
 *    inutilisable pour protéger un enfant de 7 ans.
 *  - la certification américaine est plus stricte et mieux renseignée
 *    (83 % du catalogue contre 75 %).
 *
 * On retient donc la plus restrictive des deux. Mesuré sur dix films de
 * référence, cette règle classe correctement aussi bien les films familiaux
 * que les films adultes.
 */

/** Échelle interne, du plus permissif au plus restrictif. */
export const CERT_LEVELS = [0, 1, 2, 3, 4] as const;
export type CertLevel = (typeof CERT_LEVELS)[number];

export const CERT_LEVEL_LABELS: Record<CertLevel, string> = {
  0: "Tous publics",
  1: "Accompagnement conseillé",
  2: "Déconseillé aux moins de 12 ans",
  3: "Déconseillé aux moins de 16 ans",
  4: "Réservé aux adultes",
};

// TMDB déclare TP/12/16/18 pour la France, mais la base contient aussi « U »
// (hérité du barème britannique) et des variantes avec tiret.
const FR_MAP: Record<string, CertLevel> = {
  "TP": 0, "U": 0, "TOUS PUBLICS": 0,
  "10": 1, "-10": 1,
  "12": 2, "-12": 2,
  "16": 3, "-16": 3,
  "18": 4, "-18": 4,
};

const US_MAP: Record<string, CertLevel> = {
  "G": 0,
  "PG": 1,
  "PG-13": 2, "PG13": 2,
  "R": 3,
  "NC-17": 4, "NC17": 4, "X": 4,
  // Barème télévisé américain, renvoyé par /tv/{id}/content_ratings
  "TV-Y": 0, "TV-Y7": 0, "TV-G": 0,
  "TV-PG": 1,
  "TV-14": 2,
  "TV-MA": 4,
};

const clean = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  if (!v || v === "NR" || v === "UNRATED" || v === "NOT RATED") return null;
  return v;
};

export function frToLevel(raw: unknown): CertLevel | null {
  const v = clean(raw);
  return v != null && v in FR_MAP ? FR_MAP[v] : null;
}

export function usToLevel(raw: unknown): CertLevel | null {
  const v = clean(raw);
  return v != null && v in US_MAP ? US_MAP[v] : null;
}

export interface CertificationVerdict {
  level: CertLevel | null;
  /** D'où vient le niveau retenu — utile pour diagnostiquer les surprises. */
  source: "fr" | "us" | "fr+us" | null;
}

/** Retient la plus restrictive des certifications disponibles. */
export function resolveCertification(frRaw: unknown, usRaw: unknown): CertificationVerdict {
  const fr = frToLevel(frRaw);
  const us = usToLevel(usRaw);

  if (fr == null && us == null) return { level: null, source: null };
  if (fr == null) return { level: us, source: "us" };
  if (us == null) return { level: fr, source: "fr" };

  const level = Math.max(fr, us) as CertLevel;
  return { level, source: fr === us ? "fr+us" : fr > us ? "fr" : "us" };
}

/**
 * Niveau maximal tolérable pour la tranche d'âge la plus jeune du groupe.
 *
 * « enfant » accepte le niveau 1 et pas seulement 0 : un visionnage en famille
 * suppose un adulte présent, et beaucoup de films d'animation destinés aux
 * enfants — Zootopie, Le Voyage de Chihiro — sont classés PG aux États-Unis.
 * S'arrêter à 0 les exclurait tous.
 */
export function maxLevelForAgeRange(ageRange: string | null | undefined): CertLevel | null {
  switch (ageRange) {
    case "enfant": return 1;
    case "pre_ado": return 2;
    case "ado": return 3;
    case "adulte": return 4;
    default: return null; // aucun âge déclaré : pas de contrainte
  }
}

/**
 * Un titre est-il acceptable pour ce niveau maximal ?
 *
 * Règle volontairement prudente : un titre sans certification connue est
 * REFUSÉ dès qu'une contrainte existe. Le silence n'est pas une autorisation —
 * 10 % du catalogue n'a aucune certification, et rien ne dit que ces films
 * sont inoffensifs. Sans contrainte (`maxLevel` nul), tout passe.
 */
export function isAllowed(level: CertLevel | null, maxLevel: CertLevel | null): boolean {
  if (maxLevel == null) return true;
  if (maxLevel >= 4) return true; // adultes : aucune restriction, inconnu compris
  if (level == null) return false;
  return level <= maxLevel;
}
