import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, User, Users, Sparkles, ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEMO_GENRE_EMOJI: Record<string, string> = {
  Comédie: "😄", Drame: "🎭", Thriller: "🔪", Fantastique: "✨", Histoire: "📜",
  Action: "💥", Romance: "💕", Animation: "🎨", Horreur: "👻", "Science-Fiction": "🚀",
  Aventure: "🗺️", Mystère: "🕵️", Crime: "🔫", Famille: "👨‍👩‍👧",
};

export type SoloLaunchChoice =
  | { mode: "genre"; genre: string }
  | { mode: "voice"; prompt: string }
  | { mode: "surprise" };

interface OnboardingSoloDemoProps {
  favoriteGenres: string[];
  onLaunch: (choice: SoloLaunchChoice) => void;
  onBack: () => void;
  saving?: boolean;
}

export default function OnboardingSoloDemo({
  favoriteGenres,
  onLaunch,
  onBack,
  saving = false,
}: OnboardingSoloDemoProps) {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(
    favoriteGenres[0] ?? null,
  );
  const [voicePrompt, setVoicePrompt] = useState("");
  const [showVoice, setShowVoice] = useState(false);

  const genreChips = favoriteGenres.slice(0, 6);

  return (
    <div className="flex flex-col min-h-full px-5 py-6">
      <div className="w-full max-w-lg mx-auto pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <h1 className="text-2xl md:text-3xl font-serif mb-2">Ton premier Solo</h1>
        <p className="text-sm text-muted-foreground font-sans mb-6 leading-relaxed">
          Sur l&apos;accueil, tu cliques sur <strong className="text-foreground/80">Solo</strong> puis tu
          précises un genre ou tu décris ton envie à la voix — Pick lance la recherche pour toi.
        </p>

        {/* Mini aperçu du modal Solo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/30 bg-card/80 p-4 mb-6 shadow-lg"
        >
          <p className="text-[10px] font-sans uppercase tracking-widest text-foreground/40 mb-3 text-center">
            Aperçu — comme sur l&apos;accueil
          </p>

          <div className="flex gap-2 justify-center mb-4">
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-sans font-semibold bg-primary/20 text-primary border border-primary/30">
              <User className="w-3.5 h-3.5" /> Solo
            </span>
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-sans text-foreground/35 border border-transparent">
              <Users className="w-3.5 h-3.5" /> Duo
            </span>
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-sans text-foreground/35 border border-transparent">
              <Users className="w-3.5 h-3.5" /> Groupe
            </span>
          </div>

          <p className="text-xs font-sans text-foreground/50 text-center mb-3">
            Choisis un genre ou décris ton mood
          </p>

          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {genreChips.map((g) => {
              const on = selectedGenre === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => { setSelectedGenre(g); setShowVoice(false); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-sans border transition-all ${
                    on
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-foreground/5 border-transparent text-foreground/60"
                  }`}
                >
                  {DEMO_GENRE_EMOJI[g] ?? "🎬"} {g}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowVoice((v) => !v)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-sans transition-all ${
              showVoice
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/30 text-foreground/70 hover:border-primary/20"
            }`}
          >
            <Mic className="w-4 h-4" />
            Décrire mon mood (voix ou texte)
          </button>

          {showVoice && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
              <textarea
                value={voicePrompt}
                onChange={(e) => setVoicePrompt(e.target.value)}
                placeholder="Ex : un thriller léger ce soir, pas trop long…"
                rows={2}
                className="w-full rounded-xl bg-background border border-border/30 px-3 py-2.5 text-sm font-sans resize-none outline-none focus:border-primary/40"
              />
              <p className="text-[10px] text-foreground/40 font-sans mt-1.5 text-center">
                Sur l&apos;app, le micro remplit ce champ automatiquement.
              </p>
            </motion.div>
          )}
        </motion.div>

        <div className="space-y-3">
          {showVoice && voicePrompt.trim().length > 4 ? (
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={saving}
              onClick={() => onLaunch({ mode: "voice", prompt: voicePrompt.trim() })}
            >
              <Sparkles className="w-4 h-4" />
              Lancer avec ma description
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : selectedGenre ? (
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={saving}
              onClick={() => onLaunch({ mode: "genre", genre: selectedGenre })}
            >
              <Sparkles className="w-4 h-4" />
              Lancer en {selectedGenre}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => onLaunch({ mode: "surprise" })}
          >
            Surprends-moi sans filtre
          </Button>
        </div>
      </div>
    </div>
  );
}
