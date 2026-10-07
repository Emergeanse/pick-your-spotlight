import { useState } from "react";
import { toast } from "sonner";
import { distinctionsAffichees, epinglerDistinctions, NB_DISTINCTIONS_AFFICHEES, tropheeParCle } from "@/lib/distinctions";

/**
 * « Mes distinctions » dans l'ADN cinéma : trois trophées obtenus, présentés
 * comme des distinctions — jamais les verrouillés ni la progression, qui
 * restent dans le profil privé. Le propriétaire choisit les trois qu'il
 * épingle, comme son podium.
 */
interface DistinctionsProps {
  debloquees: string[];
  epinglees: string[];
  /** Propriétaire de l'ADN : peut choisir ses distinctions. */
  userId?: string;
  prenom?: string;
  onEpinglees?: (cles: string[]) => void;
}

function Medaille({ cle, actif = true, onClick }: { cle: string; actif?: boolean; onClick?: () => void }) {
  const t = tropheeParCle(cle);
  if (!t) return null;
  const contenu = (
    <>
      <span className={`relative block w-14 h-14 rounded-full transition-[box-shadow,opacity] duration-180 ease-pick ${actif ? "" : "opacity-45"}`}>
        {t.image && <img src={t.image} alt="" draggable={false} className="w-full h-full object-contain select-none" />}
      </span>
      <span className="mt-1.5 block max-w-[84px] text-center text-[11px] font-sans font-medium leading-tight text-foreground/80">{t.label}</span>
    </>
  );
  if (!onClick) return <div className="flex flex-col items-center">{contenu}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="flex flex-col items-center rounded-pick-md p-1 active:scale-[0.96] transition-transform duration-120 ease-pick"
    >
      {contenu}
    </button>
  );
}

const Distinctions = ({ debloquees, epinglees, userId, prenom, onEpinglees }: DistinctionsProps) => {
  const [toutes, setToutes] = useState(false);
  const [choix, setChoix] = useState<string[] | null>(null);
  const proprietaire = Boolean(userId);

  if (debloquees.length === 0) {
    if (!proprietaire) return null;
    return (
      <section>
        <Titre texte="Mes distinctions" />
        <p className="text-[12px] font-sans text-pick-text-muted">
          Tes premiers trophées apparaîtront ici, comme des distinctions que tes amis peuvent voir.
        </p>
      </section>
    );
  }

  const affichees = distinctionsAffichees(debloquees, epinglees);
  const autres = debloquees.filter((c) => !affichees.includes(c));

  // Choix des distinctions épinglées : toutes les obtenues, trois au plus.
  if (choix) {
    const basculer = (cle: string) => {
      setChoix((c) => {
        if (!c) return c;
        if (c.includes(cle)) return c.filter((x) => x !== cle);
        if (c.length >= NB_DISTINCTIONS_AFFICHEES) return [...c.slice(1), cle];
        return [...c, cle];
      });
    };
    const terminer = async () => {
      const cles = choix;
      setChoix(null);
      onEpinglees?.(cles);
      try { if (userId) await epinglerDistinctions(userId, cles); }
      catch { toast.error("Impossible d'enregistrer tes distinctions pour le moment."); }
    };
    return (
      <section>
        <div className="flex items-center justify-between mb-1">
          <Titre texte="Mes distinctions" />
          <button type="button" onClick={terminer} className="-my-2 py-2 text-[12px] font-sans font-semibold text-pick-purple-light">
            Terminé
          </button>
        </div>
        <p className="mb-3 text-[12px] font-sans text-pick-text-muted">
          Choisis jusqu'à {NB_DISTINCTIONS_AFFICHEES} distinctions à montrer ({choix.length}/{NB_DISTINCTIONS_AFFICHEES}).
        </p>
        <div className="grid grid-cols-4 gap-2">
          {debloquees.map((c) => (
            <Medaille key={c} cle={c} actif={choix.includes(c)} onClick={() => basculer(c)} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <Titre texte={proprietaire ? "Mes distinctions" : `Les distinctions de ${prenom || "ce Picker"}`} />
        {proprietaire && (
          <button
            type="button"
            onClick={() => setChoix(affichees)}
            className="-my-2 py-2 text-[12px] font-sans font-semibold text-pick-purple-light transition-opacity duration-120 ease-pick [@media(hover:hover)]:hover:opacity-80"
          >
            Choisir
          </button>
        )}
      </div>
      <div className="flex justify-center gap-5">
        {affichees.map((c) => <Medaille key={c} cle={c} />)}
      </div>
      {autres.length > 0 && (
        <>
          {toutes && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {autres.map((c) => <Medaille key={c} cle={c} />)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setToutes((v) => !v)}
            className="mt-3 w-full text-center text-[12px] font-sans text-pick-purple-light/80"
          >
            {toutes ? "Réduire" : `+ ${autres.length} autre${autres.length > 1 ? "s" : ""} distinction${autres.length > 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </section>
  );
};

function Titre({ texte }: { texte: string }) {
  return <p className="text-[11px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/50">{texte}</p>;
}

export default Distinctions;
