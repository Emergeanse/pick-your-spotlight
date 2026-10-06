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
