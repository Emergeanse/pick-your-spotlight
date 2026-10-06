import type { LucideIcon } from "lucide-react";

/**
 * Icône à deux états de la charte Pick : le trait fin au repos, l'illustration
 * en verre violet quand l'élément est actif, survolé à la souris ou pressé.
 *
 * Le parent doit porter la classe `group`. Le survol est réservé aux souris
 * (`hover:hover`) : sur écran tactile, il resterait collé après l'appui.
 */
const ALLUME = "[@media(hover:hover)]:group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100";
const ETEINT = "[@media(hover:hover)]:group-hover:opacity-0 group-active:opacity-0 group-focus-visible:opacity-0";

interface IconeCharteProps {
  icon: LucideIcon;
  image: string;
  /** Classes du trait fin (taille, couleur). */
  iconClassName: string;
  /** Taille de l'illustration, un peu plus grande que le trait : elle a un halo. */
  imageClassName: string;
  /** Allumée en permanence (onglet sélectionné, panneau ouvert). */
  active?: boolean;
}

const IconeCharte = ({ icon: Icon, image, iconClassName, imageClassName, active = false }: IconeCharteProps) => (
  <span className="relative inline-flex items-center justify-center">
    <Icon className={`${iconClassName} transition-opacity duration-200 ${active ? "opacity-0" : `opacity-100 ${ETEINT}`}`} />
    <img
      src={image}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`absolute ${imageClassName} max-w-none pointer-events-none select-none transition-opacity duration-200 ${active ? "opacity-100" : `opacity-0 ${ALLUME}`}`}
    />
  </span>
);

export default IconeCharte;
