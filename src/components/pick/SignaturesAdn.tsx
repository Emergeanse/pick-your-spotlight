import type { LucideIcon } from "lucide-react";
import { Brain, Flame, Heart, Laugh, Moon, Mountain, Orbit, Search, Skull, Sparkles, Sun, Zap } from "lucide-react";
import type { Signature, SignatureId } from "@/lib/signatures";

/**
 * Pastilles des signatures de l'ADN : fond sombre identique pour toutes,
 * icône colorée et bordure teintée, texte clair. La couleur reste discrète.
 */
const STYLE: Record<SignatureId, { Icon: LucideIcon; couleur: string }> = {
  dark: { Icon: Moon, couleur: "167 139 250" },
  slowburn: { Icon: Flame, couleur: "244 114 182" },
  epique: { Icon: Mountain, couleur: "232 184 92" },
  sf: { Icon: Orbit, couleur: "96 165 250" },
  feelgood: { Icon: Sun, couleur: "250 204 21" },
  sensible: { Icon: Heart, couleur: "244 114 182" },
  adrenaline: { Icon: Zap, couleur: "251 146 60" },
  reveur: { Icon: Sparkles, couleur: "196 181 253" },
  cerebral: { Icon: Brain, couleur: "103 232 249" },
  frissons: { Icon: Skull, couleur: "248 113 113" },
  rire: { Icon: Laugh, couleur: "250 204 21" },
  polar: { Icon: Search, couleur: "148 163 184" },
};

const SignaturesAdn = ({ signatures, centre = false }: { signatures: Signature[]; centre?: boolean }) => {
  if (signatures.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${centre ? "justify-center" : ""}`} aria-label="Signatures cinéma">
      {signatures.map((s) => {
        const { Icon, couleur } = STYLE[s.id];
        return (
          <li
            key={s.id}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background/60 text-[12px] font-sans font-medium text-foreground/90"
            style={{ border: `1px solid rgb(${couleur} / 0.38)` }}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(${couleur})` }} strokeWidth={2} aria-hidden="true" />
            {s.libelle}
          </li>
        );
      })}
    </ul>
  );
};

export default SignaturesAdn;
