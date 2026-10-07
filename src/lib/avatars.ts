/**
 * Avatars de la charte, pour qui n'importe pas de photo. Ils vivent dans
 * public/avatars : leur adresse s'enregistre dans profiles.avatar_url comme
 * une photo importée, si bien que tous les écrans les affichent sans rien
 * savoir d'eux. Sans photo ni avatar choisi, on montre l'écureuil.
 *
 * Pas d'avatar attribué selon le sexe : Pick ne le connaît pas, et le deviner
 * au prénom se tromperait. Chacun choisit le sien.
 */
export const AVATARS = [
  { id: "ecureuil", label: "L'écureuil Pick" },
  { id: "cheveux-longs", label: "Cheveux longs" },
  { id: "barbe", label: "Barbe" },
  { id: "lunettes", label: "Lunettes" },
  { id: "sweat", label: "Sweat" },
  { id: "boucles", label: "Boucles" },
  { id: "magicien", label: "Magicien" },
  { id: "mamie", label: "Cheveux gris" },
] as const;

export const urlAvatarCharte = (id: string) => `/avatars/${id}.webp`;

export const AVATAR_DEFAUT = urlAvatarCharte("ecureuil");

/** La photo à afficher : celle de la personne, sinon l'avatar par défaut. */
export const avatarAffiche = (url: string | null | undefined): string => url || AVATAR_DEFAUT;

export const estAvatarCharte = (url: string | null | undefined): boolean =>
  Boolean(url && url.startsWith("/avatars/"));
