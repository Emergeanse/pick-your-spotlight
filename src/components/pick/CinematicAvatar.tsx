import { cn } from "@/lib/utils";

/**
 * CinematicAvatar — A living cinematic identity halo around a user's avatar.
 *
 * Props:
 * - src: avatar image URL (optional, shows initial fallback)
 * - name: user display name (for fallback initial)
 * - size: "sm" | "md" | "lg" (default "md")
 * - level: cinematic level determines ring style
 * - dna: cinematic DNA archetype determines ring color
 * - tasteSignature: primary taste signature determines animation variant
 * - className: additional wrapper classes
 * - compatibilityBlend: optional second DNA color for Together mode blending
 */

export type CinematicLevel =
  | "emerging"    // Regard naissant
  | "sensitive"   // Regard sensible
  | "sharp"       // Œil affûté
  | "curator"     // Curateur cinématographique
  | "reference";  // Référence Pick

export type CinematicDNA =
  | "contemplative"
  | "emotional"
  | "intense"
  | "feelgood"
  | "visual";

export type TasteAnimation =
  | "slowburn"
  | "tension"
  | "visual"
  | "default";

interface CinematicAvatarProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  level?: CinematicLevel;
  dna?: CinematicDNA;
  tasteSignature?: TasteAnimation;
  compatibilityBlend?: CinematicDNA;
  className?: string;
}

// Map DNA to HSL color
const DNA_COLORS: Record<CinematicDNA, string> = {
  contemplative: "210 60% 45%",   // deep blue
  emotional:     "270 40% 55%",   // soft purple
  intense:       "0 50% 35%",     // dark red
  feelgood:      "35 70% 50%",    // warm amber
  visual:        "220 10% 70%",   // silver
};

// Map global_level text to our type
export function mapLevelToType(level: string | null | undefined): CinematicLevel {
  if (!level) return "emerging";
  const l = level.toLowerCase();
  if (l.includes("référence")) return "reference";
  if (l.includes("curateur") || l.includes("signature")) return "curator";
  if (l.includes("affûté") || l.includes("connaisseur")) return "sharp";
  if (l.includes("sensible")) return "sensitive";
  return "emerging";
}

// Map dna_archetype text to our DNA type
export function mapArchetypeToDNA(archetype: string | null | undefined): CinematicDNA {
  if (!archetype) return "contemplative";
  const a = archetype.toLowerCase();
  if (a.includes("émotion") || a.includes("humaniste") || a.includes("sensible")) return "emotional";
  if (a.includes("tension") || a.includes("chasseur") || a.includes("vertige")) return "intense";
  if (a.includes("flâneur") || a.includes("équilibriste") || a.includes("divertissement") || a.includes("feel")) return "feelgood";
  if (a.includes("esthète") || a.includes("lumière") || a.includes("visuel") || a.includes("sensoriel")) return "visual";
  return "contemplative";
}

// Map taste signature to animation type
export function mapSignatureToAnimation(signatures: string[] | null | undefined): TasteAnimation {
  if (!signatures?.length) return "default";
  const joined = signatures.join(" ").toLowerCase();
  if (joined.includes("slow burn") || joined.includes("lente") || joined.includes("contemplatif")) return "slowburn";
  if (joined.includes("tension") || joined.includes("nerveux") || joined.includes("brute")) return "tension";
  if (joined.includes("visuel") || joined.includes("esthétique") || joined.includes("composition")) return "visual";
  return "default";
}

const SIZES = {
  sm: { outer: "w-10 h-10", inner: "w-8 h-8", text: "text-sm", gap: "2px" },
  md: { outer: "w-[4.5rem] h-[4.5rem]", inner: "w-14 h-14", text: "text-2xl", gap: "3px" },
  lg: { outer: "w-24 h-24", inner: "w-20 h-20", text: "text-3xl", gap: "4px" },
};

const CinematicAvatar = ({
  src,
  name = "",
  size = "md",
  level = "emerging",
  dna = "contemplative",
  tasteSignature = "default",
  compatibilityBlend,
  className,
}: CinematicAvatarProps) => {
  const s = SIZES[size];
  const color = DNA_COLORS[dna];
  const blendColor = compatibilityBlend ? DNA_COLORS[compatibilityBlend] : null;

  // Build ring style based on level
  const ringStyles = getRingStyles(level, color, blendColor);
  // Animation class based on taste
  const animClass = getAnimationClass(tasteSignature, level);

  return (
    <div className={cn("relative inline-flex items-center justify-center", s.outer, className)}>
      {/* Halo / Ring layers */}
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-all duration-1000",
          animClass,
        )}
        style={ringStyles}
      />

      {/* Second ring for "sharp" level */}
      {level === "sharp" && (
        <div
          className="absolute rounded-full cinematic-ring-secondary"
          style={{
            inset: "1px",
            border: `1px solid hsla(${color} / 0.15)`,
          }}
        />
      )}

      {/* Aura glow for reference level */}
      {level === "reference" && (
        <div
          className="absolute rounded-full cinematic-aura"
          style={{
            inset: "-4px",
            background: `radial-gradient(circle, hsla(${color} / 0.12) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Inner avatar */}
      <div className={cn("relative rounded-full overflow-hidden bg-card z-10", s.inner)}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <span className={cn("font-serif text-primary", s.text)}>
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

function getRingStyles(
  level: CinematicLevel,
  color: string,
  blendColor: string | null,
): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: "9999px" };

  if (blendColor) {
    // Together mode: gradient blend
    return {
      ...base,
      background: `conic-gradient(from 0deg, hsla(${color} / 0.4), hsla(${blendColor} / 0.4), hsla(${color} / 0.4))`,
      padding: "2px",
    };
  }

  switch (level) {
    case "emerging":
      return {
        ...base,
        border: `1.5px solid hsla(${color} / 0.2)`,
      };
    case "sensitive":
      return {
        ...base,
        border: `1.5px solid hsla(${color} / 0.3)`,
        boxShadow: `0 0 8px 1px hsla(${color} / 0.15)`,
      };
    case "sharp":
      return {
        ...base,
        border: `2px solid hsla(${color} / 0.35)`,
      };
    case "curator":
      return {
        ...base,
        border: `2px solid hsla(${color} / 0.4)`,
        background: `linear-gradient(135deg, hsla(${color} / 0.08), transparent, hsla(${color} / 0.08))`,
      };
    case "reference":
      return {
        ...base,
        border: `2px solid hsla(${color} / 0.5)`,
        boxShadow: `0 0 16px 2px hsla(${color} / 0.2), inset 0 0 8px hsla(${color} / 0.05)`,
      };
  }
}

function getAnimationClass(taste: TasteAnimation, level: CinematicLevel): string {
  if (level === "emerging") return ""; // no animation for emerging
  switch (taste) {
    case "slowburn":  return "cinematic-breathe";
    case "tension":   return "cinematic-pulse";
    case "visual":    return "cinematic-shimmer";
    default:          return "cinematic-breathe";
  }
}

export default CinematicAvatar;
