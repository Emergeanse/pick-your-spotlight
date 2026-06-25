/**
 * Génère docs/handbook/TOME_2_Moteur_Recommandation.pdf
 * et sauvegarde la source HTML pour éditions futures.
 *
 * Usage: node scripts/generate-handbook-tome2-pdf.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildHtml } from './handbook-tome2-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'docs', 'handbook');
const HTML_PATH = join(OUT_DIR, 'tome-2-source.html');
const PDF_PATH = join(OUT_DIR, 'TOME_2_Moteur_Recommandation.pdf');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const html = buildHtml();
  await writeFile(HTML_PATH, html, 'utf-8');
  console.log(`✓ HTML source → ${HTML_PATH}`);

  const chromePaths = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].filter(Boolean);

  let executablePath;
  const { existsSync } = await import('fs');
  for (const p of chromePaths) {
    if (existsSync(p)) { executablePath = p; break; }
  }

  const browser = await chromium.launch(
    executablePath ? { executablePath, headless: true } : undefined,
  );
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });

  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-size:8px;color:#999;text-align:center;padding:0 20px">
        Pick — Engineering Handbook · Tome 2 · v1.0 · Juin 2026 — <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>`,
  });

  await browser.close();

  const { size } = await stat(PDF_PATH);
  const sizeKb = Math.round(size / 1024);
  console.log(`✓ PDF → ${PDF_PATH} (${sizeKb} KB)`);

  if (sizeKb < 100) {
    console.warn('⚠ PDF semble petit — vérifier le contenu');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
