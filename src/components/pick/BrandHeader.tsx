import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import pickLogo from "@/assets/pick-logo.webp";
import pickLogoGland from "@/assets/pick-logo-gland.webp";
import NotificationBell from "./NotificationBell";

interface BrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  extraActions?: ReactNode;
  /**
   * Accueil : largeur (px) laissée libre à droite pour l'avatar, posé par
   * l'écran. Les icônes se centrent alors entre le logo et lui, tout en haut.
   */
  reserveDroite?: number;
}

const BrandHeader = ({ showBack, onBack, extraActions, reserveDroite }: BrandHeaderProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`absolute top-0 left-0 right-0 z-30 p-3 md:p-6 flex items-center justify-between gap-2 ${reserveDroite ? "pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-4" : "pt-[calc(0.75rem+env(safe-area-inset-top))]"}`}
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
        // L'avatar, le prénom et le compteur de films vivent sous l'en-tête
        // (voir HomeScreen) : sur cette ligne, ils écrasaient le logo à 1,6 px
        // de large sur un écran de 360 px.
        <div className="flex items-center shrink-0">
          <button
            onClick={() => navigate("/app/profile")}
            className="ml-[6px] md:ml-[8px] active:scale-[0.98] transition-transform shrink-0"
            aria-label="Pick"
          >
            {/* Le logo doré, le gland en point du « i » ; aligné sur « Bonsoir ». */}
            <img src={pickLogoGland} alt="" aria-hidden="true" className="h-[36px] md:h-[40px] w-auto max-w-none drop-shadow-[0_2px_10px_rgba(229,194,107,0.25)]" />
          </button>
        </div>
      )}

      {/* Boutons de 44 px, même construction : les icônes s'alignent
          au pixel. Tailles ajustées pour une même hauteur de dessin visible
          (~22 px), chaque image ne remplissant pas son cadre de la même façon. */}
      <div className={reserveDroite ? "flex-1 flex items-center justify-end pr-1" : "flex items-center gap-1"}>
        {extraActions}
        {/* La recherche est sur l'accueil (sous « Trouve-moi LE film »), les amis
            dans la barre du bas. */}
        <NotificationBell />
      </div>
      {reserveDroite ? <div aria-hidden="true" className="shrink-0" style={{ width: reserveDroite }} /> : null}
    </motion.div>
  );
};

export default BrandHeader;
