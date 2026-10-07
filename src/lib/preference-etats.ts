/**
 * Préférences à trois états (genres, époques) — voir PreferenceChips.
 * - aimé : Pick favorise — violet légèrement rempli, sans halo au repos ;
 * - exclu : Pick évite fortement — rose désaturé, discret ;
 * - neutre : aucune préférence — gris-violet, très effacé.
 */
export type EtatPreference = "aime" | "exclu" | "neutre";

/** Neutre → aimé → exclu → neutre. */
export const etatSuivant = (e: EtatPreference): EtatPreference =>
  e === "neutre" ? "aime" : e === "aime" ? "exclu" : "neutre";

const COULEURS: Record<EtatPreference, string> = {
  aime: "text-pick-purple-light bg-primary/[0.13] border-pick-purple-light/55",
  exclu: "text-pick-exclude bg-pick-exclude/[0.08] border-pick-exclude/40",
  neutre: "text-pick-text-muted bg-white/[0.025] border-white/[0.08]",
};

const SURVOL: Record<EtatPreference, string> = {
  aime: "[@media(hover:hover)]:hover:shadow-pick-active",
  exclu: "[@media(hover:hover)]:hover:border-pick-exclude/60",
  neutre: "[@media(hover:hover)]:hover:text-pick-text-secondary [@media(hover:hover)]:hover:border-white/15",
};

export function classeChip(etat: EtatPreference, interactif = false): string {
  return [
    "relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] font-sans font-medium",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-[150ms] ease-pick",
    COULEURS[etat],
    interactif ? `${SURVOL[etat]} active:scale-[0.96]` : "",
  ].join(" ");
}

/** « 5 aimés · 5 exclus » — « aimées » pour les époques. */
export function libelleResume(aimes: number, exclus: number, feminin = false): string {
  const e = feminin ? "e" : "";
  const parts: string[] = [];
  if (aimes > 0) parts.push(`${aimes} aimé${e}${aimes > 1 ? "s" : ""}`);
  if (exclus > 0) parts.push(`${exclus} exclu${e}${exclus > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "Aucune préférence pour l'instant";
}

