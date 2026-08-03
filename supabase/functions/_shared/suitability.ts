/**
 * Normalisation des `suitability_tags`.
 *
 * L'IA d'indexation a longtemps écrit ce champ en texte libre : le catalogue
 * contient 320 valeurs distinctes pour sept notions. Le top 25 couvre 99 % du
 * volume, le reste est une longue traîne d'inventions ponctuelles — fautes de
 * frappe (« adolecents »), anglais et espagnol (« friends », « amigos »,
 * « pareja »), compositions (« famille_pere_fils_ados »), et même des
 * catégories qui n'en sont pas (« goûter_en_famille », « premieres_seances »).
 *
 * `generate-embedding` impose désormais un vocabulaire fermé, mais l'existant
 * doit être rattrapé. Fonctions pures, testées côté Vitest.
 *
 * Ce champ reste un signal SECONDAIRE : il sert à privilégier un titre
 * explicitement marqué « famille », jamais à affirmer qu'un titre est sans
 * danger. Le filtre d'âge s'appuie sur la certification, pas sur ces étiquettes.
 */

export const SUITABILITY = ["solo", "couple", "amis", "famille", "enfants", "adolescents", "adultes"] as const;
export type Suitability = (typeof SUITABILITY)[number];

/** Minuscules, sans accent, séparateurs unifiés, parenthèses écartées. */
export function foldToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Correspondances exactes, appliquées avant les heuristiques. Couvre les
// valeurs les plus fréquentes et les langues étrangères.
const EXACT: Record<string, Suitability[]> = {
  "solo": ["solo"],
  "seul": ["solo"],
  "couple": ["couple"],
  "pareja": ["couple"],
  "conjoint": ["couple"],
  "date night": ["couple"],
  "amis": ["amis"],
  "friends": ["amis"],
  "amigos": ["amis"],
  "group": ["amis"],
  "groupe": ["amis"],
  "famille": ["famille"],
  "family": ["famille"],
  "jeune public": ["famille", "enfants"],
  "enfants": ["famille", "enfants"],
  "enfant": ["famille", "enfants"],
  "kids": ["famille", "enfants"],
  "jeunes enfants": ["famille", "enfants"],
  "adolescents": ["adolescents"],
  "adolecents": ["adolescents"], // faute présente en base
  "ados": ["adolescents"],
  "teens": ["adolescents"],
  "adultes": ["adultes"],
  "adults": ["adultes"],
  "adult": ["adultes"],
  "mature": ["adultes"],
  "mature audience": ["adultes"],
  "jeunes adultes": ["adultes"],
};

/**
 * Une valeur libre peut porter plusieurs notions à la fois :
 * « famille_adolescents » vaut famille ET adolescents.
 */
export function normalizeSuitabilityTag(raw: unknown): Suitability[] {
  const t = foldToken(raw);
  if (!t) return [];

  if (t in EXACT) return EXACT[t];

  const out = new Set<Suitability>();

  // Heuristiques par mot-clé pour la longue traîne.
  if (/\benfants?\b|\bkids?\b|jeunes enfants|jeune public/.test(t)) {
    out.add("famille");
    out.add("enfants");
  }
  if (/\bfamill\w*/.test(t) || /\bfamily\b/.test(t)) out.add("famille");
  if (/\bados?\b|\badolesc\w*|\badolec\w*|\bteens?\b|plus de 1[3-7] ans/.test(t)) out.add("adolescents");
  if (/\badultes?\b|\badults?\b|\bmature\b|personnes agees|retraites/.test(t)) out.add("adultes");
  if (/\bamis?\b|\bfriends?\b|\bamigos\b|\bgroupe?\b/.test(t)) out.add("amis");
  if (/\bcouple\b|\bpareja\b|\bconjoint\b|date night/.test(t)) out.add("couple");
  if (/\bsolo\b|\bseul\b/.test(t)) out.add("solo");

  // Rien de reconnu : on préfère ne rien écrire plutôt que de deviner.
  return [...out];
}

/** Normalise une liste complète, dédupliquée, dans l'ordre canonique. */
export function normalizeSuitabilityTags(list: unknown): Suitability[] {
  const raw = Array.isArray(list) ? list : [];
  const found = new Set<Suitability>();
  for (const item of raw) {
    for (const v of normalizeSuitabilityTag(item)) found.add(v);
  }
  return SUITABILITY.filter((s) => found.has(s));
}

/** Le titre est-il explicitement marqué comme convenant aux enfants ? */
export function isChildFriendly(tags: unknown): boolean {
  return normalizeSuitabilityTags(tags).includes("enfants");
}
