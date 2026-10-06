/**
 * ADN cinéma : six traits humains calculés à partir du vecteur de goût (moyenne
 * pondérée des 32 dimensions des films aimés, voir generate-embedding).
 *
 * Un trait vaut 50 quand les goûts sont dans la moyenne du catalogue, plus
 * quand ils penchent nettement de ce côté. Sans référence, une valeur brute ne
 * dirait rien : les films aimés sont une moyenne, toujours proche du milieu.
 *
 * Aucun appel à l'IA, rien d'inventé : seulement des vecteurs déjà calculés.
 */

/** Indices des dimensions utilisées (ordre de TASTE_DIMENSIONS, generate-embedding). */
const D = {
  emotional_depth: 1, pacing: 2, humor: 3, darkness: 4, action_intensity: 8,
  suspense: 9, realism: 11, cerebral: 13, warmth: 14, world_building: 18,
  supernatural: 22, artistic: 23,
} as const;

/**
 * Moyenne et écart-type du catalogue pour ces dimensions, mesurés le 6 octobre
 * 2026 sur 400 des 17 443 films de movie_embeddings.
 */
const CATALOGUE: Record<number, [number, number]> = {
  1: [0.66, 0.16], 2: [0.64, 0.10], 3: [0.44, 0.28], 4: [0.45, 0.23], 8: [0.48, 0.26],
  9: [0.53, 0.21], 11: [0.44, 0.17], 13: [0.44, 0.19], 14: [0.48, 0.21], 18: [0.47, 0.25],
  22: [0.31, 0.25], 23: [0.54, 0.21],
};

export type TraitId = "emotion" | "tension" | "imaginaire" | "humour" | "action" | "contemplation";

export const TRAITS: { id: TraitId; libelle: string; adjectif: string; composantes: [number, 1 | -1][] }[] = [
  { id: "emotion",       libelle: "Émotion",       adjectif: "émotionnel",  composantes: [[D.emotional_depth, 1], [D.warmth, 1]] },
  { id: "tension",       libelle: "Tension",       adjectif: "intense",     composantes: [[D.suspense, 1], [D.darkness, 1]] },
  { id: "imaginaire",    libelle: "Imaginaire",    adjectif: "rêveur",      composantes: [[D.world_building, 1], [D.supernatural, 1], [D.realism, -1]] },
  { id: "humour",        libelle: "Humour",        adjectif: "léger",       composantes: [[D.humor, 1]] },
  { id: "action",        libelle: "Action",        adjectif: "énergique",   composantes: [[D.action_intensity, 1], [D.pacing, 1]] },
  { id: "contemplation", libelle: "Contemplation", adjectif: "contemplatif", composantes: [[D.pacing, -1], [D.artistic, 1], [D.cerebral, 1]] },
];

/**
 * Amplification de l'écart à la moyenne. Une moyenne de films aimés s'écarte
 * peu du catalogue (souvent moins d'un demi écart-type) : sans ce facteur,
 * tous les traits tiendraient entre 45 et 55.
 */
const AMPLIFICATION = 40;

export type Adn = Record<TraitId, number>;

export function calculerAdn(vecteur: number[] | null | undefined): Adn | null {
  if (!vecteur || vecteur.length < 24) return null;
  const adn = {} as Adn;
  for (const t of TRAITS) {
    const z = t.composantes.reduce((somme, [i, sens]) => {
      const [moyenne, ecart] = CATALOGUE[i];
      return somme + sens * ((vecteur[i] - moyenne) / ecart);
    }, 0) / t.composantes.length;
    adn[t.id] = Math.round(Math.min(99, Math.max(5, 50 + AMPLIFICATION * z)));
  }
  return adn;
}

/** Les traits du plus fort au plus faible. */
export function traitsDominants(adn: Adn, n = 3) {
  return TRAITS.map((t) => ({ ...t, valeur: adn[t.id] })).sort((a, b) => b.valeur - a.valeur).slice(0, n);
}

/**
 * « Ton ADN évolue » : écart entre les goûts récents (30 jours) et les goûts de
 * fond. Seules les variations d'au moins 3 points comptent, les deux plus fortes.
 */
export function evolutionAdn(fond: Adn | null, recent: Adn | null) {
  if (!fond || !recent) return [];
  return TRAITS
    .map((t) => ({ ...t, ecart: recent[t.id] - fond[t.id] }))
    .filter((t) => Math.abs(t.ecart) >= 3)
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
    .slice(0, 2);
}

// ── Univers favoris ─────────────────────────────────────────────────────────

/**
 * Part de chaque genre dans le catalogue (4 000 films de movie_embeddings,
 * mesuré le 6 octobre 2026). Le drame est sur 48 % des films, la comédie sur
 * 37 % : compter les genres des films aimés les plaçait en tête chez tout le
 * monde (« Drame 100 % »). On classe donc par sur-représentation.
 */
const PART_CATALOGUE: Record<string, number> = {
  "Drame": 0.479, "Comédie": 0.367, "Thriller": 0.181, "Action": 0.235, "Crime": 0.164,
  "Animation": 0.131, "Romance": 0.123, "Aventure": 0.119, "Mystère": 0.097, "Familial": 0.121,
  "Horreur": 0.088, "Fantastique": 0.082, "Science-Fiction": 0.158, "Histoire": 0.044,
  "Documentaire": 0.033, "Guerre": 0.028, "Musique": 0.021, "Western": 0.017,
};

/** Les libellés de séries TMDB rejoignent leur équivalent cinéma ; le reste n'est pas un univers. */
const FUSION: Record<string, string | null> = {
  "Action & Adventure": "Action",
  "Science-Fiction & Fantastique": "Science-Fiction",
  "Sci-Fi & Fantasy": "Science-Fiction",
  "War & Politics": "Guerre",
  "Kids": "Familial",
  "Famille": "Familial",
  "Téléfilm": null, "Reality": null, "Soap": null, "Talk": null, "News": null,
};

/** Un genre n'est retenu qu'à partir de 3 films aimés : sinon un seul western ferait un « univers ». */
const MINIMUM_FILMS = 3;

/**
 * Univers favoris, du plus caractéristique au moins : part du genre dans les
 * films aimés divisée par sa part dans le catalogue. Le drame n'y figure que
 * si on en aime nettement plus que la moyenne.
 */
export function universFavoris(comptes: { genre: string; count: number }[], n = 5): string[] {
  const fusionnes = new Map<string, number>();
  for (const { genre, count } of comptes) {
    const nom = genre in FUSION ? FUSION[genre] : genre;
    if (!nom) continue;
    fusionnes.set(nom, (fusionnes.get(nom) ?? 0) + count);
  }
  const total = [...fusionnes.values()].reduce((a, b) => a + b, 0);
  // Parts du catalogue ramenées aux seuls genres présents chez l'utilisateur :
  // comparer ses quelques genres aux 18 du catalogue gonflait toutes ses parts.
  const totalCatalogue = [...fusionnes.keys()].reduce((somme, g) => somme + (PART_CATALOGUE[g] ?? 0), 0);
  if (total === 0) return [];
  const caracteristiques = [...fusionnes.entries()]
    .filter(([genre, count]) => count >= MINIMUM_FILMS && PART_CATALOGUE[genre])
    .map(([genre, count]) => ({ genre, affinite: (count / total) / (PART_CATALOGUE[genre] / totalCatalogue) }))
    .filter((g) => g.affinite > 1)
    .sort((a, b) => b.affinite - a.affinite)
    .slice(0, n)
    .map((g) => g.genre);
  // Profil encore jeune (aucun genre à 3 films) : les plus présents, faute de mieux.
  if (caracteristiques.length > 0) return caracteristiques;
  return [...fusionnes.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([g]) => g);
}
