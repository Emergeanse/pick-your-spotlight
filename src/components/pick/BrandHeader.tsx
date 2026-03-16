import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface BrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
}

const BrandHeader = ({ showBack, onBack }: BrandHeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="absolute top-0 left-0 right-0 z-30 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:p-6 flex items-center justify-between"
    >
      {showBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 md:gap-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-serif text-base md:text-lg tracking-wide">Prendre en Pick</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="font-serif text-lg md:text-xl tracking-wide text-foreground/80">
            Prendre en Pick
          </span>
        </div>
      )}

      <div />
    </motion.div>
  );
};

export default BrandHeader;
