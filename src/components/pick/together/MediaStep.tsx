import { motion } from "framer-motion";
import { Film, Tv, Layers } from "lucide-react";

type MediaChoice = "movie" | "tv" | "both";

interface MediaStepProps {
  onSelect: (choice: MediaChoice) => void;
}

const OPTIONS: { value: MediaChoice; icon: React.ElementType; label: string; desc: string }[] = [
  { value: "movie", icon: Film, label: "Un film", desc: "Long-métrage" },
  { value: "tv", icon: Tv, label: "Une série", desc: "Série ou documentaire" },
  { value: "both", icon: Layers, label: "Peu importe", desc: "Films et séries" },
];

const MediaStep = ({ onSelect }: MediaStepProps) => (
  <motion.div key="media" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
    className="h-full overflow-y-auto pt-16 pb-8 px-5"
  >
    <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <h2 className="text-2xl md:text-4xl font-serif text-foreground mb-2">Vous cherchez quoi ?</h2>
        <p className="text-foreground/40 text-sm font-sans">Film, série, ou les deux ?</p>
      </motion.div>

      <div className="flex flex-col gap-3 w-full max-w-md">
        {OPTIONS.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.value}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(opt.value)}
              className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 text-left border border-border/10 hover:border-primary/30 transition-all flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary/60" />
              </div>
              <div>
                <span className="font-serif text-lg text-foreground block">{opt.label}</span>
                <span className="text-foreground/40 text-xs font-sans">{opt.desc}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  </motion.div>
);

export default MediaStep;
export type { MediaChoice };
