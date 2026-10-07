import { supabase } from "@/integrations/supabase/client";

/**
 * Inviter un ami sur Pick. Le lien porte le code ami : l'inscription par ce
 * lien rend les deux comptes amis d'office (Auth.tsx, processInvite).
 *
 * Inviter quelqu'un fait de soi un « Ambassadeur » (cadre de photo exclusif).
 * Le statut vit dans les métadonnées du compte : pas de migration, et il suit
 * la personne d'un appareil à l'autre. Pick ne peut pas savoir si le message
 * est vraiment parti (le partage se fait dans WhatsApp) : un partage mené à
 * son terme suffit.
 */
const BASE_INVITATION = "https://pick-your-spotlight.lovable.app/auth?invite=";

export function lienInvitation(codeAmi: string): string {
  return `${BASE_INVITATION}${encodeURIComponent(codeAmi)}`;
}

export function messageInvitation(prenom: string | null, lien: string): string {
  const qui = prenom ? `${prenom} t'invite` : "Je t'invite";
  return `${qui} sur Pick, l'appli qui trouve LE film à regarder ensemble 🍿 Rejoins-moi : ${lien}`;
}

export async function lireCodeAmi(userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("friend_code").eq("id", userId).maybeSingle();
  return (data as { friend_code: string | null } | null)?.friend_code ?? null;
}

/**
 * Ouvre le partage du téléphone (WhatsApp, SMS…), ou WhatsApp directement
 * quand le navigateur ne sait pas partager. Renvoie false si la personne a
 * renoncé.
 */
export async function partagerInvitation(texte: string): Promise<boolean> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texte });
      return true;
    } catch {
      return false;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, "_blank", "noopener");
  return true;
}

export async function devenirAmbassadeur(): Promise<void> {
  await supabase.auth.updateUser({ data: { ambassadeur: true } }).then(() => {}, () => {});
}

export function estAmbassadeur(meta: Record<string, unknown> | undefined | null): boolean {
  return meta?.ambassadeur === true;
}
