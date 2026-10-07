import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { IMAGE_CADRE_AMBASSADEUR } from "@/lib/cadres";
import { devenirAmbassadeur, lienInvitation, lireCodeAmi, messageInvitation, partagerInvitation } from "@/lib/invitation";
import PhotoEncadree from "@/components/pick/PhotoEncadree";
import OnboardingValidateButton from "./OnboardingValidateButton";

/**
 * Dernière étape du parcours : inviter un premier ami. Facultative (Pick ne
 * peut pas vérifier l'envoi, et l'imposer ferait abandonner), mais valorisée :
 * inviter débloque le cadre Ambassadeur, montré avant et célébré après.
 */
interface OnboardingInviteStepProps {
  onContinue: () => void;
}

const OnboardingInviteStep = ({ onContinue }: OnboardingInviteStepProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [prenom, setPrenom] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [debloque, setDebloque] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!user) return;
    lireCodeAmi(user.id).then(setCode);
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      const d = data as { display_name: string | null; avatar_url: string | null } | null;
      setPrenom(d?.display_name?.trim().split(" ")[0] || null);
      setPhoto(d?.avatar_url ?? null);
    });
  }, [user]);

  const inviter = async () => {
    if (!code) return;
    setEnvoi(true);
    const ok = await partagerInvitation(messageInvitation(prenom, lienInvitation(code)));
    setEnvoi(false);
    if (!ok) return;
    await devenirAmbassadeur();
    setDebloque(true);
  };

  return (
    <div className="flex flex-col items-center min-h-full px-6 pt-6 pb-10 text-center">
      <AnimatePresence mode="wait">
        {!debloque ? (
          <motion.div key="inviter" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center w-full max-w-sm">
            <h1 className="text-2xl md:text-3xl font-serif mb-2">Pick, c&apos;est mieux à plusieurs</h1>
            <p className="text-[14px] font-sans text-pick-text-secondary leading-relaxed mb-8">
              Invite ton premier ami : vous pourrez trouver LE film à regarder ensemble, en Duo ou en soirée.
            </p>

            <div className="my-6">
              <PhotoEncadree photo={photo} cadre={IMAGE_CADRE_AMBASSADEUR} taille={96} />
            </div>
            <p className="mt-6 text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-pick-gold">Cadre exclusif</p>
            <p className="mt-1 text-[16px] font-serif text-foreground">Ambassadeur Pick</p>
            <p className="mt-1 mb-8 text-[12px] font-sans text-pick-text-muted">Réservé à ceux qui invitent un ami. Il entourera ta photo.</p>

            <button
              type="button"
              onClick={inviter}
              disabled={!code || envoi}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-primary text-primary-foreground text-[15px] font-sans font-semibold shadow-pick-cta active:scale-[0.98] transition-transform duration-120 ease-pick disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              Inviter sur WhatsApp
            </button>
            <p className="mt-2 text-[11px] font-sans text-pick-text-muted">Ou par SMS, Messenger… Tu peux choisir plusieurs amis.</p>
            <button type="button" onClick={onContinue} className="mt-6 py-2 text-[13px] font-sans text-pick-text-muted [@media(hover:hover)]:hover:text-pick-text-secondary">
              Plus tard
            </button>
          </motion.div>
        ) : (
          <motion.div key="bravo" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }} className="flex flex-col items-center w-full max-w-sm">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-pick-gold mb-2">Cadre débloqué</p>
            <h1 className="text-2xl md:text-3xl font-serif mb-2">Bienvenue, Ambassadeur&nbsp;!</h1>
            <p className="text-[14px] font-sans text-pick-text-secondary leading-relaxed">
              Ton cadre entoure désormais ta photo. Dès que ton ami s&apos;inscrit avec ton lien, vous êtes amis sur Pick.
            </p>
            <motion.div initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 160, damping: 12 }} className="my-14">
              <PhotoEncadree photo={photo} cadre={IMAGE_CADRE_AMBASSADEUR} taille={120} />
            </motion.div>
            <div className="w-full max-w-xs">
              <OnboardingValidateButton onValidate={onContinue} label="Continuer" />
            </div>
            <button type="button" onClick={inviter} className="mt-4 py-2 text-[13px] font-sans text-pick-purple-light">
              Inviter quelqu&apos;un d&apos;autre
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingInviteStep;
