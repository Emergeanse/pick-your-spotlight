import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuickGuest {
  id: string;
  name: string;
  hint?: string;
}

interface PromptStepProps {
  initialPrompt?: string;
  initialGuests?: QuickGuest[];
  loading?: boolean;
  onSubmit: (prompt: string, guests: QuickGuest[]) => void;
}

const PromptStep = ({ initialPrompt = "", initialGuests = [], loading, onSubmit }: PromptStepProps) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [guests, setGuests] = useState<QuickGuest[]>(initialGuests);
  const [guestName, setGuestName] = useState("");
  const [guestHint, setGuestHint] = useState("");

  const addGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    setGuests((g) => [...g, { id: crypto.randomUUID(), name, hint: guestHint.trim() || undefined }]);
    setGuestName("");
    setGuestHint("");
  };

  const removeGuest = (id: string) => setGuests((g) => g.filter((x) => x.id !== id));

  const canSubmit = prompt.trim().length > 4 && !loading;

  return (
    <motion.div
      key="prompt"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="min-h-full overflow-y-auto px-5 pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl md:text-3xl font-serif mb-2 leading-tight">
          Décris ta soirée
        </h1>
        <p className="text-foreground/45 text-[13px] font-sans mb-6">
          En une phrase. Pick s'occupe du reste.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Ex : trouve un film pour moi et Elisa pour ce soir, elle aime les comédies des années 80"
          className="w-full rounded-2xl bg-card border border-border/20 px-4 py-3 text-[14px] font-sans text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors resize-none"
          autoFocus
        />

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground/55 text-xs font-sans font-medium">Avec qui ?</span>
            <span className="text-foreground/30 text-[10px] font-sans">Prénom + (optionnel) un mot</span>
          </div>

          {guests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {guests.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[12px] font-sans"
                >
                  <span className="text-primary/90 font-medium">{g.name}</span>
                  {g.hint && <span className="text-primary/50">· {g.hint}</span>}
                  <button
                    onClick={() => removeGuest(g.id)}
                    className="w-5 h-5 rounded-full hover:bg-primary/20 flex items-center justify-center"
                    aria-label="Retirer"
                  >
                    <X className="w-3 h-3 text-primary/70" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuest())}
              placeholder="Prénom"
              className="flex-1 min-w-0 rounded-xl bg-card border border-border/20 px-3 py-2 text-[13px] font-sans focus:outline-none focus:border-primary/40"
            />
            <input
              value={guestHint}
              onChange={(e) => setGuestHint(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuest())}
              placeholder="comédies, sf…"
              className="flex-1 min-w-0 rounded-xl bg-card border border-border/20 px-3 py-2 text-[13px] font-sans focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={addGuest}
              className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 hover:bg-primary/25 flex items-center justify-center transition-colors"
              aria-label="Ajouter"
            >
              <UserPlus className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <Button
            onClick={() => onSubmit(prompt.trim(), guests)}
            disabled={!canSubmit}
            variant="hero"
            size="xl"
            className="w-full gap-2 font-sans text-[15px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Trouver le film
          </Button>
          <p className="text-center text-foreground/25 text-[10px] font-sans mt-3">
            Pick distingue ton envie du moment et les goûts durables de chacun.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default PromptStep;
