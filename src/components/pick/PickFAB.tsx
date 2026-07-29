import { motion, AnimatePresence } from "framer-motion";
import { useCompanion } from "@/contexts/CompanionContext";
import { useLocation } from "react-router-dom";
import { getDisplayTitle } from "@/lib/tmdb";
import squirrelImg from "@/assets/pick-squirrel.webp";

const HIDDEN_ROUTES = ["/onboarding", "/auth", "/"];

export default function PickFAB() {
  const { activeMovie, isOverlayOpen, openOverlay } = useCompanion();
  const location = useLocation();

  const isHidden = HIDDEN_ROUTES.includes(location.pathname) || isOverlayOpen;
  const isCompanion = !!activeMovie;
  const title = activeMovie ? getDisplayTitle(activeMovie) : "";

  // Truncate title for pill
  const shortTitle = title.length > 20 ? title.slice(0, 18) + "…" : title;

  if (isHidden) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.8 }}
        className="fixed z-50"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))", right: "1.5rem" }}
      >
        {/* Companion pill label */}
        <AnimatePresence>
          {isCompanion && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              className="absolute -top-9 right-0 whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 backdrop-blur-md border border-border/20 text-[11px] font-sans text-foreground/70 shadow-lg">
                <span>🎬</span>
                <span className="truncate max-w-[140px]">{shortTitle}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Button */}
        <button
          onClick={() => {
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(10);
            openOverlay();
          }}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_20px_hsl(var(--primary)/0.4)] transition-all active:scale-[0.96] ${
            isCompanion ? "fab-pulse" : ""
          }`}
          style={{ backgroundColor: "hsl(var(--primary))" }}
          aria-label="Parler à Pick"
        >
          <img
            src={squirrelImg}
            alt="Pick"
            className="w-8 h-8 rounded-full object-cover"
          />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
