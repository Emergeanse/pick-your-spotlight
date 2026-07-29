import { motion } from "framer-motion";
import { ArrowLeft, Users, Search, Star, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import pickLogo from "@/assets/pick-logo.webp";
import NotificationBell from "./NotificationBell";

interface BrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  extraActions?: ReactNode;
  avatarUrl?: string | null;
  firstName?: string;
  isPremium?: boolean;
  interactionCount?: number;
}

const BrandHeader = ({ showBack, onBack, extraActions, avatarUrl, firstName, isPremium, interactionCount }: BrandHeaderProps) => {
  const navigate = useNavigate();

  const userInfo = (
    <div className="flex items-center gap-1.5 ml-2">
      <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-white/15 bg-primary/20 flex items-center justify-center shrink-0">
        {avatarUrl
          ? <img src={avatarUrl} alt={firstName} className="w-full h-full object-cover" />
          : <span className="text-[9px] font-bold text-primary leading-none">{(firstName || "?").charAt(0).toUpperCase()}</span>
        }
      </div>
      {isPremium && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-[2px] rounded-md bg-primary text-primary-foreground text-[9px] font-bold leading-none">
          <Crown className="h-2 w-2" strokeWidth={3} />
          Pick+
        </span>
      )}
      {interactionCount != null && interactionCount > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-foreground/50">
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
          <span className="tabular-nums">{interactionCount}</span>
          <span>films</span>
        </span>
      )}
    </div>
  );

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
          <img src={pickLogo} alt="Pick" className="h-[57px] md:h-[68px] w-auto object-contain" />
        </button>
      ) : (
        <div className="flex items-center">
          <button
            onClick={() => navigate("/app/profile")}
            className="active:scale-[0.98] transition-transform"
          >
            <img src={pickLogo} alt="Pick" className="h-[62px] md:h-[75px] w-auto object-contain" />
          </button>
          {userInfo}
        </div>
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
