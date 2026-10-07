/**
 * Cadres de la photo de profil. Chaque image est recadrée pour que
 * l'ouverture fasse exactement la moitié de sa largeur, centrée : un cadre de
 * taille 2 × D entoure une photo de diamètre D.
 *
 * - Douze cadres se gagnent avec les trophées (28 au total), du simple anneau
 *   au cadre cinéma étoilé.
 * - Un cadre est réservé aux Ambassadeurs, qui ont invité un ami : pellicule,
 *   bobine et projecteur. Il s'affiche tant que les trophées n'ont pas offert
 *   plus riche que lui.
 */
const IMAGES = import.meta.glob<string>("../assets/cadres/*.webp", { eager: true, import: "default" });
const image = (n: number) => IMAGES[`../assets/cadres/cadre-${String(n).padStart(2, "0")}.webp`];

/** Fichiers de l'échelle des trophées, du plus sobre au plus riche. */
const ECHELLE = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
/** Trophées obtenus nécessaires pour chaque cadre de l'échelle (le premier est offert). */
export const SEUILS_CADRES = [0, 1, 3, 5, 8, 11, 14, 17, 20, 23, 26, 28] as const;

export const FICHIER_AMBASSADEUR = 4;
/** Le cadre Ambassadeur passe devant les quatre premiers de l'échelle. */
const RANG_AMBASSADEUR = 4;

export const IMAGE_CADRE_AMBASSADEUR = image(FICHIER_AMBASSADEUR);

export interface Cadre {
  /** Rang dans l'échelle des trophées, 1 à 12. */
  rang: number;
  image: string | undefined;
  ambassadeur: boolean;
  /** Trophées encore nécessaires pour le cadre suivant de l'échelle ; null au dernier. */
  restantAvantSuivant: number | null;
}

export function cadrePour(nbTrophees: number, ambassadeur = false): Cadre {
  let rang = 1;
  SEUILS_CADRES.forEach((seuil, i) => { if (nbTrophees >= seuil) rang = i + 1; });
  const suivant = SEUILS_CADRES[rang];
  const parAmbassadeur = ambassadeur && rang <= RANG_AMBASSADEUR;
  return {
    rang,
    image: parAmbassadeur ? IMAGE_CADRE_AMBASSADEUR : image(ECHELLE[rang - 1]),
    ambassadeur: parAmbassadeur,
    restantAvantSuivant: suivant === undefined ? null : suivant - nbTrophees,
  };
}

/** Le cadre déborde de la photo : rapport taille du cadre / diamètre de la photo. */
export const ECHELLE_CADRE = 1.9;
