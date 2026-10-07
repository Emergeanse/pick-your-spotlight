/**
 * Cadres de la photo de profil. Chaque image est recadrée pour que
 * l'ouverture fasse exactement la moitié de sa largeur, centrée : un cadre de
 * taille 2 × D entoure une photo de diamètre D.
 *
 * - Dix niveaux se gagnent avec les trophées (28 au total), avec une
 *   progression de matériau : verre, argent, bronze, or, or et améthyste.
 * - Un cadre est réservé aux Ambassadeurs, qui ont invité un ami : pellicule,
 *   bobine et projecteur. Il s'affiche tant que les trophées n'ont pas offert
 *   plus riche que lui.
 */
const IMAGES = import.meta.glob<string>("../assets/cadres/*.webp", { eager: true, import: "default" });
const niveau = (n: number) => IMAGES[`../assets/cadres/niveau-${String(n).padStart(2, "0")}.webp`];

/** Trophées obtenus nécessaires pour chaque niveau (le premier est offert). */
export const SEUILS_CADRES = [0, 1, 3, 5, 8, 11, 15, 19, 24, 28] as const;

/** Le cadre Ambassadeur passe devant les quatre premiers niveaux (verre et argent). */
const RANG_AMBASSADEUR = 4;

export const IMAGE_CADRE_AMBASSADEUR = IMAGES["../assets/cadres/ambassadeur.webp"];

export interface Cadre {
  /** Niveau gagné avec les trophées, 1 à 10. */
  rang: number;
  image: string | undefined;
  ambassadeur: boolean;
  /** Trophées encore nécessaires pour le niveau suivant ; null au dernier. */
  restantAvantSuivant: number | null;
}

export function cadrePour(nbTrophees: number, ambassadeur = false): Cadre {
  let rang = 1;
  SEUILS_CADRES.forEach((seuil, i) => { if (nbTrophees >= seuil) rang = i + 1; });
  const suivant = SEUILS_CADRES[rang];
  const parAmbassadeur = ambassadeur && rang <= RANG_AMBASSADEUR;
  return {
    rang,
    image: parAmbassadeur ? IMAGE_CADRE_AMBASSADEUR : niveau(rang),
    ambassadeur: parAmbassadeur,
    restantAvantSuivant: suivant === undefined ? null : suivant - nbTrophees,
  };
}

/** Le cadre déborde de la photo : rapport taille du cadre / diamètre de la photo. */
export const ECHELLE_CADRE = 1.9;
