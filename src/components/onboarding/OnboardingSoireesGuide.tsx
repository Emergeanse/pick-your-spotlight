import { motion } from "framer-motion";
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Heart, Home, Library, Loader2,
  Sparkles, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingSoireesGuideProps {
  onBack: () => void;
  onFinish: () => void;
  finishing?: boolean;
}

const MOCK_EVENTS = [
  {
    id: "solo",
    title: "Soirée Solo · ce soir",
    date: "Mar. 22 juin · 21:00",
    context: "solo" as const,
    status: "active",
  },
  {
    id: "duo",
    title: "Soirée Duo · samedi",
    date: "Sam. 28 juin · 20:30",
    context: "duo" as const,
    status: "planned",
  },
];

const CONTEXT_STYLE = {
  solo: { Icon: User, card: "bg-orange-400/10 border-orange-400/20", icon: "text-orange-400", label: "Solo" },
  duo: { Icon: Heart, card: "bg-pink-500/10 border-pink-500/20", icon: "text-pink-400", label: "Duo" },
};

export default function OnboardingSoireesGuide({ onBack, onFinish, finishing }: OnboardingSoireesGuideProps) {
  return (
    <div className="flex flex-col min-h-full px-5 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <h1 className="text-2xl md:text-3xl font-serif mb-2 max-w-lg">
        Retrouve tes soirées
      </h1>
      <p className="text-sm text-muted-foreground font-sans mb-5 max-w-lg leading-relaxed">
        Chaque session Solo ou Duo peut devenir une <strong className="text-foreground/75">soirée</strong> enregistrée.
        Tu les retrouves dans l&apos;onglet <strong className="text-primary">Soirées</strong>.
      </p>

      {/* Tab bar mock */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden mb-5 max-w-lg"
      >
        <div className="flex items-stretch justify-around h-14 px-2 border-b border-border/20 bg-background/40">
          {[
            { Icon: Home, label: "Accueil", active: false },
            { Icon: CalendarDays, label: "Soirées", active: true },
            { Icon: Library, label: "Biblio", active: false },
            { Icon: User, label: "Profil", active: false },
          ].map(({ Icon, label, active }) => (
            <div key={label} className="flex flex-col items-center justify-center flex-1 gap-0.5">
              <Icon className={`w-[18px] h-[18px] ${active ? "text-primary" : "text-foreground/35"}`} strokeWidth={active ? 2.2 : 1.7} />
              <span className={`text-[9px] font-sans ${active ? "text-primary font-semibold" : "text-foreground/35"}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 h-[2px] w-6 rounded-full bg-primary" />
              )}
            </div>
          ))}
        </div>

        <div className="p-4 space-y-2">
          <p className="text-[10px] font-sans uppercase tracking-widest text-foreground/40 mb-2">
            À venir — exemple
          </p>
          {MOCK_EVENTS.map((evt, i) => {
            const style = CONTEXT_STYLE[evt.context];
            const Icon = style.Icon;
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${style.card}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-black/20 ${style.icon}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-semibold text-foreground truncate">{evt.title}</p>
                  <p className="text-[10px] font-sans text-foreground/45">{evt.date}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground/30 shrink-0" />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <div className="space-y-3 max-w-lg mb-8">
        {[
          "Crée une soirée planifiée (date, Duo ou Solo, mode surprise ou vote).",
          "Ou laisse une session spontanée — elle apparaît aussi dans la liste.",
          "Reviens voir le film choisi, les votes et l'historique des soirées passées.",
        ].map((text, i) => (
          <div key={i} className="flex gap-2.5 text-xs font-sans text-foreground/55 leading-relaxed">
            <span className="text-primary shrink-0">→</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/25 bg-card/40 px-4 py-3 max-w-lg mb-6 flex gap-3">
        <CalendarDays className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs font-sans text-foreground/55 leading-relaxed">
          Tu peux aussi créer une soirée depuis l&apos;onglet Soirées via le bouton <strong className="text-foreground/75">+</strong> en haut à droite.
        </p>
      </div>

      <Button variant="hero" size="xl" className="w-full max-w-lg" onClick={onFinish} disabled={finishing}>
        {finishing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Un instant…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Explorer Pick
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
