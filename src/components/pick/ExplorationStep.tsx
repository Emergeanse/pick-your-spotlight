import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, Target, Telescope, Rocket } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface ExplorationStepProps {
  onSelect: (level: number) => void;
}

const labels = [
  { value: 0, label: "Mes classiques" },
  { value: 5, label: "Équilibré" },
  { value: 10, label: "Terre inconnue" },
];

const ExplorationStep = ({ onSelect }: ExplorationStepProps) => {
  const [level, setLevel] = useState(5);

  const getIcon = () => {
    if (level <= 2) return <Target className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
    if (level <= 5) return <Compass className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
    if (level <= 8) return <Telescope className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
    return <Rocket className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
  };

  const getDescription = () => {
    if (level <= 2) return "Des recommandations au plus près de tes goûts.";
    if (level <= 5) return "Un bon équilibre entre confort et découverte.";
    if (level <= 8) return "Des pépites hors de tes sentiers battus.";
    return "Prêt·e pour l'inconnu total ? Accroche-toi !";
  };

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8 md:mb-12"
      >
        <h2 className="text-2xl md:text-5xl font-serif mb-3 md:mb-4">
          Envie d'explorer ?
        </h2>
        <p className="text-muted-foreground text-sm md:text-base font-sans">
          Choisis à quel point tu veux sortir de ta zone de confort
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="max-w-md w-full bg-card rounded-2xl p-6 md:p-8 border border-transparent"
      >
        {/* Current level display */}
        <div className="text-center mb-6">
          <motion.div
            key={level}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex justify-center mb-3"
          >
            {getIcon()}
          </motion.div>
          <span className="text-primary font-serif text-2xl md:text-3xl font-bold">{level}</span>
          <span className="text-muted-foreground text-sm">/10</span>
        </div>

        {/* Slider */}
        <div className="px-2 mb-4">
          <Slider
            value={[level]}
            onValueChange={([v]) => setLevel(v)}
            min={0}
            max={10}
            step={1}
            className="w-full"
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground/60 font-sans mb-6 px-1">
          {labels.map((l) => (
            <span key={l.value}>{l.label}</span>
          ))}
        </div>

        {/* Description */}
        <motion.p
          key={level}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-muted-foreground text-sm font-sans mb-6"
        >
          {getDescription()}
        </motion.p>

        {/* Validate button */}
        <Button
          onClick={() => onSelect(level)}
          className="w-full rounded-xl h-12 text-base font-serif gap-2"
        >
          <Compass className="w-4 h-4" />
          C'est parti
        </Button>
      </motion.div>

      {/* Skip link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={() => onSelect(5)}
        className="mt-4 text-muted-foreground/40 text-xs font-sans hover:text-muted-foreground transition-colors"
      >
        Passer (équilibré par défaut)
      </motion.button>
    </div>
  );
};

export default ExplorationStep;
