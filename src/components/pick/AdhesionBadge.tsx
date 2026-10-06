import { motion } from "framer-motion";
import { apparenceAdhesion, libelleAdhesion } from "@/lib/adhesion-label";
import gemme from "@/assets/adhesion-gemme.webp";

/**
 * Badge d'adhésion Pick : la gemme de verre avec, par-dessus, ce que Pick
 * pense du film puis le pourcentage — « Bon choix · 74 % ». Taille, éclat et
 * couleur suivent le score (voir apparenceAdhesion) : une faible adhésion se
 * voit d'un coup d'œil, avant même de lire.
 */
interface AdhesionBadgeProps {
  score: number | null;
  /** Largeur maximale en px ; la gemme rétrécit jusqu'à 80 % pour un score bas. */
  size?: number;
}

/** Proportions de l'image recadrée (320 × 298). */
const RATIO = 298 / 320;

export default function AdhesionBadge({ score, size = 104 }: AdhesionBadgeProps) {
  if (score == null) return null;
  const libelle = libelleAdhesion(score);
  const a = apparenceAdhesion(score);
  const filtre = `brightness(${a.luminosite}) saturate(${a.saturation}) hue-rotate(${a.teinte}deg)`;
  const lueur = (r: number, o: number) => `drop-shadow(0 0 ${r}px rgba(217,70,239,${o}))`;

  return (
    // Boîte de taille fixe : la mise en page ne bouge pas d'un film à l'autre,
    // seule la gemme grandit ou rétrécit à l'intérieur.
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: Math.round(size * RATIO) }}
      role="img"
      aria-label={`${libelle} : ${score} % d'adhésion`}
    >
      <motion.div
        initial={{ opacity: 0, scale: a.echelle * 0.8 }}
        animate={{ opacity: 1, scale: a.echelle }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative w-full h-full flex items-center justify-center text-center"
      >
        <motion.img
          src={gemme}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ filter: `${filtre} ${lueur(a.lueur.rayon, a.lueur.opacite)}` }}
          animate={a.pulse ? {
            filter: [
              `${filtre} ${lueur(a.lueur.rayon, a.lueur.opacite)}`,
              `${filtre} ${lueur(a.lueur.rayon + 8, a.lueur.opacite + 0.2)}`,
              `${filtre} ${lueur(a.lueur.rayon, a.lueur.opacite)}`,
            ],
          } : undefined}
          transition={a.pulse ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
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
    </div>
  );
}
