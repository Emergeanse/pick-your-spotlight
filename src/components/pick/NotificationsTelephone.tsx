import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationsStore } from "@/lib/notifications-store";
import {
  activerPush,
  desactiverPush,
  doitProposerPush,
  etatPush,
  lirePushRemis,
  noterPushRemis,
  pushPrisEnCharge,
  type EtatPush,
} from "@/lib/push";

/**
 * Notifications sur le téléphone, sous deux formes :
 *
 * - `proposition` (accueil) : une carte discrète, seulement quand c'est
 *   pertinent — voir `doitProposerPush`. « Plus tard » la range un mois.
 * - `reglage` (profil) : un interrupteur toujours disponible, pour activer
 *   ou couper à tout moment.
 */

const MESSAGE_REFUS =
  "Les notifications sont bloquées pour Pick dans les réglages du navigateur. Autorise-les depuis ⋮ → Paramètres → Notifications.";

function useEtatPush() {
  const [etat, setEtat] = useState<EtatPush | "chargement">("chargement");
  useEffect(() => {
    let actif = true;
    etatPush().then((e) => { if (actif) setEtat(e); }).catch(() => { if (actif) setEtat("inactif"); });
    return () => { actif = false; };
  }, []);
  return [etat, setEtat] as const;
}

export function PropositionNotificationsTelephone({ className }: { className: string }) {
  const { user } = useAuth();
  const { notifications } = useNotificationsStore();
  const [etat, setEtat] = useEtatPush();
  const [rangee, setRangee] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const proposer =
    !rangee &&
    etat !== "chargement" &&
    doitProposerPush({
      supporte: pushPrisEnCharge(),
      permission: pushPrisEnCharge() ? Notification.permission : null,
      dejaAbonne: etat === "actif",
      aDesNotifications: notifications.length > 0,
      remisLe: lirePushRemis(),
      maintenant: Date.now(),
    });

  if (!proposer || !user) return null;

  const activer = async () => {
    setEnCours(true);
    try {
      const resultat = await activerPush(user.id);
      setEtat(resultat);
      if (resultat === "actif") toast.success("C'est noté : Pick te préviendra sur ce téléphone.");
      else if (resultat === "refuse") toast.message(MESSAGE_REFUS);
      setRangee(true);
    } catch {
      toast.error("Impossible d'activer les notifications pour le moment.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
      className={`mx-5 mt-3 flex items-center gap-3 p-3 ${className}`}
    >
      <span className="text-[18px] shrink-0" aria-hidden="true">🔔</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-sans font-semibold text-foreground leading-tight">Être prévenu sur ce téléphone</span>
        <span className="block text-[12px] font-sans text-pick-text-secondary leading-snug mt-0.5">
          Quand un ami t&apos;invite ou que le film de la soirée est choisi.
        </span>
      </span>
      <button
        type="button"
        onClick={activer}
        disabled={enCours}
        className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[12px] font-sans font-semibold disabled:opacity-40"
      >
        Activer
      </button>
      <button
        type="button"
        onClick={() => { noterPushRemis(); setRangee(true); }}
        aria-label="Plus tard"
        className="shrink-0 p-1 rounded-full text-pick-text-muted"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ReglageNotificationsTelephone() {
  const { user } = useAuth();
  const [etat, setEtat] = useEtatPush();
  const [enCours, setEnCours] = useState(false);

  if (etat === "chargement" || etat === "non-supporte") return null;

  const basculer = async () => {
    if (!user) return;
    setEnCours(true);
    try {
      if (etat === "actif") {
        await desactiverPush();
        setEtat("inactif");
        toast.message("Notifications coupées sur ce téléphone.");
      } else if (etat === "refuse") {
        toast.message(MESSAGE_REFUS);
      } else {
        const resultat = await activerPush(user.id);
        setEtat(resultat);
        if (resultat === "actif") toast.success("C'est noté : Pick te préviendra sur ce téléphone.");
        else if (resultat === "refuse") toast.message(MESSAGE_REFUS);
      }
    } catch {
      toast.error("Impossible de changer ce réglage pour le moment.");
    } finally {
      setEnCours(false);
    }
  };

  const actif = etat === "actif";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      onClick={basculer}
      disabled={enCours}
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-pick-md text-left disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-sans font-medium text-foreground/80">Notifications sur ce téléphone</span>
        <span className="block text-[11px] font-sans text-pick-text-muted mt-0.5">
          {etat === "refuse" ? "Bloquées dans les réglages du navigateur" : "Invitations, films choisis, demandes d'amis"}
        </span>
      </span>
      <span className={`relative w-10 h-6 shrink-0 rounded-full transition-colors duration-180 ease-pick ${actif ? "bg-primary" : "bg-foreground/15"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-180 ease-pick ${actif ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
