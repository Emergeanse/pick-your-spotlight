import type { FC } from "react";

interface CinemaAvatarProps {
  personalityTitle: string;
  dnaArchetype?: string | null;
  tasteTaits?: string[];
  globalLevel?: string;
  size?: number;
}

// Deterministic number from a string
const hashStr = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(33, h) ^ s.charCodeAt(i)) >>> 0;
  return h;
};

// Shared dark base — distinct from the app background so the circle is always visible
const BASE_BG = "#111118";

const COLOR_PALETTES = [
  { primary: "#f97316", secondary: "#dc2626", mid: "#b45309" },
  { primary: "#06b6d4", secondary: "#6366f1", mid: "#0284c7" },
  { primary: "#a855f7", secondary: "#ec4899", mid: "#7c3aed" },
  { primary: "#eab308", secondary: "#d97706", mid: "#ca8a04" },
  { primary: "#22c55e", secondary: "#14b8a6", mid: "#0d9488" },
  { primary: "#f43f5e", secondary: "#e11d48", mid: "#be123c" },
  { primary: "#94a3b8", secondary: "#64748b", mid: "#475569" },
  { primary: "#8b5cf6", secondary: "#4f46e5", mid: "#6d28d9" },
];

// Map archetype keywords to a glyph style
const detectGlyph = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("nostalgique") || n.includes("mémoire") || n.includes("classique")) return "reel";
  if (n.includes("explorateur") || n.includes("aventurier") || n.includes("voyageur")) return "compass";
  if (n.includes("esthète") || n.includes("visuel") || n.includes("regard") || n.includes("regard")) return "aperture";
  if (n.includes("analyste") || n.includes("stratège") || n.includes("intelligent")) return "hexagon";
  if (n.includes("passionné") || n.includes("émotionnel") || n.includes("intense")) return "pulse";
  if (n.includes("créateur") || n.includes("auteur") || n.includes("singulier")) return "prism";
  return "play";
};

const CinemaAvatar: FC<CinemaAvatarProps> = ({
  personalityTitle,
  dnaArchetype,
  tasteTaits = [],
  globalLevel = "",
  size = 128,
}) => {
  const name = dnaArchetype || personalityTitle;
  const hash = hashStr(name);
  const palette = COLOR_PALETTES[hash % COLOR_PALETTES.length];
  const glyph = detectGlyph(name);

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 1;
  const bandR = R - 1;
  const innerR = R - 12;

  const gradId = `cag${hash.toString(16).slice(0, 6)}`;
  const glowId = `cgl${hash.toString(16).slice(0, 6)}`;
  const clipId = `clp${hash.toString(16).slice(0, 6)}`;

  // Film strip holes — 18 around the outer ring
  const HOLE_COUNT = 18;
  const holeR = bandR - 4;
  const filmHoles = Array.from({ length: HOLE_COUNT }, (_, i) => {
    const angle = (i / HOLE_COUNT) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + holeR * Math.cos(angle), y: cy + holeR * Math.sin(angle) };
  });

  // Constellation — one dot per taste_trait, positions seeded from trait name
  const constellDots = tasteTaits.slice(0, 8).map((trait, i) => {
    const s = hashStr(trait + i);
    const angle = (s % 628) / 100; // 0 to 2π
    const r = (innerR * 0.25) + ((s % 100) / 100) * (innerR * 0.45);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), r: 1 + (s % 2) * 0.8 };
  });

  // Connection lines between adjacent constellation dots (if ≥ 3 traits)
  const constellLines = constellDots.length >= 3
    ? constellDots.map((dot, i) => ({ x1: dot.x, y1: dot.y, x2: constellDots[(i + 1) % constellDots.length].x, y2: constellDots[(i + 1) % constellDots.length].y }))
    : [];

  // Level progress arc
  const LEVEL_ORDER = ["Regard naissant", "Regard sensible", "Œil affûté", "Connaisseur nuancé", "Curateur cinématographique", "Signature de goût", "Référence Pick"];
  const levelIdx = LEVEL_ORDER.indexOf(globalLevel);
  const levelRatio = levelIdx >= 0 ? (levelIdx + 1) / LEVEL_ORDER.length : 0.15;
  const arcAngle = levelRatio * Math.PI * 2;
  const arcR = innerR + 4;
  const arcStart = -Math.PI / 2;
  const arcEnd = arcStart + arcAngle;
  const arcX1 = cx + arcR * Math.cos(arcStart);
  const arcY1 = cy + arcR * Math.sin(arcStart);
  const arcX2 = cx + arcR * Math.cos(arcEnd);
  const arcY2 = cy + arcR * Math.sin(arcEnd);
  const largeArc = arcAngle > Math.PI ? 1 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id={gradId} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={palette.primary} stopOpacity="0.45" />
          <stop offset="50%" stopColor={palette.secondary} stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>

      {/* Base circle — fixed dark color distinct from app background */}
      <circle cx={cx} cy={cy} r={R} fill={BASE_BG} />

      {/* Colored gradient overlay */}
      <circle cx={cx} cy={cy} r={R} fill={`url(#${gradId})`} />

      {/* Film strip band */}
      <circle cx={cx} cy={cy} r={bandR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />

      {/* Film strip holes */}
      {filmHoles.map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r={2.2} fill={BASE_BG} />
      ))}

      {/* Thin separator ring */}
      <circle cx={cx} cy={cy} r={innerR + 8} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

      {/* Level progress arc */}
      {levelRatio > 0 && (
        <path
          d={`M ${arcX1} ${arcY1} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcX2} ${arcY2}`}
          fill="none"
          stroke={palette.primary}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
          filter={`url(#${glowId})`}
        />
      )}

      {/* Constellation lines */}
      {constellLines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={palette.primary} strokeWidth="0.4" opacity="0.18" />
      ))}

      {/* Constellation dots */}
      {constellDots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="rgba(255,255,255,0.45)" />
      ))}

      {/* ── Central glyph ── */}
      <g filter={`url(#${glowId})`}>
        {glyph === "reel" && (
          <g>
            <circle cx={cx} cy={cy} r={innerR * 0.36} fill="none" stroke={palette.primary} strokeWidth="1.5" opacity="0.7" />
            <circle cx={cx} cy={cy} r={innerR * 0.12} fill={palette.primary} opacity="0.5" />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const a = deg * Math.PI / 180;
              return <line key={deg} x1={cx + innerR * 0.15 * Math.cos(a)} y1={cy + innerR * 0.15 * Math.sin(a)} x2={cx + innerR * 0.31 * Math.cos(a)} y2={cy + innerR * 0.31 * Math.sin(a)} stroke={palette.primary} strokeWidth="1.8" opacity="0.8" strokeLinecap="round" />;
            })}
            {[30, 90, 150, 210, 270, 330].map((deg) => {
              const a = deg * Math.PI / 180;
              return <circle key={deg} cx={cx + innerR * 0.24 * Math.cos(a)} cy={cy + innerR * 0.24 * Math.sin(a)} r={2.5} fill={palette.primary} opacity="0.65" />;
            })}
          </g>
        )}
        {glyph === "compass" && (
          <g>
            <circle cx={cx} cy={cy} r={innerR * 0.34} fill="none" stroke={palette.primary} strokeWidth="1" opacity="0.4" />
            {[0, 90, 180, 270].map((deg) => {
              const a = deg * Math.PI / 180;
              return <line key={deg} x1={cx + innerR * 0.06 * Math.cos(a)} y1={cy + innerR * 0.06 * Math.sin(a)} x2={cx + innerR * 0.34 * Math.cos(a)} y2={cy + innerR * 0.34 * Math.sin(a)} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />;
            })}
            <polygon points={`${cx},${cy - innerR * 0.32} ${cx + 4},${cy + 5} ${cx},${cy + 9} ${cx - 4},${cy + 5}`} fill={palette.primary} opacity="0.9" />
            <polygon points={`${cx},${cy + innerR * 0.32} ${cx + 4},${cy - 5} ${cx},${cy - 9} ${cx - 4},${cy - 5}`} fill="rgba(255,255,255,0.25)" opacity="0.8" />
            <circle cx={cx} cy={cy} r={3.5} fill="white" opacity="0.85" />
          </g>
        )}
        {glyph === "aperture" && (
          <g>
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2;
              const sp = 0.3;
              const r1 = innerR * 0.08, r2 = innerR * 0.35;
              return <path key={i} d={`M ${cx + r1 * Math.cos(a - sp)} ${cy + r1 * Math.sin(a - sp)} L ${cx + r2 * Math.cos(a)} ${cy + r2 * Math.sin(a)} L ${cx + r1 * Math.cos(a + sp)} ${cy + r1 * Math.sin(a + sp)} Z`} fill={palette.primary} opacity="0.55" />;
            })}
            <circle cx={cx} cy={cy} r={innerR * 0.13} fill={palette.primary} opacity="0.9" />
            <circle cx={cx} cy={cy} r={innerR * 0.06} fill="rgba(255,255,255,0.8)" />
          </g>
        )}
        {glyph === "hexagon" && (
          <g>
            <polygon points={Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 6; const r = innerR * 0.34; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(" ")} fill="none" stroke={palette.primary} strokeWidth="1.5" opacity="0.7" />
            <polygon points={Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 6; const r = innerR * 0.17; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(" ")} fill={palette.primary} opacity="0.25" />
            <circle cx={cx} cy={cy} r={4.5} fill={palette.primary} opacity="0.9" />
          </g>
        )}
        {glyph === "pulse" && (
          <g>
            <path d={`M ${cx - innerR * 0.38} ${cy} L ${cx - innerR * 0.18} ${cy} L ${cx - innerR * 0.06} ${cy - innerR * 0.28} L ${cx + innerR * 0.06} ${cy + innerR * 0.28} L ${cx + innerR * 0.18} ${cy} L ${cx + innerR * 0.38} ${cy}`} fill="none" stroke={palette.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
            <circle cx={cx} cy={cy} r={innerR * 0.32} fill="none" stroke={palette.primary} strokeWidth="0.8" opacity="0.2" />
          </g>
        )}
        {glyph === "prism" && (
          <g>
            <polygon points={`${cx},${cy - innerR * 0.36} ${cx + innerR * 0.31},${cy + innerR * 0.18} ${cx - innerR * 0.31},${cy + innerR * 0.18}`} fill="none" stroke={palette.primary} strokeWidth="1.5" opacity="0.7" />
            <line x1={cx} y1={cy - innerR * 0.36} x2={cx} y2={cy + innerR * 0.18} stroke={palette.secondary} strokeWidth="0.8" opacity="0.4" />
            <line x1={cx} y1={cy - innerR * 0.36} x2={cx - innerR * 0.18} y2={cy + innerR * 0.18} stroke={palette.mid} strokeWidth="0.8" opacity="0.3" />
            <circle cx={cx} cy={cy - innerR * 0.36} r={2.5} fill={palette.primary} opacity="0.9" />
          </g>
        )}
        {glyph === "play" && (
          <g>
            <circle cx={cx} cy={cy} r={innerR * 0.3} fill="none" stroke={palette.primary} strokeWidth="1.2" opacity="0.45" />
            <polygon points={`${cx - innerR * 0.12},${cy - innerR * 0.18} ${cx + innerR * 0.22},${cy} ${cx - innerR * 0.12},${cy + innerR * 0.18}`} fill={palette.primary} opacity="0.88" />
          </g>
        )}
      </g>

      {/* Outer border ring */}
      <circle cx={cx} cy={cy} r={R - 0.5} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
    </svg>
  );
};

export default CinemaAvatar;
