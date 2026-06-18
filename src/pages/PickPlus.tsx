/**
 * /pick-plus — Dedicated Pick+ comparison page.
 */
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, X as XIcon, Sparkles, Zap, Brain, Bell, Wifi, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePickPlus } from "@/hooks/use-pick-plus";

const FEATURES = [
  { label: "Recommandation du soir", free: true, plus: true },
  { label: "Parle à Pick (1 reco/jour)", free: true, plus: true },
  { label: "ADN Cinéma de base", free: true, plus: true },
  { label: "Watchlist", free: true, plus: true },
  { label: "Liens vers les plateformes", free: true, plus: true },
  { label: "Companion Mode (1 question/film)", free: true, plus: true },
  { label: "Chatbot complet — tout demander", free: false, plus: true },
  { label: "Recommandations illimitées", free: false, plus: true },
  { label: "Companion Mode illimité", free: false, plus: true },
  { label: "ADN Cinéma avancé", free: false, plus: true },
  { label: "Alertes plateforme", free: false, plus: true },
  { label: "Mode hors-ligne", free: false, plus: true },
  { label: "Profils multiples", free: false, plus: true },
];

const PickPlusPage = () => {
  const navigate = useNavigate();
  const { isPremium } = usePickPlus();

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-serif text-lg">Pick+</span>
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 pb-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/25 flex items-center justify-center mx-auto mb-5">
            <Crown className="w-10 h-10 text-gold" />
          </div>
          <h1 className="text-3xl font-serif text-foreground mb-3">Pick+</h1>
          <p className="text-foreground/50 text-sm font-sans leading-relaxed max-w-sm mx-auto">
            Pick te fait économiser 20 minutes de scroll par soir — ça vaut bien 8 centimes par jour.
          </p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border/15 overflow-hidden mb-8"
        >
          {/* Table header */}
          <div className="grid grid-cols-[1fr_60px_60px] bg-card/60 border-b border-border/10 px-4 py-3">
            <span className="text-[11px] uppercase tracking-widest text-foreground/45 font-sans font-semibold">Fonctionnalité</span>
            <span className="text-[11px] uppercase tracking-widest text-foreground/45 font-sans font-semibold text-center">Gratuit</span>
            <span className="text-[11px] uppercase tracking-widest text-gold/70 font-sans font-semibold text-center">Pick+</span>
          </div>

          {/* Rows */}
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className={`grid grid-cols-[1fr_60px_60px] px-4 py-3 ${
                i < FEATURES.length - 1 ? "border-b border-border/5" : ""
              } ${!f.free ? "bg-gold/[0.02]" : ""}`}
            >
              <span className="text-sm font-sans text-foreground/70">{f.label}</span>
              <div className="flex justify-center">
                {f.free ? (
                  <Check className="w-4 h-4 text-primary/60" />
                ) : (
                  <XIcon className="w-4 h-4 text-foreground/40" />
                )}
              </div>
              <div className="flex justify-center">
                <Check className="w-4 h-4 text-gold" />
              </div>
            </div>
          ))}
        </motion.div>

        {/* Pricing */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
        >
          {isPremium ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20">
                <Crown className="w-4 h-4 text-gold" />
                <span className="text-sm font-sans font-semibold text-gold">Tu es Pick+</span>
              </div>
            </div>
          ) : (
            <>
              <Button
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-sans font-bold text-base gap-2 neon-glow"
                disabled
              >
                <Crown className="w-4 h-4" />
                Annuel — 29,99€/an
                <span className="text-xs font-normal opacity-70 ml-1">(-40%)</span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl border-border/30 text-foreground/70 font-sans font-medium text-sm"
                disabled
              >
                Mensuel — 3,99€/mois
              </Button>
              <p className="text-center text-foreground/45 text-[11px] font-sans mt-2">
                Bientôt disponible — Pick+ arrive très bientôt !
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PickPlusPage;
