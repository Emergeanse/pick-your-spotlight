import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * Section du profil en menu déroulant : titre et résumé en une ligne quand
 * elle est repliée, tout le contenu quand on la déplie. L'état est retenu par
 * section sur l'appareil.
 */
interface SectionRepliableProps {
  id: string;
  titre: string;
  /** Une ligne de synthèse, visible repliée comme dépliée. */
  resume?: ReactNode;
  icone?: ReactNode;
  ouverteParDefaut?: boolean;
  children: ReactNode;
}

const cle = (id: string) => `pick_profil_section_${id}`;

function lireEtat(id: string, defaut: boolean): boolean {
  try {
    const v = localStorage.getItem(cle(id));
    return v === null ? defaut : v === "1";
  } catch {
    return defaut;
  }
}

const SectionRepliable = ({ id, titre, resume, icone, ouverteParDefaut = false, children }: SectionRepliableProps) => {
  const [ouverte, setOuverte] = useState(() => lireEtat(id, ouverteParDefaut));
  const basculer = () => {
    setOuverte((v) => {
      try { localStorage.setItem(cle(id), v ? "0" : "1"); } catch { /* stockage indisponible */ }
      return !v;
    });
  };

  return (
    <section className="rounded-pick-lg border border-pick-border bg-pick-surface/80 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouverte}
        aria-controls={`section-${id}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-180 ease-pick [@media(hover:hover)]:hover:bg-white/[0.02]"
      >
        {icone && <span className="shrink-0 w-9 h-9 rounded-full bg-primary/12 border border-pick-border flex items-center justify-center text-pick-purple-light">{icone}</span>}
        <span className="flex-1 min-w-0">
          <span className="block font-serif text-[18px] leading-tight text-foreground">{titre}</span>
          {resume && <span className="mt-0.5 block text-[12px] font-sans text-pick-text-secondary leading-snug truncate">{resume}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-pick-purple-light transition-transform duration-260 ease-pick ${ouverte ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {ouverte && (
          <motion.div
            id={`section-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default SectionRepliable;
