import { TRAITS, type Adn } from "@/lib/adn";
import type { Signature } from "@/lib/signatures";

/**
 * La Carte Pick : une carte à collectionner (recto, verso) dessinée sur un
 * canvas à partir des modèles de public/cartes et des données de
 * l'utilisateur. Le même dessin sert à l'affichage et à l'image partagée.
 *
 * Les zones (cercle de la photo, cartouches…) ont été mesurées sur chaque
 * modèle, en pixels de l'image d'origine (1055 × 1491).
 */
export const LARGEUR_CARTE = 1055;
export const HAUTEUR_CARTE = 1491;

export type Rarete = "verre" | "argent" | "bronze" | "or" | "amethyste";
export type Finition = Rarete | "holo";

export const LIBELLES_RARETE: Record<Finition, string> = {
  verre: "Carte Verre",
  argent: "Carte Argent",
  bronze: "Carte Bronze",
  or: "Carte Or",
  amethyste: "Carte Améthyste",
  holo: "Carte Holographique",
};

/** La rareté suit les trophées obtenus (28 au total), comme les cadres. */
export function rareteCarte(nbTrophees: number): Rarete {
  if (nbTrophees >= 24) return "amethyste";
  if (nbTrophees >= 18) return "or";
  if (nbTrophees >= 11) return "bronze";
  if (nbTrophees >= 5) return "argent";
  return "verre";
}

type ZonesRecto = { photoY: number; photoR: number; nomY: number; archetypeY: number; pastillesY: number };

const RECTO: Record<Finition, ZonesRecto> = {
  verre: { photoY: 428, photoR: 198, nomY: 804, archetypeY: 947, pastillesY: 1122 },
  argent: { photoY: 430, photoR: 198, nomY: 805, archetypeY: 951, pastillesY: 1122 },
  bronze: { photoY: 427, photoR: 195, nomY: 802, archetypeY: 950, pastillesY: 1119 },
  or: { photoY: 433, photoR: 190, nomY: 810, archetypeY: 957, pastillesY: 1135 },
  amethyste: { photoY: 412, photoR: 192, nomY: 802, archetypeY: 940, pastillesY: 1098 },
  holo: { photoY: 400, photoR: 198, nomY: 783, archetypeY: 933, pastillesY: 1105 },
};

/** Centres et largeurs des quatre cartouches de signatures (recto). */
const PASTILLES_X: [number, number][] = [[203, 175], [421, 172], [638, 175], [853, 175]];

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

const OR = "#e8c27a";
const BLANC = "#f5f2f7";
const GRIS = "#bdb5cc";

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

export async function polices(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('64px "DM Serif Display"'),
      document.fonts.load('600 32px Inter'),
      document.fonts.load('500 26px Inter'),
    ]);
  } catch { /* police système à défaut */ }
}

/** Texte centré, réduit jusqu'à tenir dans la largeur. */
function texteAjuste(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, largeurMax: number, taille: number, police: string, couleur: string, min = 18) {
  let t = taille;
  ctx.font = `${police.replace("{t}", String(t))}`;
  while (ctx.measureText(texte).width > largeurMax && t > min) {
    t -= 2;
    ctx.font = `${police.replace("{t}", String(t))}`;
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

function imageCouvrante(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, rayon = 10) {
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
  const [modele, photo] = await Promise.all([
    chargerImage(`/cartes/${finition}.webp`),
    chargerImage(d.photo),
  ]);
  const z = RECTO[finition];
  ctx.clearRect(0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);
  if (modele) ctx.drawImage(modele, 0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);

  // Photo dans le cercle : l'anneau du modèle, à la couleur de la rareté,
  // tient lieu de cadre.
  const cx = LARGEUR_CARTE / 2;
  if (photo) imageRonde(ctx, photo, cx, z.photoY, z.photoR);

  texteAjuste(ctx, d.prenom, cx, z.nomY + 4, 700, 76, '{t}px "DM Serif Display", serif', BLANC, 36);
  texteAjuste(ctx, (d.archetype ?? "Cinéphile Pick").toUpperCase(), cx, z.archetypeY, 440, 28, '600 {t}px Inter, sans-serif', OR, 16);

  // Quatre cartouches : les signatures, complétées par les univers favoris.
  const COURT: Record<string, string> = { "Science-fiction adulte": "SF adulte", "Amateur de frissons": "Frissons", "Bon public du rire": "Bon public" };
  const etiquettes = [
    ...d.signatures.map((s) => COURT[s.libelle] ?? s.libelle),
    ...d.univers.filter((u) => !d.signatures.some((s) => s.libelle.toLowerCase().includes(u.toLowerCase()))),
  ].slice(0, 4);
  etiquettes.forEach((t, i) => {
    const [px, pw] = PASTILLES_X[i];
    texteAjuste(ctx, t, px, z.pastillesY, pw - 30, 26, '600 {t}px Inter, sans-serif', BLANC, 16);
  });
}

export async function dessinerVerso(canvas: HTMLCanvasElement, d: DonneesCarte, rarete: Finition): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await polices();
  const [modele, ...affiches] = await Promise.all([
    chargerImage("/cartes/verso.webp"),
    ...d.podium.map((p) => chargerImage(p)),
  ]);
  const medailles = await Promise.all(d.distinctions.slice(0, 5).map((m) => chargerImage(m)));
  ctx.clearRect(0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);
  if (modele) ctx.drawImage(modele, 0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);

  // Constellation : les six traits sur les six axes du cercle.
  const cx = 528, cy = 400, R = 186;
  if (d.adn) {
    const points = TRAITS.map((t, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const r = R * Math.max(0.12, Math.min(1, (d.adn as Adn)[t.id] / 100));
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
    g.addColorStop(0, "rgba(217,70,239,0.55)");
    g.addColorStop(1, "rgba(139,92,246,0.35)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(196,181,253,0.95)";
    ctx.stroke();
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = BLANC;
      ctx.fill();
    });
    TRAITS.forEach((t, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const lx = cx + Math.cos(a) * (R - 44), ly = cy + Math.sin(a) * (R - 34) + (i === 0 ? 18 : i === 3 ? -18 : 0);
      ctx.font = "600 20px Inter, sans-serif";
      ctx.fillStyle = "rgba(232,194,122,0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.libelle, lx, ly);
    });
  }

  // Univers favoris : un par médaillon.
  const centresUnivers = [222, 375, 527, 680, 833];
  d.univers.slice(0, 5).forEach((u, i) => {
    const mots = u.replace("Science-Fiction", "SF").split(/[\s-]/).filter(Boolean);
    const lignes = mots.length > 1 && u.length > 9 ? [mots.slice(0, Math.ceil(mots.length / 2)).join(" "), mots.slice(Math.ceil(mots.length / 2)).join(" ")] : [mots.join(" ")];
    lignes.forEach((l, j) => texteAjuste(ctx, l, centresUnivers[i], 757 + (j - (lignes.length - 1) / 2) * 24, 96, 22, '600 {t}px Inter, sans-serif', BLANC, 13));
  });

  // Podium : 2e à gauche, 1er au centre, 3e à droite.
  const boites: [number, number, number, number][] = [[420, 930, 228, 1058], [170, 945, 214, 1050], [671, 945, 214, 1050]];
  [0, 1, 2].forEach((rang) => {
    const img = affiches[rang];
    const [x, y, w, bas] = boites[rang];
    const h = bas - y - 16;
    const pw = h * (2 / 3);
    if (img) imageCouvrante(ctx, img, x + (w - pw) / 2, y + 8, pw, h, 8);
  });

  // Distinctions : une médaille par losange.
  const centresMedailles = [196, 360, 527, 693, 858];
  medailles.forEach((m, i) => {
    if (!m) return;
    const t = 86;
    ctx.drawImage(m, centresMedailles[i] - t / 2, 1180 - t / 2, t, t);
  });

  // Bas : rareté, choix analysés, coups de cœur.
  const bas: [number, number, string][] = [
    [290, 175, LIBELLES_RARETE[rarete]],
    [578, 190, `${d.choixAnalyses.toLocaleString("fr-FR")} choix`],
    [842, 170, `${d.coupsDeCoeur.toLocaleString("fr-FR")} coups de cœur`],
  ];
  bas.forEach(([x, w, t]) => texteAjuste(ctx, t, x, 1291, w, 24, '600 {t}px Inter, sans-serif', BLANC, 14));
}
