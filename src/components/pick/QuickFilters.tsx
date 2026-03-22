import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Film, Tv, Clapperboard, Clock, RotateCcw } from "lucide-react";

export interface QuickFilterState {
  mediaType: "both" | "movie" | "tv";
  maxDuration: number | null; // in minutes, null = no limit
}

export interface ProfileDefaults {
  mediaType: "both" | "movie" | "tv";
  maxDuration: number | null;
}

const DURATION_OPTIONS = [
  { label: "Peu importe", value: null },
  { label: "< 1h30", value: 90 },
  { label: "< 2h", value: 120 },
  { label: "< 2h30", value: 150 },
] as const;

const MEDIA_OPTIONS = [
  { label: "Les deux", value: "both" as const, icon: Clapperboard },
  { label: "Films", value: "movie" as const, icon: Film },
  { label: "Séries", value: "tv" as const, icon: Tv },
] as const;

interface QuickFiltersProps {
  filters: QuickFilterState;
  onFiltersChange: (f: QuickFilterState) => void;
  profileDefaults?: ProfileDefaults;
}

const QuickFilters = ({ filters, onFiltersChange, profileDefaults }: QuickFiltersProps) => {
  const [open, setOpen] = useState(false);
  const hasActiveFilters = filters.mediaType !== "both" || filters.maxDuration !== null;

  const isOverridden = profileDefaults && (
    filters.mediaType !== profileDefaults.mediaType ||
    filters.maxDuration !== profileDefaults.maxDuration
  );

  const handleResetToProfile = () => {
    if (profileDefaults) {
      onFiltersChange({ mediaType: profileDefaults.mediaType, maxDuration: profileDefaults.maxDuration });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-foreground/5 transition-colors"
      >
        <SlidersHorizontal className="w-5 h-5 text-foreground/60" />
        {hasActiveFilters && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary"
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-card border border-border/20 shadow-xl overflow-hidden"
            >
              <div className="p-3.5 border-b border-border/10 flex items-center justify-between">
                <h3 className="font-sans font-semibold text-sm text-foreground">Filtres rapides</h3>
                <div className="flex items-center gap-2">
                  {isOverridden && (
                    <button
                      onClick={handleResetToProfile}
                      className="flex items-center gap-1 text-primary text-[11px] font-sans font-medium hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Profil
                    </button>
                  )}
                  {hasActiveFilters && (
                    <button
                      onClick={() => onFiltersChange({ mediaType: "both", maxDuration: null })}
                      className="text-foreground/40 text-[11px] font-sans font-medium hover:underline"
                    >
                      Tout effacer
                    </button>
                  )}
                </div>
              </div>

              {isOverridden && (
                <div className="px-3.5 pt-2">
                  <p className="text-[10px] font-sans text-primary/60 italic">Filtres modifiés par rapport au profil</p>
                </div>
              )}

              <div className="p-3.5 space-y-4">
                {/* Media type */}
                <div>
                  <p className="text-foreground/50 text-[11px] font-sans font-medium uppercase tracking-wider mb-2">Type</p>
                  <div className="flex gap-1.5">
                    {MEDIA_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = filters.mediaType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onFiltersChange({ ...filters, mediaType: opt.value })}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-sans font-medium transition-all active:scale-[0.97] ${
                            active
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-foreground/5 text-foreground/50 border border-transparent hover:bg-foreground/8"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration — only for movies */}
                {filters.mediaType !== "tv" && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3 h-3 text-foreground/40" />
                      <p className="text-foreground/50 text-[11px] font-sans font-medium uppercase tracking-wider">Durée max</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DURATION_OPTIONS.map((opt) => {
                        const active = filters.maxDuration === opt.value;
                        return (
                          <button
                            key={String(opt.value)}
                            onClick={() => onFiltersChange({ ...filters, maxDuration: opt.value })}
                            className={`py-2 rounded-lg text-[12px] font-sans font-medium transition-all active:scale-[0.97] ${
                              active
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "bg-foreground/5 text-foreground/50 border border-transparent hover:bg-foreground/8"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickFilters;