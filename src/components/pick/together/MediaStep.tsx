import { motion } from "framer-motion";
import { Film, Tv, Layers, ChevronRight } from "lucide-react";

type MediaChoice = "movie" | "tv" | "both";

interface MediaStepProps {
  onSelect: (choice: MediaChoice) => void;
}

const OPTIONS: { value: MediaChoice; icon: React.ElementType; label: string; desc: string }[] = [
  { value: "movie", icon: Film, label: "Film", desc: "Long-métrage, cinéma" },
  { value: "tv", icon: Tv, label: "Série", desc: "Série, mini-série, docu" },
  { value: "both", icon: Layers, label: "Peu importe", desc: "Films et séries confondus" },
];

const MediaStep = ({ onSelect }: MediaStepProps) => (
  <motion.div key="media" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
    className="h-full overflow-y-auto pt-16 pb-[calc(4rem+env(safe-area-inset-bottom))] px-5"
  >
    <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh]">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-10"
      >
        <h2 className="text-2xl font-serif text-foreground mb-1.5" style={{ lineHeight: "1.15" }}>
          Vous cherchez quoi ?
        </h2>
        <p className="text-foreground/35 text-[13px] font-sans">Film, série, ou on verra</p>
      </motion.div>

      <div className="flex flex-col gap-2.5 w-full max-w-sm">
        {OPTIONS.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.value}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(opt.value)}
              className="group bg-card/50 backdrop-blur-sm rounded-2xl p-4 text-left border border-border/10 hover:border-primary/25 transition-all duration-200 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center group-hover:bg-primary/12 group-hover:border-primary/25 transition-all duration-200">
                <Icon className="w-5 h-5 text-primary/50 group-hover:text-primary/70 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-sans text-[15px] font-medium text-foreground block">{opt.label}</span>
                <span className="text-foreground/30 text-[11px] font-sans">{opt.desc}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/10 group-hover:text-foreground/25 transition-colors shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  </motion.div>
);

export default MediaStep;
export type { MediaChoice };
