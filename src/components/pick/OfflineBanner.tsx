import { motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/connectivity";

/**
 * Bandeau « hors ligne ».
 *
 * Depuis que le service worker garde la coquille en cache, l'application
 * s'ouvre sans réseau — et ressemble alors à une application qui fonctionne :
 * l'accueil s'affiche, les cartes de films sont simplement vides. Ce bandeau
 * est là pour que cet écran creux s'explique de lui-même, au lieu de passer
 * pour une panne.
 */
export default function OfflineBanner() {
  const enLigne = useOnlineStatus();

  if (enLigne) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      // Même emplacement que l'invitation à installer : au-dessus de la barre
      // d'onglets. Les deux ne se croisent pas — le navigateur ne propose
      // jamais d'installer une application pendant une coupure réseau.
      className="fixed md:absolute left-0 right-0 bottom-0 z-[52] px-4 pb-[calc(60px+env(safe-area-inset-bottom)+0.75rem)] pointer-events-none"
    >
      <div className="mx-auto max-w-lg md:max-w-[420px] pointer-events-auto">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-background/95 backdrop-blur-xl px-4 py-3 shadow-lg">
          <WifiOff className="w-4 h-4 shrink-0 text-amber-400/80" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-sans font-semibold text-foreground">Hors ligne</p>
            <p className="text-[10px] font-sans text-foreground/50">
              Tu peux ouvrir Pick, mais pas chercher de film tant que la connexion n&apos;est pas revenue.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
