import { motion } from "framer-motion";
import { Sparkles, Wind, Flame, Laugh, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import PickCharacter from "@/components/pick/PickCharacter";
import type { Friend } from "./WhoStep";

const MOODS: { id: string; label: string; emoji: string }[] = [
  { id: "relax", label: "On veut se détendre", emoji: "😌" },
  { id: "excited", label: "Quelque chose d'intense", emoji: "🔥" },
  { id: "fun", label: "On veut rigoler", emoji: "😂" },
  { id: "romantic", label: "Un moment émotion", emoji: "💕" },
];

interface MoodStepProps {
  mood: string | null;
  onSetMood: (mood: string | null) => void;
  onStart: (skipMood?: boolean) => void;
  selectedCount: number;
  selectedFriends: Friend[];
}

const MoodStep = ({ mood, onSetMood, onStart, selectedCount, selectedFriends }: MoodStepProps) => (
  <motion.div key="mood" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
    className="h-full overflow-y-auto pt-16 pb-8 px-5"
  >
    <div className="max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 mt-4">
        <PickCharacter mood="default" size="sm" animate={false} />
        <div className="mt-4 bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/10 relative">
          <div className="absolute -top-2 left-8 w-4 h-4 bg-card/60 border-l border-t border-border/10 rotate-45" />
          <p className="text-foreground text-[15px] font-sans leading-relaxed">
            Parfait, vous êtes {selectedCount} ! 🎬<br />
            <span className="text-foreground/60">C'est quoi l'ambiance ce soir ?</span>
          </p>
        </div>
      </motion.div>

      {/* Group avatars */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center z-10">
            <span className="text-[9px] font-bold text-primary">Toi</span>
          </div>
          {selectedFriends.slice(0, 4).map((f, i) => (
            <div key={f.id} className="w-7 h-7 rounded-full bg-card border-2 border-background flex items-center justify-center" style={{ zIndex: 9 - i }}>
              {f.avatarUrl ? (
                <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-foreground/50">{f.displayName[0]}</span>
              )}
            </div>
          ))}
        </div>
        <span className="text-foreground/30 text-[11px] font-sans">{selectedCount} personnes</span>
      </div>

      {/* Mood cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {MOODS.map((m, i) => {
          const selected = mood === m.id;
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSetMood(mood === m.id ? null : m.id)}
              className={`relative p-4 rounded-2xl border text-left transition-all duration-200 ${
                selected
                  ? "bg-primary/10 border-primary/30 shadow-[0_0_25px_-5px_hsl(var(--primary)/0.3)]"
                  : "bg-card/40 border-border/10 hover:border-border/25"
              }`}
            >
              <span className="text-2xl mb-2 block">{m.emoji}</span>
              <span className={`text-sm font-sans font-medium block transition-colors ${selected ? "text-foreground" : "text-foreground/70"}`}>
                {m.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button onClick={() => onStart(false)}
          className="w-full rounded-2xl h-14 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-base neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
        >
          <Sparkles className="w-4 h-4" />Trouver le film parfait
        </Button>
        <button onClick={() => onStart(true)}
          className="w-full text-center text-foreground/30 text-xs font-sans hover:text-foreground/50 transition-colors py-2"
        >
          Passer — surprise totale
        </button>
      </div>
    </div>
  </motion.div>
);

export default MoodStep;
