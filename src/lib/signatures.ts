import type { Adn } from "@/lib/adn";

/**
 * Signatures de l'ADN cinéma : trois ou quatre étiquettes parlantes
 * (« Slow burn », « Épique »…) déduites des six traits et des univers
 * favoris. Rien n'est stocké : elles se recalculent depuis l'ADN, celui de
 * soi comme celui d'un ami.
 *
 * Chaque signature a un score : l'écart moyen de ses traits à la moyenne du
 * catalogue (50), dans le sens voulu. Une signature ne s'affiche que si ce
 * score est net (≥ 8 points), et on garde les quatre meilleures.
 */
export type SignatureId =
  | "dark" | "slowburn" | "epique" | "sf" | "feelgood" | "sensible"
  | "adrenaline" | "reveur" | "cerebral" | "frissons" | "rire" | "polar";

export interface Signature {
  id: SignatureId;
  libelle: string;
}

type Regle = {
  id: SignatureId;
  libelle: string;
  /** [trait, +1 si élevé voulu, -1 si faible voulu] */
  traits: [keyof Adn, 1 | -1][];
  /** Univers favori requis (nom après fusion, voir adn.ts). */
  univers?: string[];
};

const REGLES: Regle[] = [
  { id: "dark", libelle: "Dark / intense", traits: [["tension", 1], ["legerete", -1]] },
  { id: "slowburn", libelle: "Slow burn", traits: [["contemplation", 1], ["rythme", -1]] },
  { id: "epique", libelle: "Épique", traits: [["imaginaire", 1], ["rythme", 1]] },
  { id: "sf", libelle: "Science-fiction adulte", traits: [["contemplation", 1], ["imaginaire", 1]], univers: ["Science-Fiction"] },
  { id: "feelgood", libelle: "Feel good", traits: [["legerete", 1], ["tension", -1]] },
  { id: "sensible", libelle: "Cœur sensible", traits: [["emotion", 1]] },
  { id: "adrenaline", libelle: "Adrénaline", traits: [["rythme", 1], ["tension", 1]] },
  { id: "reveur", libelle: "Rêveur", traits: [["imaginaire", 1], ["rythme", -1]] },
  { id: "cerebral", libelle: "Cérébral", traits: [["contemplation", 1], ["tension", 1]] },
  { id: "frissons", libelle: "Amateur de frissons", traits: [["tension", 1]], univers: ["Horreur"] },
  { id: "rire", libelle: "Bon public du rire", traits: [["legerete", 1]], univers: ["Comédie"] },
  { id: "polar", libelle: "Enquêteur", traits: [["tension", 1], ["contemplation", 1]], univers: ["Crime", "Mystère", "Thriller"] },
];

const SEUIL = 8;

export function signaturesAdn(adn: Adn | null, univers: string[] = [], n = 4): Signature[] {
  if (!adn) return [];
  const mesUnivers = new Set(univers);
  return REGLES
    .filter((r) => !r.univers || r.univers.some((u) => mesUnivers.has(u)))
    .map((r) => {
      const ecarts = r.traits.map(([t, sens]) => (adn[t] - 50) * sens);
      // Toutes les conditions doivent tenir : le score est le plus faible écart.
      const score = Math.min(...ecarts) + (r.univers ? 2 : 0);
      return { id: r.id, libelle: r.libelle, score };
    })
    .filter((s) => s.score >= SEUIL)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ id, libelle }) => ({ id, libelle }));
}
