import IconeCharte from "./IconeCharte";
import flecheRepos from "@/assets/icones/fleche-ronde-repos.webp";
import flecheActif from "@/assets/icones/fleche-ronde-actif.webp";

/**
 * Bouton flèche de la charte Pick : la flèche dans un rond de verre violet,
 * sombre au repos, lumineuse au survol et à l'appui. Vers la gauche, l'image
 * est simplement retournée. Remplace les ronds noirs à chevron blanc.
 *
 * Zone de toucher de 44 px, quelle que soit la taille du dessin.
 */
interface FlecheRondeProps {
  direction: "gauche" | "droite";
  onClick: () => void;
  label: string;
  disabled?: boolean;
  /** Taille du dessin (classes Tailwind), 44 px par défaut. */
  tailleClasse?: string;
}

const FlecheRonde = ({ direction, onClick, label, disabled = false, tailleClasse = "w-11 h-11" }: FlecheRondeProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="group relative shrink-0 min-w-11 min-h-11 flex items-center justify-center rounded-full active:scale-[0.94] transition-transform duration-120 ease-pick disabled:opacity-25 disabled:pointer-events-none"
  >
    <span className={`inline-flex ${direction === "gauche" ? "-scale-x-100" : ""}`}>
      <IconeCharte repos={flecheRepos} actif={flecheActif} className={tailleClasse} echelleActif={1.3} />
    </span>
  </button>
);

export default FlecheRonde;
