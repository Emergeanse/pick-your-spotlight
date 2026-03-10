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
      className="absolute top-0 left-0 z-30 p-4 md:p-6"
    >
      {showBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-serif text-lg tracking-wide">Pick</span>
        </button>
      ) : (
        <span className="font-serif text-xl tracking-wide text-foreground/80">
          Pick
        </span>
      )}
    </motion.div>
  );
};

export default BrandHeader;
