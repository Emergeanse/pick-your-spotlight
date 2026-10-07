import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { changerVisibiliteAdn, lireAdnVisible, type VisibiliteAdn } from "@/lib/adn-public";

/**
 * « Qui voit mon ADN cinéma ? » — Profil > Compte.
 * Par défaut : ADN complet pour les amis, version allégée (sans chiffres) pour
 * les personnes croisées en soirée.
 */
const OPTIONS: { valeur: VisibiliteAdn; libelle: string; detail: string }[] = [
  { valeur: "amis_et_soirees", libelle: "Amis et soirées", detail: "Complet pour tes amis, allégé pour qui partage une soirée avec toi" },
  { valeur: "amis", libelle: "Amis seulement", detail: "Personne d'autre ne le voit" },
  { valeur: "moi", libelle: "Moi seulement", detail: "Ton ADN reste privé" },
];

const ReglageVisibiliteAdn = () => {
  const { user } = useAuth();
  const [valeur, setValeur] = useState<VisibiliteAdn | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    lireAdnVisible(user.id).then((v) => setValeur(v?.visibilite ?? "amis_et_soirees"));
  }, [user?.id]);

  if (!user || !valeur) return null;

  const choisir = async (v: VisibiliteAdn) => {
    const avant = valeur;
    setValeur(v);
    try {
      await changerVisibiliteAdn(user.id, v);
    } catch {
      setValeur(avant);
      toast.error("Ouvre d'abord ton ADN cinéma une fois, puis réessaie.");
    }
  };

  return (
    <div className="px-3 py-2.5">
      <p className="text-[13px] font-sans font-medium text-foreground/80">Qui voit mon ADN cinéma</p>
      <div className="mt-2 flex flex-col gap-1.5" role="radiogroup" aria-label="Qui voit mon ADN cinéma">
        {OPTIONS.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={valeur === o.valeur}
            onClick={() => choisir(o.valeur)}
            className={`text-left rounded-pick-md border px-3 py-2 transition-colors duration-180 ease-pick ${
              valeur === o.valeur ? "border-pick-border-active bg-primary/15" : "border-pick-border"
            }`}
          >
            <span className={`block text-[13px] font-sans font-semibold ${valeur === o.valeur ? "text-pick-purple-light" : "text-foreground/85"}`}>{o.libelle}</span>
            <span className="block text-[11px] font-sans text-pick-text-muted">{o.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReglageVisibiliteAdn;
