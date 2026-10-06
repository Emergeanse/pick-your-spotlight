/**
 * Icône à deux états de la charte Pick : l'illustration en verre sombre au
 * repos, la même en verre violet lumineux quand l'élément est actif, survolé
 * à la souris ou pressé. Les deux images partagent le même cadrage : le fondu
 * de l'une à l'autre ne fait pas bouger le dessin.
 *
 * Le parent doit porter la classe `group`. Le survol est réservé aux souris
 * (`hover:hover`) : sur écran tactile, il resterait collé après l'appui.
 */
const ALLUME = "[@media(hover:hover)]:group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100";
const ETEINT = "[@media(hover:hover)]:group-hover:opacity-0 group-active:opacity-0 group-focus-visible:opacity-0";

interface IconeCharteProps {
  /** Illustration au repos. */
  repos: string;
  /** Illustration active. */
  actif: string;
  /** Taille commune aux deux images. */
  className: string;
  /** Allumée en permanence (onglet sélectionné, panneau ouvert). */
  active?: boolean;
  /**
   * Agrandissement de l'image active, quand sa lueur plus large rend le dessin
   * plus petit dans le même cadre (flèche ronde : 73 px opaques contre 95, d'où 1,3) : le dessin ne doit pas
   * rétrécir en s'allumant.
   */
  echelleActif?: number;
}

const IconeCharte = ({ repos, actif, className, active = false, echelleActif }: IconeCharteProps) => {
  const image = `${className} max-w-none pointer-events-none select-none transition-opacity duration-200`;
  return (
    <span className="relative inline-flex items-center justify-center">
      <img src={repos} alt="" aria-hidden="true" draggable={false} className={`${image} ${active ? "opacity-0" : `opacity-100 ${ETEINT}`}`} />
      <img src={actif} alt="" aria-hidden="true" draggable={false} className={`absolute ${image} ${active ? "opacity-100" : `opacity-0 ${ALLUME}`}`} style={echelleActif ? { transform: `scale(${echelleActif})` } : undefined} />
    </span>
  );
};

export default IconeCharte;
