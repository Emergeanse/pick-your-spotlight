import { motion } from "framer-motion";
import { Sparkles, Heart, Check, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParsedPickPrompt } from "@/lib/parse-prompt";

interface ReformulationStepProps {
  parsed: ParsedPickPrompt;
  loading?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

const ReformulationStep = ({ parsed, loading, onConfirm, onEdit }: ReformulationStepProps) => {
  const wish = parsed.sessionWish;
  const wishBits = [
    wish.summary,
    wish.genres.length ? wish.genres.join(", ") : null,
    wish.mood,
    wish.era,
    wish.maxDuration ? `${wish.maxDuration} min max` : null,
  ].filter(Boolean) as string[];

  const hints = parsed.participantHints.filter((h) => h.name);

  return (
    <motion.div
      key="reformulation"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="min-h-full overflow-y-auto px-5 pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl md:text-3xl font-serif mb-2 leading-tight">
          On est sur la bonne voie ?
        </h1>
        <p className="text-foreground/45 text-[13px] font-sans mb-6">
          Voici ce que Pick a compris.
        </p>

        {/* Envie du moment */}
        <section className="mb-4 rounded-2xl bg-card border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary text-[11px] font-sans font-semibold uppercase tracking-wide">
              Envie du moment
            </span>
            <span className="text-foreground/30 text-[10px] font-sans ml-auto">non mémorisé</span>
          </div>
          {wishBits.length > 0 ? (
            <p className="text-foreground/85 text-[14px] font-sans leading-relaxed">
              {wishBits.join(" · ")}
            </p>
          ) : (
            <p className="text-foreground/40 text-[13px] font-sans italic">
              Pas d'envie spécifique ce soir — Pick choisira large.
            </p>
          )}
        </section>

        {/* Goûts pris en compte */}
        <section className="mb-6 rounded-2xl bg-card border border-border/15 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-3.5 h-3.5 text-foreground/55" />
            <span className="text-foreground/65 text-[11px] font-sans font-semibold uppercase tracking-wide">
              Goûts pris en compte
            </span>
          </div>
          {hints.length > 0 ? (
            <ul className="space-y-2">
              {hints.map((h, i) => (
                <li key={i} className="text-[13px] font-sans">
                  <span className="text-foreground/90 font-medium">{h.name}</span>
                  <span className="text-foreground/50">
                    {h.genres.length > 0 ? ` · ${h.genres.join(", ")}` : ""}
                    {h.era ? ` · ${h.era}` : ""}
                    {h.notes ? ` · ${h.notes}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-foreground/40 text-[13px] font-sans italic">
              Aucun goût durable détecté — Pick s'appuiera sur les profils connus.
            </p>
          )}
        </section>

        <div className="flex gap-2">
          <Button
            onClick={onEdit}
            variant="ghost"
            size="lg"
            className="flex-1 gap-2 text-foreground/60"
            disabled={loading}
          >
            <Pencil className="w-4 h-4" />
            Préciser
          </Button>
          <Button
            onClick={onConfirm}
            variant="hero"
            size="lg"
            className="flex-[2] gap-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            C'est bon
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ReformulationStep;
