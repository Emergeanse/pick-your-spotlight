/**
 * Cadres de la photo de profil : treize, du simple anneau au cadre cinéma
 * étoilé, gagnés avec les trophées (28 au total). Chaque image est recadrée
 * pour que l'ouverture fasse exactement la moitié de sa largeur, centrée :
 * un cadre de taille 2 × D entoure une photo de diamètre D.
 */
const IMAGES = import.meta.glob<string>("../assets/cadres/*.webp", { eager: true, import: "default" });

/** Trophées obtenus nécessaires pour chaque cadre (le premier est offert). */
export const SEUILS_CADRES = [0, 1, 3, 5, 7, 9, 11, 13, 15, 18, 21, 24, 28] as const;

export interface Cadre {
  /** 1 à 13. */
  rang: number;
  image: string | undefined;
  /** Trophées encore nécessaires pour le cadre suivant ; null au dernier. */
  restantAvantSuivant: number | null;
}

export function cadrePour(nbTrophees: number): Cadre {
  let rang = 1;
  SEUILS_CADRES.forEach((seuil, i) => { if (nbTrophees >= seuil) rang = i + 1; });
  const suivant = SEUILS_CADRES[rang];
  return {
    rang,
    image: IMAGES[`../assets/cadres/cadre-${String(rang).padStart(2, "0")}.webp`],
    restantAvantSuivant: suivant === undefined ? null : suivant - nbTrophees,
  };
}

/** Le cadre déborde de la photo : rapport taille du cadre / diamètre de la photo. */
export const ECHELLE_CADRE = 1.9;
