import { motion, AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";
import { getAutoPickSubtitle } from "@/lib/time-context";

interface HomeScreenChoiceModalProps {
  open: boolean;
  mediaType: "both" | "movie" | "tv";
  onClose: () => void;
  onAutoPick: () => void;
  onOpenChat: () => void;
}

const HomeScreenChoiceModal = ({
  open,
  mediaType,
  onClose,
  onAutoPick,
  onOpenChat,
}: HomeScreenChoiceModalProps) => {
  const title =
    mediaType === "movie"
      ? "Tu veux regarder un film ?"
      : mediaType === "tv"
        ? "Tu veux regarder une série ?"
        : "Tu veux regarder quelque chose ?";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-lg mx-4 mb-8 rounded-2xl bg-card border border-border/50 shadow-2xl p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-center text-base font-sans font-semibold text-foreground mb-1">
              {title}
            </h3>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onAutoPick}
              className="group w-full text-left rounded-xl p-4 bg-primary/10 border border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/25 border border-primary/40 flex items-center justify-center shrink-0">
                  <span className="text-lg">🍿</span>
                </div>
                <div>
                  <h4 className="text-sm font-sans font-semibold text-foreground">
                    Laisse-moi choisir pour toi !
                  </h4>
                  <p className="text-foreground/45 text-xs font-sans">
                    {getAutoPickSubtitle()}
                  </p>
                </div>
              </div>
            </motion.button>

            <motion.button
              data-tour="parle-a-pick"
              whileTap={{ scale: 0.97 }}
              onClick={onOpenChat}
              className="group w-full text-left rounded-xl p-4 bg-primary/10 border border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/25 border border-primary/40 flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-sans font-semibold text-foreground">
                    Décris-moi ce que tu voudrais !
                  </h4>
                  <p className="text-foreground/45 text-xs font-sans">
                    Dis-moi ce que tu veux ou comment tu te sens.
                  </p>
                </div>
              </div>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HomeScreenChoiceModal;
