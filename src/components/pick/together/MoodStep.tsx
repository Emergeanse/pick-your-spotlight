import { motion } from "framer-motion";
import { Sparkles, CloudSun, Flame, Laugh, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Friend } from "./WhoStep";

const MOODS: { id: string; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  { id: "relax", label: "Détente", desc: "Tranquille, posé, feel-good", icon: CloudSun, color: "from-blue-500/15 to-sky-400/5" },
  { id: "excited", label: "Intensité", desc: "Suspense, action, adrénaline", icon: Flame, color: "from-orange-500/15 to-red-400/5" },
  { id: "fun", label: "Rire", desc: "Comédie, léger, fun", icon: Laugh, color: "from-yellow-500/15 to-amber-400/5" },
  { id: "romantic", label: "Émotion", desc: "Romance, drame, profond", icon: Heart, color: "from-pink-500/15 to-rose-400/5" },
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
    className="h-full overflow-y-auto pt-16 pb-[calc(8rem+env(safe-area-inset-bottom))] px-5"
  >
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 mt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary/15 border-2 border-background flex items-center justify-center z-10">
              <span className="text-[9px] font-bold text-primary">Toi</span>
            </div>
            {selectedFriends.slice(0, 3).map((f, i) => (
              <div key={f.id} className="w-8 h-8 rounded-full bg-card border-2 border-background flex items-center justify-center overflow-hidden" style={{ zIndex: 9 - i }}>
                {f.avatarUrl ? (
                  <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-[9px] font-bold text-foreground/40">{f.displayName[0]}</span>
                )}
              </div>
            ))}
            {selectedCount > 4 && (
              <div className="w-8 h-8 rounded-full bg-card border-2 border-background flex items-center justify-center">
                <span className="text-[9px] font-sans font-bold text-foreground/30">+{selectedCount - 4}</span>
              </div>
            )}
          </div>
          <span className="text-foreground/25 text-[11px] font-sans">{selectedCount} personnes</span>
        </div>

        <h2 className="text-2xl font-serif mb-1.5" style={{ lineHeight: "1.15" }}>
          Quelle ambiance<br />pour ce soir ?
        </h2>
        <p className="text-foreground/35 text-[13px] font-sans">Choisis une vibe ou laisse Pick décider</p>
      </motion.div>

      {/* Mood cards */}
      <div className="grid grid-cols-2 gap-3 mb-10">
        {MOODS.map((m, i) => {
          const selected = mood === m.id;
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSetMood(mood === m.id ? null : m.id)}
              className={`relative p-4 pb-5 rounded-2xl border text-left transition-all duration-300 overflow-hidden ${
                selected
                  ? "bg-primary/8 border-primary/30 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.25)]"
                  : "bg-card/40 border-border/10 hover:border-border/20"
              }`}
            >
              {/* Gradient bg */}
              <div className={`absolute inset-0 bg-gradient-to-br ${m.color} opacity-${selected ? "100" : "0"} transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors duration-300 ${
                  selected ? "bg-primary/15 border border-primary/25" : "bg-foreground/5 border border-border/10"
                }`}>
                  <Icon className={`w-5 h-5 transition-colors duration-300 ${selected ? "text-primary" : "text-foreground/30"}`} />
                </div>
                <span className={`text-sm font-sans font-semibold block mb-0.5 transition-colors ${selected ? "text-foreground" : "text-foreground/65"}`}>
                  {m.label}
                </span>
                <span className={`text-[11px] font-sans transition-colors ${selected ? "text-foreground/50" : "text-foreground/25"}`}>
                  {m.desc}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-5 space-y-3 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-4 pb-4"
      >
        <Button onClick={() => onStart(false)}
          className="w-full rounded-2xl h-14 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-[15px] font-medium neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
        >
          <Sparkles className="w-4 h-4" />Trouver le film parfait
        </Button>
        <button onClick={() => onStart(true)}
          className="w-full text-center text-foreground/25 text-xs font-sans hover:text-foreground/40 transition-colors py-2"
        >
          Passer — surprise totale
        </button>
      </motion.div>
    </div>
  </motion.div>
);

export default MoodStep;
