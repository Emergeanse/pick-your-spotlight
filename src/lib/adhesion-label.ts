/**
 * L'adhésion en mots : un pourcentage seul laisse croire à une probabilité
 * d'aimer le film, ce qu'il n'est pas (c'est un score composite). Le mot dit
 * ce que Pick en pense ; le chiffre reste là pour qui veut le détail.
 */
export function libelleAdhesion(score: number): string {
  if (score >= 90) return "Excellent choix";
  if (score >= 80) return "Très bon choix";
  if (score >= 70) return "Bon choix";
  if (score >= 55) return "À tenter";
  return "Choix audacieux";
}

/** Intensité lumineuse du badge, de 0 (terne) à 1 (pleine lueur). */
export function intensiteAdhesion(score: number): number {
  return Math.min(1, Math.max(0, (score - 40) / 55));
}

/**
 * Apparence de la gemme selon le score : plus petite, terne et froide (bleu-
 * gris) quand l'adhésion est faible ; plus grande, lumineuse et chaude (vers le
 * magenta et l'or) quand elle est forte. Une pulsation à partir de 90 %.
 */
export function apparenceAdhesion(score: number) {
  const i = intensiteAdhesion(score);
  return {
    /** Échelle de la gemme, 0,80 → 1,08. */
    echelle: 0.8 + 0.28 * i,
    luminosite: 0.55 + 0.6 * i,
    saturation: 0.35 + 0.85 * i,
    /** Teinte : -40° (bleu froid) → 0° (violet d'origine) → +18° (plus chaud). */
    teinte: i < 0.55 ? -40 + (40 * i) / 0.55 : (18 * (i - 0.55)) / 0.45,
    lueur: { rayon: 2 + 16 * i, opacite: 0.05 + 0.45 * i },
    pulse: score >= 90,
  };
}
