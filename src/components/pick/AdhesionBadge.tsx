import { motion } from "framer-motion";
import { intensiteAdhesion, libelleAdhesion } from "@/lib/adhesion-label";
import gemme from "@/assets/adhesion-gemme.webp";

/**
 * Badge d'adhésion Pick : la gemme de verre (illustration fournie) avec, par-
 * dessus, ce que Pick pense du film puis le pourcentage — « Bon choix · 74 % ».
 * Remplace la noisette. Plus le score est haut, plus la gemme brille ; un
 * score bas la laisse plus terne.
 */
interface AdhesionBadgeProps {
  score: number | null;
  /** Largeur en px (la hauteur suit les proportions de l'image). */
  size?: number;
}

/** Proportions de l'image recadrée (320 × 298). */
const RATIO = 298 / 320;

export default function AdhesionBadge({ score, size = 104 }: AdhesionBadgeProps) {
  if (score == null) return null;
  const libelle = libelleAdhesion(score);
  const i = intensiteAdhesion(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative flex items-center justify-center text-center select-none"
      style={{ width: size, height: Math.round(size * RATIO) }}
      role="img"
      aria-label={`${libelle} : ${score} % d'adhésion`}
    >
      <img
        src={gemme}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          filter: `brightness(${0.7 + 0.45 * i}) saturate(${0.6 + 0.6 * i}) drop-shadow(0 0 ${4 + 12 * i}px rgba(217,70,239,${0.1 + 0.35 * i}))`,
        }}
      />
      {/* Texte légèrement sous le centre : la gemme est plus large en bas. */}
      <span className="relative mt-[8%] flex flex-col items-center leading-none">
        <span className="text-[11px] font-sans font-semibold text-violet-100 px-3" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
          {libelle}
        </span>
        <span className="mt-1 text-[22px] font-sans font-bold text-white tabular-nums" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.85)" }}>
          {score}
          <span className="text-[13px] font-semibold ml-0.5">%</span>
        </span>
      </span>
    </motion.div>
  );
}
