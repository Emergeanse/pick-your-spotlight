import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check } from "lucide-react";
import AppOverlayPortal from "./AppOverlayPortal";
import CroixRonde from "./CroixRonde";
import { Button } from "@/components/ui/button";
import { bottomTabBarClearance } from "@/lib/app-chrome";
import { classeChip, libelleResume, type EtatPreference } from "@/lib/preference-etats";

/**
 * Préférences à trois états (genres, époques) : la même capsule, les mêmes
 * groupes et la même feuille d'édition partout, pour qu'on ne comprenne le
 * système qu'une fois.

 */
export function IconeEtat({ etat }: { etat: EtatPreference }) {
  if (etat === "aime") return <Check className="w-3 h-3 shrink-0" strokeWidth={2.5} />;
  if (etat === "exclu") return <Ban className="w-3 h-3 shrink-0" strokeWidth={2.2} />;
  return null;
}

export function ChipPreference({ etat, label }: { etat: EtatPreference; label: string }) {
  return (
    <span className={classeChip(etat)}>
      <IconeEtat etat={etat} />
      {label}
    </span>
  );
}

/** Groupes en lecture : aimés, puis exclus, puis (si fourni) sans préférence. */
export function GroupesPreferences({
  aimes,
  exclus,
  neutres,
  feminin = false,
}: {
  aimes: string[];
  exclus: string[];
  neutres?: string[];
  feminin?: boolean;
}) {
  const e = feminin ? "e" : "";
  const groupes: { titre: string; etat: EtatPreference; items: string[] }[] = [
    { titre: `Aimé${e}s`, etat: "aime", items: aimes },
    { titre: `Exclu${e}s`, etat: "exclu", items: exclus },
    { titre: "Sans préférence", etat: "neutre", items: neutres ?? [] },
  ];
  const visibles = groupes.filter((g) => g.items.length > 0);
  if (visibles.length === 0) return null;
  return (
    <div className="space-y-5">
      {visibles.map((g) => (
        <div key={g.etat}>
          <p className="mb-2 text-[12px] font-sans font-semibold text-pick-text-secondary">{g.titre}</p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((label) => (
              <ChipPreference key={label} etat={g.etat} label={label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Carte du profil : titre + « Modifier », résumé chiffré, puis les groupes. */
export function CartePreferences({
  titre,
  aimes,
  exclus,
  feminin = false,
  onModifier,
  children,
}: {
  titre: string;
  aimes: number;
  exclus: number;
  feminin?: boolean;
  onModifier: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 rounded-pick-lg bg-card/80 backdrop-blur-sm border border-pick-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-sans font-semibold text-foreground uppercase tracking-widest">{titre}</h4>
        <button
          type="button"
          onClick={onModifier}
          className="-my-2 py-2 text-[12px] font-sans font-semibold text-pick-purple-light transition-opacity duration-120 ease-pick [@media(hover:hover)]:hover:opacity-80"
        >
          Modifier
        </button>
      </div>
      <p className="mt-1 text-[12px] font-sans text-pick-text-muted">{libelleResume(aimes, exclus, feminin)}</p>
      <div className="mt-4 empty:hidden">{children}</div>
    </div>
  );
}

/** Rappel des trois états, en tête de chaque feuille d'édition. */
function LegendeEtats({ feminin }: { feminin: boolean }) {
  const e = feminin ? "e" : "";
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-sans text-pick-text-secondary">
        Touche un choix pour le faire changer : sans préférence, puis aimé{e}, puis exclu{e}.
      </p>
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 text-[12px] font-sans text-pick-text-muted">
          <span className={classeChip("aime")}><IconeEtat etat="aime" />Aimé{e}</span>
          Pick favorise.
        </span>
        <span className="flex items-center gap-2 text-[12px] font-sans text-pick-text-muted">
          <span className={classeChip("exclu")}><IconeEtat etat="exclu" />Exclu{e}</span>
          Pick évitera ce type de contenu.
        </span>
      </div>
    </div>
  );
}

/** Feuille d'édition du bas, au-dessus de la barre d'onglets. */
export function FeuillePreferences({
  ouvert,
  titre,
  feminin = false,
  premiereFois = false,
  enregistrement = false,
  onFermer,
  onEnregistrer,
  children,
}: {
  ouvert: boolean;
  titre: string;
  feminin?: boolean;
  /** Rien n'est encore réglé : un mot d'accueil, qui disparaît ensuite. */
  premiereFois?: boolean;
  enregistrement?: boolean;
  onFermer: () => void;
  onEnregistrer: () => void;
  children: ReactNode;
}) {
  return (
    <AppOverlayPortal>
      <AnimatePresence>
        {ouvert && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/55"
              onClick={onFermer}
            />
            <motion.div
              role="dialog"
              aria-label={titre}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-lg max-h-[88vh] flex flex-col rounded-t-pick-xl bg-pick-surface border-t border-pick-border shadow-pick-card"
            >
              <div className="flex justify-center pt-3 shrink-0">
                <div className="w-10 h-1 rounded-full bg-foreground/15" />
              </div>
              <div className="flex items-center justify-between gap-2 px-4 pt-1 shrink-0">
                <span className="w-11" />
                <h2 className="font-serif text-lg text-foreground">{titre}</h2>
                <CroixRonde onClick={onFermer} />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-5">
                {premiereFois && (
                  <div className="rounded-pick-md border border-pick-border bg-primary/[0.06] px-3 py-2.5">
                    <p className="text-[13px] font-sans font-semibold text-foreground">Aide Pick à mieux te connaître</p>
                    <p className="mt-0.5 text-[12px] font-sans text-pick-text-secondary">
                      Indique ce que tu apprécies et ce que tu préfères éviter. Tu pourras toujours modifier ces choix.
                    </p>
                  </div>
                )}
                <LegendeEtats feminin={feminin} />
                {children}
              </div>
              {/* La barre d'onglets passe par-dessus : le bouton reste au-dessus d'elle. */}
              <div
                className="shrink-0 px-4 pt-3 border-t border-pick-border bg-pick-surface"
                style={{ paddingBottom: `calc(${bottomTabBarClearance} + 12px)` }}
              >
                <Button variant="hero" size="lg" className="w-full" onClick={onEnregistrer} disabled={enregistrement}>
                  {enregistrement ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppOverlayPortal>
  );
}
