/**
 * Mise en page commune aux textes légaux (/confidentialite, /conditions).
 *
 * Reprend le vocabulaire visuel de la page Confiance sans la refactorer : elle a
 * sa propre structure à icônes, ces pages-ci sont de la lecture suivie.
 */
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TmdbAttribution from "@/components/pick/TmdbAttribution";

export interface LegalSection {
  title: string;
  /** Paragraphes. Les tableaux imbriqués deviennent des listes à puces. */
  body: (string | string[])[];
}

interface LegalPageProps {
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
}

const LegalPage = ({ title, intro, updatedAt, sections }: LegalPageProps) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-serif text-lg">{title}</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 pb-24">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-serif text-foreground mb-3">{title}</h1>
          <p className="text-foreground/60 text-sm font-sans leading-relaxed">{intro}</p>
          <p className="text-foreground/35 text-xs font-sans mt-4">Dernière mise à jour : {updatedAt}</p>
        </motion.header>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <motion.section
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + i * 0.03 }}
            >
              <h2 className="text-lg font-serif text-foreground mb-2.5">{s.title}</h2>
              <div className="space-y-2.5">
                {s.body.map((block, j) =>
                  Array.isArray(block) ? (
                    <ul key={j} className="space-y-1.5 pl-1">
                      {block.map((li) => (
                        <li
                          key={li}
                          className="text-sm font-sans text-foreground/65 leading-relaxed flex gap-2.5"
                        >
                          <span aria-hidden="true" className="text-primary/50 shrink-0">—</span>
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j} className="text-sm font-sans text-foreground/65 leading-relaxed">
                      {block}
                    </p>
                  ),
                )}
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/10">
          <TmdbAttribution />
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
