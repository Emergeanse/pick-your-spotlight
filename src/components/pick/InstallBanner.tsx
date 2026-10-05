import { motion } from "framer-motion";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

/**
 * Invitation discrète à poser Pick sur l'écran d'accueil.
 *
 * Posée au-dessus de la barre d'onglets plutôt qu'en haut : le bandeau de
 * reprise d'initiation occupe déjà le haut, et les deux peuvent se croiser.
 * Elle n'apparaît que si le navigateur sait installer l'application — voir
 * `useInstallPrompt`. Sur iPhone, où aucune page ne peut ouvrir la fenêtre
 * d'installation, le bouton laisse la place au geste à faire dans Safari.
 */
export default function InstallBanner() {
  const { proposable, mode, installer, remettre } = useInstallPrompt();

  if (!proposable) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // 60 px de barre d'onglets, plus les 28 px dont le bouton central et son
      // halo dépassent au-dessus, plus l'encoche du bas, plus une respiration.
      className="fixed md:absolute left-0 right-0 bottom-0 z-[52] px-4 pb-[calc(88px+env(safe-area-inset-bottom)+0.5rem)] pointer-events-none"
    >
      <div className="mx-auto max-w-lg md:max-w-[420px] pointer-events-auto">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-background/95 backdrop-blur-xl px-4 py-3 shadow-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-sans font-semibold text-foreground">Installer Pick</p>
            {mode === "ios" ? (
              <p className="text-[10px] font-sans text-foreground/50 leading-relaxed">
                Touche{" "}
                <Share className="inline w-3 h-3 -mt-0.5 text-primary" aria-label="Partager" />{" "}
                dans Safari, puis{" "}
                <span className="whitespace-nowrap">
                  <SquarePlus className="inline w-3 h-3 -mt-0.5 text-primary" aria-hidden="true" />{" "}
                  « Sur l&apos;écran d&apos;accueil »
                </span>
                .
              </p>
            ) : (
              <p className="text-[10px] font-sans text-foreground/50">
                Sur ton écran d&apos;accueil, comme une vraie application.
              </p>
            )}
          </div>
          {mode === "navigateur" && (
            <button
              type="button"
              onClick={() => void installer()}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-sans font-semibold"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Installer
            </button>
          )}
          <button
            type="button"
            onClick={remettre}
            aria-label="Plus tard"
            className="shrink-0 p-1 rounded-full text-foreground/40 hover:text-foreground/60"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
