/**
 * Conversion des images du projet en WebP + génération des icônes PWA.
 *
 * Usage : node scripts/convert-assets-webp.mjs
 *
 * - `src/assets/*.png` → `src/assets/*.webp` (noms en minuscules, pour éviter
 *   les bugs de casse entre Windows et les builds Linux).
 * - `public/pick-logo.png` → icônes PWA aux tailles déclarées dans le manifest.
 *
 * Le script n'efface aucun fichier : la suppression des PNG sources se fait
 * à la main une fois les imports mis à jour et le build vérifié.
 */
import sharp from "sharp";
import { readdir, stat, mkdir } from "node:fs/promises";
import path from "node:path";

const SRC_ASSETS = "src/assets";
const PUBLIC_DIR = "public";

// Les fonds plein écran sont photographiques et sans transparence : la qualité
// peut descendre plus bas sans artefact visible. Les personnages et logos ont
// un canal alpha et des aplats nets, qui demandent une qualité plus haute.
const QUALITY_PHOTO = 80;
const QUALITY_ALPHA = 86;

const fmtMB = (bytes) => (bytes / 1048576).toFixed(2);

async function convertAssets() {
  const files = (await readdir(SRC_ASSETS)).filter((f) => f.endsWith(".png"));
  let totalBefore = 0;
  let totalAfter = 0;

  console.log(`\n── src/assets — ${files.length} images ──\n`);

  for (const file of files) {
    const srcPath = path.join(SRC_ASSETS, file);
    const outName = file.toLowerCase().replace(/\.png$/, ".webp");
    const outPath = path.join(SRC_ASSETS, outName);

    const image = sharp(srcPath);
    const meta = await image.metadata();
    const quality = meta.hasAlpha ? QUALITY_ALPHA : QUALITY_PHOTO;

    await image.webp({ quality, effort: 6 }).toFile(outPath);

    const before = (await stat(srcPath)).size;
    const after = (await stat(outPath)).size;
    totalBefore += before;
    totalAfter += after;

    const ratio = (100 - (after / before) * 100).toFixed(0);
    console.log(
      `  ${file.padEnd(26)} ${fmtMB(before).padStart(6)} MB → ${fmtMB(after).padStart(6)} MB  (−${ratio}%)  q=${quality}`
    );
  }

  console.log(
    `\n  TOTAL : ${fmtMB(totalBefore)} MB → ${fmtMB(totalAfter)} MB ` +
      `(−${(100 - (totalAfter / totalBefore) * 100).toFixed(0)}%)\n`
  );
}

async function generatePwaIcons() {
  // Le manifest annonçait une icône 512×512 alors que le fichier source faisait
  // 1254×1254 et 1,8 MB. On génère les tailles réellement déclarées.
  const source = path.join(PUBLIC_DIR, "pick-logo.png");
  const iconsDir = path.join(PUBLIC_DIR, "icons");
  await mkdir(iconsDir, { recursive: true });

  console.log("── public/icons — icônes PWA ──\n");

  for (const size of [192, 512]) {
    const outPath = path.join(iconsDir, `pick-logo-${size}.png`);
    await sharp(source)
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9, palette: true })
      .toFile(outPath);
    console.log(`  pick-logo-${size}.png`.padEnd(28) + `${fmtMB((await stat(outPath)).size)} MB`);
  }

  // Version WebP pour le favicon des navigateurs modernes.
  const faviconPath = path.join(iconsDir, "pick-logo-192.webp");
  await sharp(source).resize(192, 192, { fit: "cover" }).webp({ quality: QUALITY_ALPHA }).toFile(faviconPath);
  console.log(`  pick-logo-192.webp`.padEnd(28) + `${fmtMB((await stat(faviconPath)).size)} MB`);

  const before = (await stat(source)).size;
  console.log(`\n  Source remplacée : pick-logo.png ${fmtMB(before)} MB\n`);
}

await convertAssets();
await generatePwaIcons();
console.log("Terminé. Mettre à jour les imports, puis supprimer les PNG sources.\n");
