import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClarifyStepProps {
  question: string;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
}

const ClarifyStep = ({ question, onAnswer, onSkip }: ClarifyStepProps) => {
  const [value, setValue] = useState("");

  return (
    <motion.div
      key="clarify"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="h-full flex flex-col px-5 pt-20 pb-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      <div className="max-w-md mx-auto w-full flex-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <AlertCircle className="w-3.5 h-3.5 text-primary" />
          <span className="text-primary text-[11px] font-sans font-semibold">Une précision</span>
        </div>
        <h2 className="text-xl md:text-2xl font-serif mb-6 leading-snug">{question}</h2>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value.trim() && onAnswer(value.trim())}
          placeholder="Réponds en quelques mots…"
          className="w-full rounded-xl bg-card border border-border/20 px-4 py-3 text-[14px] font-sans focus:outline-none focus:border-primary/50"
          autoFocus
        />
      </div>

      <div className="max-w-md mx-auto w-full flex gap-2">
        <Button onClick={onSkip} variant="ghost" size="lg" className="flex-1 text-foreground/60">
          Passer
        </Button>
        <Button
          onClick={() => onAnswer(value.trim())}
          disabled={!value.trim()}
          variant="hero"
          size="lg"
          className="flex-[2] gap-2"
        >
          Continuer <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default ClarifyStep;
