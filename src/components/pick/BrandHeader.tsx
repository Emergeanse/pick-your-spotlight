import { motion } from "framer-motion";
import { ArrowLeft, Users, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import NotificationBell from "./NotificationBell";

interface BrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  extraActions?: ReactNode;
}

const BrandHeader = ({ showBack, onBack, extraActions }: BrandHeaderProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="absolute top-0 left-0 right-0 z-30 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:p-6 flex items-center justify-between gap-2"
    >
      {showBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-serif text-xl md:text-2xl tracking-wide">Pick</span>
        </button>
      ) : (
        <button
          onClick={() => navigate("/app/profile")}
          className="active:scale-[0.98] transition-transform"
        >
          <span className="font-serif text-2xl md:text-3xl tracking-wide text-foreground leading-none">
            Pick
          </span>
        </button>
      )}

      <div className="flex items-center gap-1">
        {extraActions}
        <button
          onClick={() => navigate("/app/match")}
          className="relative w-11 h-11 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors active:scale-[0.96]"
          aria-label="Rechercher un film"
        >
          <Search className="w-[18px] h-[18px] text-foreground/40" />
        </button>
        <button
          onClick={() => navigate("/app/duo")}
          className="relative w-11 h-11 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors active:scale-[0.96]"
          aria-label="Mes amis & Duo"
        >
          <Users className="w-[18px] h-[18px] text-foreground/40" />
        </button>
        <NotificationBell />
      </div>
    </motion.div>
  );
};

export default BrandHeader;
