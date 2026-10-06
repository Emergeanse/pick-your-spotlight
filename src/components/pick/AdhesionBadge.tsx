import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { intensiteAdhesion, libelleAdhesion } from "@/lib/adhesion-label";

/**
 * Badge d'adhésion Pick : une gemme de verre violet, « Très bon choix », et
 * le pourcentage. Remplace la noisette. Plus le score est haut, plus le verre
 * s'allume (lueur violette, puis touche magenta) ; un score bas reste sobre.
 */
interface AdhesionBadgeProps {
  score: number | null;
  /** Largeur en px (la hauteur suit). */
  size?: number;
}

export default function AdhesionBadge({ score, size = 104 }: AdhesionBadgeProps) {
  if (score == null) return null;
  const libelle = libelleAdhesion(score);
  const i = intensiteAdhesion(score);
  const h = Math.round(size * 0.92);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative flex flex-col items-center justify-center text-center select-none"
      style={{
        width: size,
        height: h,
        // Forme de gemme arrondie, plus large en bas.
        borderRadius: "46% 46% 42% 42% / 40% 40% 60% 60%",
        background: `radial-gradient(120% 90% at 50% 15%, rgba(167,139,250,${0.30 + 0.25 * i}) 0%, rgba(76,29,149,${0.55 + 0.2 * i}) 45%, rgba(18,16,27,0.92) 100%)`,
        border: `1px solid rgba(196,181,253,${0.25 + 0.45 * i})`,
        boxShadow: [
          `0 0 ${10 + 18 * i}px rgba(168,85,247,${0.15 + 0.35 * i})`,
          `0 0 ${24 + 26 * i}px rgba(217,70,239,${0.05 + 0.18 * i})`,
          "inset 0 1px 0 rgba(255,255,255,0.18)",
        ].join(", "),
      }}
      role="img"
      aria-label={`${libelle} : ${score} % d'adhésion`}
    >
      <Sparkles className="w-3 h-3 text-violet-200/90 mb-0.5" aria-hidden="true" />
      <span className="text-[11px] font-sans font-semibold leading-tight text-violet-200 px-2">{libelle}</span>
      <span className="mt-0.5 w-8 h-px bg-violet-200/30" aria-hidden="true" />
      <span className="mt-0.5 text-[22px] font-sans font-bold leading-none text-white tabular-nums">
        {score}
        <span className="text-[13px] font-semibold ml-0.5">%</span>
      </span>
    </motion.div>
  );
}
