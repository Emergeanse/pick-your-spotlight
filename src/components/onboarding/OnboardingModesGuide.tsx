import { motion } from "framer-motion";
import { ArrowRight, Heart, Home, Plus, User, Users, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";

interface OnboardingModesGuideProps {
  onContinue: () => void;
}

const STEPS = [
  {
    n: 1,
    title: "Lance une soirée depuis l'accueil",
    body: "Appuie sur le bouton + au centre, ou choisis un raccourci Solo / Duo.",
  },
  {
    n: 2,
    title: "Précise ton envie",
    body: "Genre, mood à la voix, ou laisse Pick te surprendre — comme pour une vraie soirée.",
  },
  {
    n: 3,
    title: "Swipe tes propositions",
    body: "Like, passe, déjà vu… Pick affine tes goûts à chaque session.",
  },
];

export default function OnboardingModesGuide({ onContinue }: OnboardingModesGuideProps) {
  return (
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">Une soirée Solo ou Duo</h1>
      <p className="text-sm text-muted-foreground font-sans mb-6 leading-relaxed">
        Pick t&apos;aide à trouver le film — seul ou à deux. Voici comment ça marche sur l&apos;accueil.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/30 bg-card/70 p-4 mb-5 shadow-lg"
      >
        <p className="text-[10px] font-sans uppercase tracking-widest text-foreground/40 mb-3 text-center">
          Aperçu — écran d&apos;accueil
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-amber-400/40 bg-amber-400/10">
            <WandSparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-sans font-semibold text-amber-400">Surprise solo</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-violet-400/40 bg-violet-400/10">
            <Heart className="w-4 h-4 text-violet-400" />
            <span className="text-[10px] font-sans font-semibold text-violet-400">Soirée Duo</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-rose-400/40 bg-rose-400/10">
            <Home className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-sans font-semibold text-rose-400">Famille</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-sans font-semibold text-emerald-400">Entre amis</span>
          </div>
        </div>

        <div className="relative flex justify-center pt-2 pb-1">
          <div className="absolute -top-1 w-14 h-14 rounded-full bg-gradient-to-b from-primary to-accent shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.6)] flex items-center justify-center border-2 border-background">
            <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
        </div>
        <p className="text-[10px] text-center font-sans text-foreground/45 mt-8">
          Le + ouvre le même choix Solo / Duo / Groupe
        </p>
      </motion.div>

      <div className="space-y-3 mb-8">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex gap-3 rounded-xl border border-border/25 bg-card/40 px-4 py-3"
          >
            <span className="shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-sans font-bold flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <p className="text-sm font-sans font-semibold text-foreground/90">{s.title}</p>
              <p className="text-xs font-sans text-foreground/50 mt-0.5 leading-relaxed">{s.body}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-6 flex gap-3">
        <User className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs font-sans text-foreground/60 leading-relaxed">
          <strong className="text-foreground/80">Solo</strong> = tes goûts uniquement.
          {" "}<strong className="text-foreground/80">Duo</strong> = Pick croise vos deux profils pour un film qui vous convient à tous les deux.
        </p>
      </div>

      <Button variant="hero" size="xl" className="w-full" onClick={onContinue}>
        Et après, où les retrouver ? <ArrowRight className="w-4 h-4" />
      </Button>
    </OnboardingStepLayout>
  );
}
