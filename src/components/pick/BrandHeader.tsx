import { motion } from "framer-motion";
import { ArrowLeft, User, LogOut, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showDiscoveryToggle?: boolean;
  onToggleDiscovery?: () => void;
  discoveryOpen?: boolean;
}

const BrandHeader = ({ showBack, onBack, showDiscoveryToggle, onToggleDiscovery, discoveryOpen }: BrandHeaderProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="absolute top-0 left-0 right-0 z-30 p-3 md:p-6 flex items-center justify-between"
    >
      {showBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 md:gap-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-serif text-base md:text-lg tracking-wide">Pick</span>
        </button>
      ) : (
        <span className="font-serif text-lg md:text-xl tracking-wide text-foreground/80">
          Pick
        </span>
      )}

      <div className="flex items-center gap-1">
        {showDiscoveryToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDiscovery}
            className="text-foreground/50 hover:text-foreground text-xs font-sans gap-1"
            title={discoveryOpen ? "Masquer découvertes" : "Voir découvertes"}
          >
            {discoveryOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </Button>
        )}

        {user ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className="text-foreground/50 hover:text-foreground text-xs font-sans gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              Profil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-foreground/50 hover:text-foreground text-xs font-sans gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/auth")}
            className="text-foreground/50 hover:text-foreground text-xs font-sans gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            Connexion
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default BrandHeader;
