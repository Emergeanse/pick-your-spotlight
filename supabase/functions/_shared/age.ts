/**
 * Tranches d'âge — copie serveur.
 *
 * La référence est `src/lib/age-ranges.ts`. Cette copie existe parce qu'une
 * edge function Deno ne peut pas importer depuis le bundle client, et qu'on ne
 * veut pas non plus faire entrer du code d'edge function dans le build Vite.
 *
 * `src/test/age-ranges.test.ts` compare les deux listes : toute divergence
 * fait échouer les tests.
 */

export const AGE_RANGES = ["enfant", "pre_ado", "ado", "adulte"] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

/** Certification française maximale acceptable. `null` = aucune restriction. */
export const MAX_CERTIFICATION: Record<AgeRange, string | null> = {
  enfant: "TP",
  pre_ado: "12",
  ado: "16",
  adulte: null,
};

export function isAgeRange(value: unknown): value is AgeRange {
  return typeof value === "string" && (AGE_RANGES as readonly string[]).includes(value);
}

/** Tranche la plus restrictive du groupe — celle qui contraint le contenu. */
export function strictestAgeRange(values: (string | null | undefined)[]): AgeRange | null {
  const known = (values ?? []).filter(isAgeRange);
  if (known.length === 0) return null;
  return known.reduce((strictest, current) =>
    AGE_RANGES.indexOf(current) < AGE_RANGES.indexOf(strictest) ? current : strictest,
  );
}
