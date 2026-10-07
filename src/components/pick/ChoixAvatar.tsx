import { Check } from "lucide-react";
import { AVATARS, urlAvatarCharte } from "@/lib/avatars";

/**
 * Grille des avatars de la charte (profil, écran du prénom). Un toucher
 * choisit ; l'avatar choisi est entouré de violet.
 */
interface ChoixAvatarProps {
  valeur: string | null;
  onChoisir: (url: string) => void;
  /** Taille d'une vignette en pixels. */
  taille?: number;
  desactive?: boolean;
}

const ChoixAvatar = ({ valeur, onChoisir, taille = 56, desactive = false }: ChoixAvatarProps) => (
  <div className="grid grid-cols-4 gap-3 justify-items-center" role="radiogroup" aria-label="Choisir un avatar">
    {AVATARS.map((a) => {
      const url = urlAvatarCharte(a.id);
      const choisi = valeur === url;
      return (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={choisi}
          aria-label={a.label}
          disabled={desactive}
          onClick={() => onChoisir(url)}
          className={`relative rounded-full transition-[box-shadow,transform] duration-180 ease-pick active:scale-[0.94] disabled:opacity-50 ${
            choisi ? "ring-2 ring-pick-purple-light shadow-pick-active" : "ring-1 ring-pick-border [@media(hover:hover)]:hover:ring-pick-border-hover"
          }`}
          style={{ width: taille, height: taille }}
        >
          <img src={url} alt="" draggable={false} className="w-full h-full rounded-full object-cover select-none" />
          {choisi && (
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-pick-surface">
              <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default ChoixAvatar;
