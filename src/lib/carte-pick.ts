import type { Adn, TraitId } from "@/lib/adn";
import type { Signature, SignatureId } from "@/lib/signatures";

/**
 * La Carte Pick : une carte à collectionner (recto, verso) dessinée sur un
 * canvas à partir des modèles de public/cartes et des données de
 * l'utilisateur. Le même dessin sert à l'affichage et à l'image partagée.
 *
 * Six finitions, chacune avec son recto et son verso. Les zones (cercle de la
 * photo, cartouches…) ont été mesurées sur chaque modèle, en pixels de
 * l'image (1060 × 1484). Les versos partagent la même disposition.
 */
export const LARGEUR_CARTE = 1060;
export const HAUTEUR_CARTE = 1484;

export type Rarete = "violet" | "argent" | "bronze" | "or" | "amethyste";
/** La nacre est la finition spéciale Pick+. */
export type Finition = Rarete | "nacre";

export const LIBELLES_RARETE: Record<Finition, string> = {
  violet: "Carte Violet nuit",
  argent: "Carte Argent",
  bronze: "Carte Bronze",
  or: "Carte Or",
  amethyste: "Carte Améthyste",
  nacre: "Carte Nacre",
};

/** La rareté suit les trophées obtenus (28 au total), comme les cadres. */
export function rareteCarte(nbTrophees: number): Rarete {
  if (nbTrophees >= 24) return "amethyste";
  if (nbTrophees >= 18) return "or";
  if (nbTrophees >= 11) return "bronze";
  if (nbTrophees >= 5) return "argent";
  return "violet";
}

export interface DonneesCarte {
  prenom: string;
  archetype: string | null;
  photo: string;
  signatures: Signature[];
  adn: Adn | null;
  univers: string[];
  /** Affiches des trois films du podium (1er, 2e, 3e), adresses complètes. */
  podium: (string | null)[];
  /** Médailles des distinctions à montrer (images). */
  distinctions: string[];
  choixAnalyses: number;
  coupsDeCoeur: number;
}

// ── Disposition des rectos ──────────────────────────────────────────────────

type Texte = { y: number; largeur: number; couleur: string };
/** Un emplacement de signature : son centre, la place du texte, et un médaillon pour l'icône s'il y en a un. */
type Emplacement = { x: number; texteY: number; largeur: number; icone?: { y: number; taille: number } };

interface Recto {
  photo: { x: number; y: number; r: number };
  nom: Texte;
  archetype: Texte;
  signatures: Emplacement[];
  couleurSignatures: string;
}

const quatre = (xs: number[], texteY: number, largeur: number, icone?: { y: number; taille: number }): Emplacement[] =>
  xs.map((x) => ({ x, texteY, largeur, icone }));

const RECTOS: Record<Finition, Recto> = {
  violet: {
    photo: { x: 530, y: 432, r: 270 },
    nom: { y: 876, largeur: 760, couleur: "#f5f2f7" },
    archetype: { y: 1008, largeur: 460, couleur: "#e8c27a" },
    signatures: quatre([188, 415, 641, 868], 1288, 176, { y: 1180, taille: 74 }),
    couleurSignatures: "#f5f2f7",
  },
  argent: {
    photo: { x: 530, y: 423, r: 284 },
    nom: { y: 816, largeur: 660, couleur: "#2b1f45" },
    archetype: { y: 968, largeur: 540, couleur: "#4b3a78" },
    signatures: quatre([171, 407, 644, 880], 1178, 186, { y: 1074, taille: 46 }),
    couleurSignatures: "#2b1f45",
  },
  bronze: {
    photo: { x: 537, y: 403, r: 242 },
    nom: { y: 808, largeur: 620, couleur: "#3a1f0e" },
    archetype: { y: 940, largeur: 360, couleur: "#f3c98b" },
    signatures: quatre([188, 410, 641, 868], 1192, 146, { y: 1124, taille: 56 }),
    couleurSignatures: "#3a1f0e",
  },
  or: {
    photo: { x: 528, y: 368, r: 220 },
    nom: { y: 731, largeur: 720, couleur: "#4a2c05" },
    archetype: { y: 843, largeur: 500, couleur: "#5a3a0a" },
    // Quatre cartouches en deux rangées, l'icône déjà dessinée à gauche.
    signatures: [
      { x: 342, texteY: 1026, largeur: 270 }, { x: 803, texteY: 1026, largeur: 270 },
      { x: 342, texteY: 1188, largeur: 270 }, { x: 803, texteY: 1188, largeur: 270 },
    ],
    couleurSignatures: "#4a2c05",
  },
  amethyste: {
    photo: { x: 520, y: 406, r: 250 },
    nom: { y: 842, largeur: 720, couleur: "#3b1d5e" },
    archetype: { y: 998, largeur: 400, couleur: "#5b2d8a" },
    signatures: quatre([171, 397, 629, 855], 1254, 186, { y: 1142, taille: 60 }),
    couleurSignatures: "#3b1d5e",
  },
  nacre: {
    photo: { x: 534, y: 393, r: 264 },
    nom: { y: 786, largeur: 780, couleur: "#3a2e1a" },
    archetype: { y: 919, largeur: 540, couleur: "#6b5530" },
    signatures: quatre([188, 415, 641, 868], 1170, 186, { y: 1036, taille: 40 }),
    couleurSignatures: "#3a2e1a",
  },
};

const ICONES: Record<SignatureId, string> = {
  dark: "🌙", slowburn: "🔥", epique: "⛰️", sf: "🪐", feelgood: "☀️", sensible: "💗",
  adrenaline: "⚡", reveur: "✨", cerebral: "🧠", frissons: "💀", rire: "😂", polar: "🔍",
};

const COURT: Record<string, string> = {
  "Science-fiction adulte": "SF adulte",
  "Amateur de frissons": "Frissons",
  "Bon public du rire": "Bon public",
};

// ── Disposition des versos (commune) ────────────────────────────────────────

/** Ordre des axes du modèle, du haut dans le sens des aiguilles d'une montre :
 *  Émotion, Réflexion, Tension, Évasion, Humour, Action. */
const AXES: TraitId[] = ["emotion", "contemplation", "tension", "imaginaire", "legerete", "rythme"];
const CONSTELLATION = { x: 530, y: 458, r: 160 };
const UNIVERS_X = [183, 410, 644, 875];
const UNIVERS_Y = 820;
/** Podium : 1er au centre, 2e à gauche, 3e à droite. */
const PODIUM: { x: number; y: number }[] = [{ x: 530, y: 1070 }, { x: 276, y: 1074 }, { x: 784, y: 1074 }];
const DISTINCTIONS_X = [282, 453, 619, 790];
const DISTINCTIONS_Y = 1316;

// ── Dessin ──────────────────────────────────────────────────────────────────

function chargerImage(src: string | undefined | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    // Sans cela, une image d'un autre site (TMDB, stockage) rendrait la carte
    // impossible à exporter.
    if (/^https?:/.test(src) && !src.startsWith(window.location.origin)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function polices(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('64px "DM Serif Display"'),
      document.fonts.load("600 32px Inter"),
    ]);
  } catch { /* police système à défaut */ }
}

/** Texte centré, réduit jusqu'à tenir dans la largeur, sinon tronqué. */
function texteAjuste(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, largeurMax: number, taille: number, police: string, couleur: string, min = 16) {
  let t = taille;
  ctx.font = police.replace("{t}", String(t));
  while (ctx.measureText(texte).width > largeurMax && t > min) {
    t -= 2;
    ctx.font = police.replace("{t}", String(t));
  }
  let s = texte;
  if (ctx.measureText(s).width > largeurMax) {
    while (s.length > 1 && ctx.measureText(`${s}…`).width > largeurMax) s = s.slice(0, -1);
    s = `${s}…`;
  }
  ctx.fillStyle = couleur;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

function imageRonde(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const ratio = Math.max((2 * r) / img.width, (2 * r) / img.height);
  const w = img.width * ratio, h = img.height * ratio;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function imageCouvrante(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, rayon = 8) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rayon);
  ctx.clip();
  const ratio = Math.max(w / img.width, h / img.height);
  const iw = img.width * ratio, ih = img.height * ratio;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

export async function dessinerRecto(canvas: HTMLCanvasElement, d: DonneesCarte, finition: Finition): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await polices();
  const [modele, photo] = await Promise.all([chargerImage(`/cartes/recto-${finition}.webp`), chargerImage(d.photo)]);
  const z = RECTOS[finition];
  ctx.clearRect(0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);
  if (modele) ctx.drawImage(modele, 0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);

  // La photo remplit tout le médaillon (et recouvre la silhouette de certains modèles).
  if (photo) imageRonde(ctx, photo, z.photo.x, z.photo.y, z.photo.r);

  texteAjuste(ctx, d.prenom || "Cinéphile", LARGEUR_CARTE / 2, z.nom.y + 4, z.nom.largeur, 80, '{t}px "DM Serif Display", serif', z.nom.couleur, 36);
  texteAjuste(ctx, (d.archetype ?? "Cinéphile Pick").toUpperCase(), LARGEUR_CARTE / 2, z.archetype.y, z.archetype.largeur, 28, "600 {t}px Inter, sans-serif", z.archetype.couleur, 16);

  // Quatre emplacements : les signatures, complétées par les univers favoris.
  const etiquettes: { texte: string; icone: string }[] = [
    ...d.signatures.map((s) => ({ texte: COURT[s.libelle] ?? s.libelle, icone: ICONES[s.id] })),
    ...d.univers
      .filter((u) => !d.signatures.some((s) => s.libelle.toLowerCase().includes(u.toLowerCase())))
      .map((u) => ({ texte: u, icone: "🎬" })),
  ].slice(0, 4);
  etiquettes.forEach((e, i) => {
    const place = z.signatures[i];
    if (place.icone) {
      ctx.font = `${place.icone.taille}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(e.icone, place.x, place.icone.y);
    }
    texteAjuste(ctx, e.texte, place.x, place.texteY, place.largeur, 28, "600 {t}px Inter, sans-serif", z.couleurSignatures, 16);
  });
}

export async function dessinerVerso(canvas: HTMLCanvasElement, d: DonneesCarte, finition: Finition): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await polices();
  const [modele, ...affiches] = await Promise.all([
    chargerImage(`/cartes/verso-${finition}.webp`),
    ...d.podium.map((p) => chargerImage(p)),
  ]);
  const medailles = await Promise.all(d.distinctions.slice(0, 4).map((m) => chargerImage(m)));
  ctx.clearRect(0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);
  if (modele) ctx.drawImage(modele, 0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);
  const sombre = finition === "violet";
  const encre = sombre ? "#f5f2f7" : "#2a1740";

  // Compteurs, sous le titre « Mon ADN cinéma ».
  texteAjuste(ctx, `${d.choixAnalyses.toLocaleString("fr-FR")} choix analysés · ${d.coupsDeCoeur.toLocaleString("fr-FR")} coups de cœur`,
    LARGEUR_CARTE / 2, 205, 560, 22, "600 {t}px Inter, sans-serif", sombre ? "#e8c27a" : "#6b4a1a", 14);

  // Constellation sur les six axes du modèle.
  if (d.adn) {
    const { x: cx, y: cy, r: R } = CONSTELLATION;
    const points = AXES.map((t, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const r = R * Math.max(0.15, Math.min(1, (d.adn as Adn)[t] / 100));
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, R);
    g.addColorStop(0, "rgba(217,70,239,0.55)");
    g.addColorStop(1, "rgba(124,58,237,0.38)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(124,58,237,0.95)";
    ctx.stroke();
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(124,58,237,0.95)";
      ctx.stroke();
    });
  }

  // Univers favoris : un par cartouche, sur deux lignes si besoin.
  d.univers.slice(0, 4).forEach((u, i) => {
    const nom = u.replace("Science-Fiction", "SF");
    const mots = nom.split(/\s+/);
    const lignes = mots.length > 1 && nom.length > 11 ? [mots.slice(0, Math.ceil(mots.length / 2)).join(" "), mots.slice(Math.ceil(mots.length / 2)).join(" ")] : [nom];
    lignes.forEach((l, j) => texteAjuste(ctx, l, UNIVERS_X[i], UNIVERS_Y + (j - (lignes.length - 1) / 2) * 32, 176, 30, "600 {t}px Inter, sans-serif", encre, 16));
  });

  // Podium : les affiches dans les trois cadres.
  PODIUM.forEach((p, rang) => {
    const img = affiches[rang];
    if (!img) return;
    const h = rang === 0 ? 132 : 122;
    const w = Math.round(h * (2 / 3));
    imageCouvrante(ctx, img, p.x - w / 2, p.y - h / 2, w, h);
  });

  // Distinctions : une médaille par médaillon.
  medailles.forEach((m, i) => {
    if (!m) return;
    const t = 128;
    ctx.drawImage(m, DISTINCTIONS_X[i] - t / 2, DISTINCTIONS_Y - t / 2, t, t);
  });
}
