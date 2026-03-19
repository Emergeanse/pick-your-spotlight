import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import PickCharacter from "./PickCharacter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export interface StreamingPlatform {
  id: number;
  label: string;
  logo: string;
}

const platforms: StreamingPlatform[] = [
  { id: 8, label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, label: "Disney+", logo: "https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { id: 119, label: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { id: 350, label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg" },
  { id: 381, label: "Canal+", logo: "https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg" },
  { id: 236, label: "Paramount+", logo: "/logos/paramount-plus.png" },
  { id: 384, label: "HBO", logo: "/logos/hbo.png" },
  { id: 35, label: "Rakuten TV", logo: "https://image.tmdb.org/t/p/original/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg" },
  { id: 192, label: "YouTube", logo: "https://image.tmdb.org/t/p/original/pTnn5JwWr4p3pG8H6VrpiQo7Vs0.jpg" },
  { id: 283, label: "Crunchyroll", logo: "https://image.tmdb.org/t/p/original/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg" },
  { id: 2, label: "Apple TV", logo: "https://image.tmdb.org/t/p/original/SPnB1qiCkYfirS2it3hZORwGVn.jpg" },
  { id: 3, label: "Google Play", logo: "https://image.tmdb.org/t/p/original/8z7rC8uIDaTM91X0ZfkRf04ydj2.jpg" },
  { id: 1967, label: "Molotov TV", logo: "https://image.tmdb.org/t/p/original/8qSG9LtUhBQIWy2Fr6fzeW7gBdd.jpg" },
];

interface PlatformStepProps {
  onSelect: (platformIds: number[]) => void;
  loading?: boolean;
  loadingMessage?: string;
}

const PlatformStep = ({ onSelect, loading, loadingMessage }: PlatformStepProps) => {
  const [selected, setSelected] = useState<number[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_platforms").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.preferred_platforms && data.preferred_platforms.length > 0) {
          setSelected(data.preferred_platforms);
        }
      });
  }, [user]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0 overflow-y-auto">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <PickCharacter mood="think" message={loadingMessage || "Je cherche la perle parfaite…"} size="md" animate />
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center w-full"
          >
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-2xl md:text-5xl font-serif mb-3 md:mb-4 text-center"
            >
              Où tu regardes ?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="text-muted-foreground text-xs md:text-sm font-sans mb-6 md:mb-10 text-center"
            >
              Sélectionne tes abonnements pour des suggestions adaptées
            </motion.p>

            {/* 3 columns on mobile (44px+ touch targets), 4 on md+ */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-4 max-w-xl w-full mb-6 md:mb-10">
              {platforms.map((platform, i) => {
                const isSelected = selected.includes(platform.id);
                return (
                  <motion.button
                    key={platform.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
                    onClick={() => toggle(platform.id)}
                    className={`relative bg-card rounded-xl md:rounded-2xl p-3 md:p-5 flex flex-col items-center gap-2 md:gap-2.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border min-h-[72px] ${
                      isSelected
                        ? "border-primary neon-glow"
                        : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                    <img
                      src={platform.logo}
                      alt={platform.label}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover"
                    />
                    <span className="font-sans text-[10px] md:text-sm tracking-wide text-foreground/90 leading-tight text-center">
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
              className="flex flex-col sm:flex-row gap-3 items-center pb-4"
            >
              <Button
                variant="hero"
                size="xl"
                onClick={() => onSelect(selected)}
                disabled={loading}
              >
                {selected.length === 0 ? "Peu importe" : "Valider"}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlatformStep;
