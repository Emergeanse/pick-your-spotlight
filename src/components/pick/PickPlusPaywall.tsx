/**
 * PickPlusPaywall — contextual bottom sheet + reusable paywall component.
 * Shows when a free user hits a limit.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, Brain, Bell, Wifi, Users, Crown, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PickPlusPaywallProps {
  open: boolean;
  onClose: () => void;
  trigger?: "reco_limit" | "companion_limit" | "dna_advanced" | "chat_limit" | "general";
}

const BENEFITS = [
  { icon: MessageCircle, label: "Chatbot complet Pick", desc: "Pose toutes tes questions ciné — acteurs, anecdotes, comparaisons…" },
  { icon: Zap, label: "Recommandations illimitées", desc: "Plus de limite de 3 par jour" },
  { icon: Brain, label: "Companion Mode complet", desc: "Questions illimitées + analyses approfondies" },
  { icon: Sparkles, label: "ADN Cinéma avancé", desc: "Évolution, comparaisons et rapport mensuel" },
  { icon: Bell, label: "Alertes plateforme", desc: "Sois notifié quand un film arrive sur tes plateformes" },
  { icon: Wifi, label: "Mode hors-ligne", desc: "Consulte ta Watchlist sans connexion" },
  { icon: Users, label: "Profils multiples", desc: "Un profil par personne dans le foyer" },
];

const TRIGGER_MESSAGES: Record<string, string> = {
  reco_limit: "Tu as utilisé tes 3 recommandations du jour.",
  companion_limit: "Tu as utilisé ta question gratuite pour ce film.",
  dna_advanced: "L'évolution de ton profil est une fonctionnalité Pick+.",
  chat_limit: "Tu as utilisé tes 3 messages du jour. Passe à Pick+ pour un chat illimité !",
  general: "Passe à Pick+ pour débloquer tout le potentiel de Pick.",
};

export default function PickPlusPaywall({ open, onClose, trigger = "general" }: PickPlusPaywallProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] max-h-[85vh] rounded-t-3xl bg-card border-t border-border/20 overflow-y-auto"
          >
            <div className="px-6 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-foreground/10 mx-auto mb-5" />

              {/* Close */}
              <button onClick={onClose} className="absolute top-5 right-5 text-foreground/30 hover:text-foreground/60 transition-colors">
                <X className="w-5 h-5" />
              </button>

              {/* Crown icon */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/25 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-gold" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-serif text-center text-foreground mb-2">Pick+</h2>
              <p className="text-center text-foreground/50 text-sm font-sans mb-6 max-w-xs mx-auto">
                {TRIGGER_MESSAGES[trigger]}
              </p>

              {/* Benefits */}
              <div className="space-y-3 mb-8">
                {BENEFITS.map((b) => (
                  <div key={b.label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <b.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-sans font-medium text-foreground">{b.label}</p>
                      <p className="text-xs font-sans text-foreground/40">{b.desc}</p>
                    </div>
                    <Check className="w-4 h-4 text-primary/50 mt-1 shrink-0" />
                  </div>
                ))}
              </div>

              {/* Pricing buttons */}
              <div className="space-y-3">
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
                <p className="text-center text-foreground/25 text-[11px] font-sans mt-2">
                  Bientôt disponible — Pick+ arrive très bientôt !
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
