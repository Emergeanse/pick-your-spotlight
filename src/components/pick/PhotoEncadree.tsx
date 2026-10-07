import { avatarAffiche } from "@/lib/avatars";
import { ECHELLE_CADRE } from "@/lib/cadres";

/** La photo de profil dans son cadre : le cadre derrière, la photo par-dessus. */
interface PhotoEncadreeProps {
  photo: string | null | undefined;
  cadre: string | undefined;
  /** Diamètre de la photo en pixels ; le cadre déborde de ECHELLE_CADRE. */
  taille: number;
}

const PhotoEncadree = ({ photo, cadre, taille }: PhotoEncadreeProps) => (
  <span className="relative inline-block" style={{ width: taille, height: taille }}>
    {cadre && (
      <img
        src={cadre}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none pointer-events-none select-none"
        style={{ width: taille * ECHELLE_CADRE, height: taille * ECHELLE_CADRE }}
      />
    )}
    <img src={avatarAffiche(photo)} alt="" draggable={false} className="relative w-full h-full rounded-full object-cover select-none" />
  </span>
);

export default PhotoEncadree;
