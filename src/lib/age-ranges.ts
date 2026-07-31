/**
 * Tranches d'âge — référence unique côté application.
 *
 * Sert à trois usages qui partagent la même échelle :
 *  - l'âge déclaré par un invité sans compte quand il rejoint une soirée ;
 *  - l'âge d'un compte (utile plus tard pour des comptes ado) ;
 *  - la contrainte de contenu d'un groupe, qui est celle de son plus jeune
 *    participant.
 *
 * L'ordre du tableau est signifiant : du plus restrictif au moins restrictif.
 * `supabase/functions/_shared/age.ts` en garde une copie pour l'edge function ;
 * `src/test/age-ranges.test.ts` vérifie que les deux ne divergent pas.
 */

export const AGE_RANGES = ["enfant", "pre_ado", "ado", "adulte"] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  enfant: "Moins de 10 ans",
  pre_ado: "10 à 12 ans",
  ado: "13 à 17 ans",
  adulte: "18 ans et plus",
};

/** Libellé court pour les puces et récapitulatifs. */
export const AGE_RANGE_SHORT: Record<AgeRange, string> = {
  enfant: "− 10 ans",
  pre_ado: "10-12",
  ado: "13-17",
  adulte: "18 +",
};

/**
 * Certification française maximale acceptable pour chaque tranche.
 * `null` signifie « aucune restriction ».
 */
export const MAX_CERTIFICATION: Record<AgeRange, string | null> = {
  enfant: "TP",
  pre_ado: "12",
  ado: "16",
  adulte: null,
};

export function isAgeRange(value: unknown): value is AgeRange {
  return typeof value === "string" && (AGE_RANGES as readonly string[]).includes(value);
}

/**
 * Tranche la plus restrictive d'un groupe — celle qui contraint le contenu.
 * Les valeurs inconnues ou absentes sont ignorées plutôt que de fausser le
 * calcul. Renvoie `null` si personne n'a déclaré d'âge.
 */
export function strictestAgeRange(values: (string | null | undefined)[]): AgeRange | null {
  const known = (values ?? []).filter(isAgeRange);
  if (known.length === 0) return null;
  return known.reduce((strictest, current) =>
    AGE_RANGES.indexOf(current) < AGE_RANGES.indexOf(strictest) ? current : strictest,
  );
}
