import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export interface StreamingPlatform {
  id: number;
  label: string;
  logo: string;
}

// Major streaming providers (TMDB provider IDs for FR region)
const platforms: StreamingPlatform[] = [
  { id: 8, label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, label: "Disney+", logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
  { id: 119, label: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg" },
  { id: 350, label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg" },
  { id: 381, label: "Canal+", logo: "https://image.tmdb.org/t/p/original/dVMVBMOlOUPFfbkSKNnTGg3JX5b.jpg" },
  { id: 56, label: "OCS", logo: "https://image.tmdb.org/t/p/original/3E0RkIEQrrGYazs63NMsn3XONT6.jpg" },
  { id: 236, label: "Paramount+", logo: "https://image.tmdb.org/t/p/original/fi83B1ozBIOCEo7cWoevSYS0tXi.jpg" },
  { id: 1899, label: "Max", logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg" },
];

interface PlatformStepProps {
  onSelect: (platformIds: number[]) => void;
  loading?: boolean;
  loadingMessage?: string;
}

const PlatformStep = ({ onSelect, loading, loadingMessage }: PlatformStepProps) => {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-3xl md:text-5xl font-serif mb-4 text-center"
      >
        Vos plateformes
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-muted-foreground text-sm font-sans mb-10 text-center"
      >
        Sélectionnez vos abonnements pour des suggestions adaptées
      </motion.p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 max-w-xl w-full mb-10">
        {platforms.map((platform, i) => {
          const isSelected = selected.includes(platform.id);
          return (
            <motion.button
              key={platform.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
              onClick={() => toggle(platform.id)}
              className={`relative bg-card rounded-2xl p-4 md:p-5 flex flex-col items-center gap-2.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                isSelected
                  ? "border-primary neon-glow"
                  : "border-transparent hover:border-primary/30"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <img
                src={platform.logo}
                alt={platform.label}
                className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover"
              />
              <span className="font-sans text-xs md:text-sm tracking-wide text-foreground/90">
                {platform.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="flex flex-col sm:flex-row gap-3 items-center"
      >
        <Button
          variant="hero"
          size="xl"
          onClick={() => onSelect(selected)}
          disabled={loading}
        >
          {loading && loadingMessage ? loadingMessage : selected.length === 0 ? "Peu importe" : "Valider"}
        </Button>
        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default PlatformStep;
