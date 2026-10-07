import { useEffect, useState } from "react";
import ChoixAvatar from "./ChoixAvatar";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PRENOM_MAX, prenomValide } from "@/lib/prenom";

/**
 * « Comment tu t'appelles ? » — demandé une fois, à tout compte sans prénom.
 *
 * Sans prénom, un compte apparaît comme « Ami » chez ses amis et « Un ami »
 * dans les conseils et les notifications : ses amis ne savent pas qui leur
 * écrit. On ne peut pas passer cet écran, mais il ne prend que quelques
 * secondes. Monté une fois, dans AppLayout.
 */

const PrenomRequis = () => {
  const { user, isReady } = useAuth();
  const [manquant, setManquant] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  // Avatar proposé seulement à qui n'a pas déjà de photo.
  const [sansPhoto, setSansPhoto] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    let actif = true;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // En cas d'erreur de lecture, ne rien imposer : mieux vaut ne pas
        // demander que bloquer quelqu'un qui a déjà un prénom.
        if (!actif || error) return;
        const ligne = data as { display_name: string | null; avatar_url: string | null } | null;
        const actuel = ligne?.display_name?.trim();
        setSansPhoto(!ligne?.avatar_url);
        if (!actuel) {
          const suggestion = (user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
          setSaisie(suggestion.trim().slice(0, PRENOM_MAX));
          setManquant(true);
        }
      });
    return () => { actif = false; };
  }, [isReady, user]);

  const prenom = prenomValide(saisie);

  const valider = async () => {
    if (!user || !prenom) return;
    setEnvoi(true);
    const maj: Record<string, string> = { display_name: prenom };
    if (sansPhoto && avatar) maj.avatar_url = avatar;
    const { error } = await supabase.from("profiles").update(maj as never).eq("id", user.id);
    setEnvoi(false);
    if (error) {
      toast.error("Impossible d'enregistrer ton prénom pour le moment.");
      return;
    }
    // L'accueil affiche le prénom depuis ce cache avant même de lire le profil.
    try {
      const cache = JSON.parse(localStorage.getItem("pys_greeting") || "{}");
      localStorage.setItem("pys_greeting", JSON.stringify({ ...cache, firstName: prenom, ...(sansPhoto && avatar ? { avatarUrl: avatar } : {}) }));
    } catch { /* sans stockage, l'accueil le relira au prochain chargement */ }
    setManquant(false);
    toast.success(`Enchanté ${prenom} !`);
  };

  return (
    <AnimatePresence>
      {manquant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26 }}
          className="fixed md:absolute inset-0 z-[70] bg-background/95 backdrop-blur-md flex items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prenom-titre"
        >
          <motion.form
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
            onSubmit={(e) => { e.preventDefault(); valider(); }}
            className="w-full max-w-sm rounded-pick-xl border border-pick-border bg-pick-surface p-6 shadow-pick-card"
          >
            <p className="text-[32px] leading-none mb-3" aria-hidden="true">👋</p>
            <h2 id="prenom-titre" className="text-[22px] font-sans font-bold text-foreground leading-tight">
              Comment tu t&apos;appelles&nbsp;?
            </h2>
            <p className="mt-2 text-[14px] font-sans text-pick-text-secondary leading-snug">
              C&apos;est ce que verront tes amis quand tu les invites à une soirée ou que tu leur conseilles un film.
            </p>
            <input
              autoFocus
              value={saisie}
              onChange={(e) => setSaisie(e.target.value.slice(0, PRENOM_MAX))}
              placeholder="Ton prénom ou ton pseudo"
              autoComplete="given-name"
              className="mt-5 w-full rounded-pick-md border border-pick-border bg-background/60 px-4 py-3 text-[16px] font-sans text-foreground placeholder:text-pick-text-muted focus:outline-none focus:border-pick-border-active"
            />
            {sansPhoto && (
              <div className="mt-5">
                <p className="mb-3 text-[13px] font-sans font-semibold text-pick-text-secondary">Et ton avatar&nbsp;?</p>
                <ChoixAvatar valeur={avatar} onChoisir={setAvatar} taille={52} />
                <p className="mt-2 text-[11px] font-sans text-pick-text-muted">Tu pourras le changer ou mettre ta photo depuis ton profil.</p>
              </div>
            )}
            <button
              type="submit"
              disabled={!prenom || envoi}
              className="mt-4 w-full py-3 rounded-full bg-primary text-primary-foreground text-[15px] font-sans font-semibold shadow-pick-active disabled:opacity-35 disabled:shadow-none transition-opacity duration-180 ease-pick"
            >
              C&apos;est parti
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrenomRequis;
