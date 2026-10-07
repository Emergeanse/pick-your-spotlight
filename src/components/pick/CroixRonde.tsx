import { X } from "lucide-react";

/**
 * Bouton « fermer » de la charte Pick, pour les écrans posés par-dessus un
 * autre (« Ce soir », fiches plein écran) : même rond de verre violet que la
 * flèche ronde, sombre au repos, lumineux au survol et à l'appui. La charte
 * n'ayant pas d'illustration de croix, il est dessiné en CSS.
 *
 * Zone de toucher de 44 px.
 */
interface CroixRondeProps {
  onClick: () => void;
  label?: string;
}

const CroixRonde = ({ onClick, label = "Fermer" }: CroixRondeProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="group relative w-11 h-11 shrink-0 flex items-center justify-center rounded-full active:scale-[0.94] transition-transform duration-120 ease-pick"
  >
    <span
      aria-hidden="true"
      className="absolute inset-0.5 rounded-full border border-violet-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-180 ease-pick
        bg-[radial-gradient(circle_at_35%_25%,rgba(139,92,246,0.45),rgba(30,16,60,0.92)_70%)]
        [@media(hover:hover)]:group-hover:border-violet-300/70 [@media(hover:hover)]:group-hover:shadow-[0_0_14px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.2)]
        group-active:border-violet-300/70 group-active:shadow-[0_0_14px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.2)]"
    />
    <X
      className="relative w-[18px] h-[18px] text-violet-200 transition-colors duration-180 ease-pick [@media(hover:hover)]:group-hover:text-white group-active:text-white"
      strokeWidth={2.4}
      aria-hidden="true"
    />
  </button>
);

export default CroixRonde;
