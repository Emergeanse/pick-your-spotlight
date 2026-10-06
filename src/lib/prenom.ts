/** Prénom affiché aux amis : ni vide, ni initiale seule, ni trop long. */
export const PRENOM_MAX = 40;

export function prenomValide(brut: string): string | null {
  const prenom = brut.trim().replace(/\s+/g, " ");
  if (prenom.length < 2 || prenom.length > PRENOM_MAX) return null;
  return prenom;
}
