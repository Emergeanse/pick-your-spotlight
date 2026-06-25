/**
 * Génère docs/RECOMMENDATION_PIPELINE.pdf via pdfkit (sans navigateur).
 * Usage: node scripts/generate-pipeline-pdf-pdfkit.mjs
 */
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfPath = join(__dirname, '..', 'docs', 'RECOMMENDATION_PIPELINE.pdf');

const COLORS = {
  primary: '#302b63',
  text: '#1a1a2e',
  muted: '#5c5780',
  tableHeader: '#302b63',
  tableAlt: '#f8f7fc',
  accent: '#4a4570',
};

function drawTitlePage(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#1a1640');
  doc.fillColor('#ffffff')
    .fontSize(28)
    .font('Helvetica-Bold')
    .text('Pipeline de recommandation', 50, 200, { align: 'center', width: doc.page.width - 100 });
  doc.fontSize(14)
    .font('Helvetica')
    .text('Pick Your Spotlight — Documentation technique', { align: 'center', width: doc.page.width - 100 });
  doc.moveDown(2);
  doc.fontSize(10).fillColor('#ccccdd')
    .text('Moteur cœur · Surprise du soir · Juin 2026', { align: 'center', width: doc.page.width - 100 });
  doc.fontSize(9)
    .text('Version document : 25 juin 2026', 50, doc.page.height - 120, { align: 'center', width: doc.page.width - 100 });
  doc.text('Sources : RECOMMENDATION_PIPELINE.md · BACKLOG.md', { align: 'center', width: doc.page.width - 100 });
}

function section(doc, title, level = 2) {
  if (doc.y > doc.page.height - 80) doc.addPage();
  doc.moveDown(level === 2 ? 1.2 : 0.8);
  doc.fillColor(level === 2 ? COLORS.primary : COLORS.accent)
    .fontSize(level === 2 ? 14 : 11)
    .font(level === 2 ? 'Helvetica-Bold' : 'Helvetica-Bold')
    .text(title, { continued: false });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.5);
}

function para(doc, text) {
  if (doc.y > doc.page.height - 60) doc.addPage();
  doc.text(text, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.4);
}

function bullet(doc, items) {
  for (const item of items) {
    if (doc.y > doc.page.height - 50) doc.addPage();
    doc.text(`• ${item}`, { indent: 12, lineGap: 1 });
  }
  doc.moveDown(0.4);
}

function drawTable(doc, headers, rows, colWidths) {
  const startX = 50;
  const rowH = 18;
  let y = doc.y;

  if (y > doc.page.height - 60) { doc.addPage(); y = doc.y; }

  // Header
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH).fill(COLORS.tableHeader);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
      .text(h, x + 3, y + 5, { width: colWidths[i] - 6, lineBreak: false });
    x += colWidths[i];
  });
  y += rowH;

  rows.forEach((row, ri) => {
    const lines = row.map((cell, ci) => {
      doc.fontSize(7).font('Helvetica');
      return doc.heightOfString(String(cell), { width: colWidths[ci] - 6 });
    });
    const h = Math.max(rowH, Math.max(...lines) + 8);

    if (y + h > doc.page.height - 50) {
      doc.addPage();
      y = doc.y;
    }

    if (ri % 2 === 1) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), h).fill(COLORS.tableAlt);
    }

    x = startX;
    row.forEach((cell, ci) => {
      doc.fillColor(COLORS.text).fontSize(7).font('Helvetica')
        .text(String(cell), x + 3, y + 4, { width: colWidths[ci] - 6 });
      x += colWidths[ci];
    });
    y += h;
  });

  doc.y = y + 8;
  doc.x = 50;
}

function asciiBlock(doc, text) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  const h = doc.heightOfString(text, { width: doc.page.width - 100 }) + 16;
  doc.rect(50, doc.y, doc.page.width - 100, h).fillAndStroke('#f5f4f8', '#ddd');
  doc.fillColor(COLORS.text).fontSize(6.5).font('Courier')
    .text(text, 58, doc.y + 8, { width: doc.page.width - 116, lineGap: 0 });
  doc.y += h + 10;
}

function addFooter(doc, pageNum) {
  doc.fontSize(7).fillColor('#888')
    .text(
      `Pick Your Spotlight — Pipeline de recommandation · ${pageNum}`,
      50,
      doc.page.height - 30,
      { align: 'center', width: doc.page.width - 100 }
    );
}

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  bufferPages: true,
  info: {
    Title: 'Pipeline de recommandation — Pick Your Spotlight',
    Author: 'Pick Your Spotlight',
    Subject: 'Documentation technique pipeline reco',
  },
});

const stream = createWriteStream(pdfPath);
doc.pipe(stream);

// ── Title page ──
drawTitlePage(doc);
doc.addPage();

// ── TOC ──
section(doc, 'Table des matières');
const toc = [
  '1. Vue d\'ensemble', '2. Architecture end-to-end', '3. Étapes du pipeline',
  '4. Fichiers source', '5. Filtres et cascade SQL', '6. Chaîne de fallbacks',
  '7. Paramètres et constantes', '8. Échelles de score', '9. Console debug [PICK-DEBUG]',
  '10. État TNR et tests', '11. Performance', '12. Quirks connus',
  '13. Prérequis et garde-fous', '14. Autres points d\'entrée', '15. Recommandations de maintenance',
];
bullet(doc, toc);
doc.addPage();

// ── 1. Overview ──
section(doc, '1. Vue d\'ensemble');
para(doc, 'Le pipeline de recommandation est le moteur cœur de Pick. Il transforme le profil de goût d\'un utilisateur en 1 à 5 films affichés sur l\'écran d\'accueil (« Ce soir »), avec textes personnalisés et score de match.');
para(doc, 'Le pipeline « surprise du soir » s\'active quand l\'utilisateur a ≥ 2 films likés et un vecteur de goût 32D calculé. Sinon, un fallback TMDB léger (getSurpriseRecommendation) complète le batch côté client.');

section(doc, 'Entrées et sorties', 3);
drawTable(doc,
  ['Type', 'Éléments'],
  [
    ['Entrées', 'Profil (tasteProfile), vecteurs stable/recent/avoidance, plateformes, genres exclus, excludeIds, overrides voix/ambiance/duo'],
    ['Sortie', '3 films typiques (recommendationCount défaut 5) : affiche TMDB, reason LLM, score fusionné, textes movie-match'],
  ],
  [80, 415]
);

// ── 2. Architecture ──
section(doc, '2. Architecture end-to-end');
asciiBlock(doc, `CLIENT (React)
  HomeScreen.generateTonightPick
    → taste-engine.ts (computeMultiVectorProfile)
    → invoke surprise-personalized (debug: true)
  recommendation-batch.ts ← movies[] + debugData
    → onBatchReady: 3 films LLM → UI
    → preloadMatchTexts séquentiel → movie-match

EDGE: surprise-personalized
  1. SQL vectoriel cascade (TARGET ~100, plateforme ON)
  1.4 SQL explicite si pool insuffisant
  1.7 Enrichissement langue TMDB
  2. Top 50 score composé
  2.2 Gemini — sélection N films
  3. Enrichissement TMDB batch
  4. discover-fallback si échec

EDGE: movie-match
  Scoring + textes riches — séquentiel par film`);

// ── 3. Étapes ──
section(doc, '3. Étapes du pipeline');
drawTable(doc,
  ['#', 'Étape', 'Comptes', 'Critères'],
  [
    ['0', 'Préparation client', 'excludeIds 20–200+', 'Feedback, rejets session, duo'],
    ['1', 'SQL vectoriel 32D', 'Pool ~100', 'RPC match_movies_for_recommendation, cascade 0→3'],
    ['1.4', 'SQL explicite', 'Jusqu\'à 100', 'match_movies_explicit, 3 niveaux'],
    ['1.7', 'Enrich. langue', '60 max', 'TMDB original_language null'],
    ['2', 'Top composite', '50 films', 'composite = sim×100 + note (+15 langue)'],
    ['2.2', 'LLM Gemini', '50→count+2', 'JSON selections, fallback déterministe'],
    ['3', 'TMDB enrich', '1/film', 'getMovieDetails, retry movie/tv'],
    ['3.5', 'Retry qualité', '+N', 'Si < 3 films ≥ minMatchScore'],
    ['4', 'discover-fallback', '0–3', 'Trending TMDB with_watch_providers'],
    ['5', 'Affichage UI', '3 visibles', 'onBatchReady sans attendre MM'],
    ['6', 'movie-match', '1/film', 'Embedding 32D + Gemini, fusion SP/MM'],
  ],
  [30, 90, 80, 295]
);

// ── 4. Fichiers ──
section(doc, '4. Fichiers source');
drawTable(doc,
  ['Composant', 'Chemin', 'Rôle'],
  [
    ['Profil multi-vecteurs', 'src/lib/taste-engine.ts', 'computeMultiVectorProfile, cache user_taste_vectors'],
    ['Batch client', 'src/lib/recommendation-batch.ts', 'ensureRecommendationBatch, enrichissement MM'],
    ['Orchestration accueil', 'src/components/pick/HomeScreen.tsx', 'generateTonightPick, [PICK-DEBUG]'],
    ['Moteur edge', 'supabase/functions/surprise-personalized/', 'SQL → LLM → TMDB'],
    ['Textes finaux', 'supabase/functions/movie-match/', 'Score 55–99 %, textes riches'],
    ['TNR', 'src/test/recommendation-non-regression.test.ts', 'Invariant exclusions'],
    ['Fonctions pures SP', 'src/lib/recommendation-pipeline.ts', '23 tests unitaires'],
  ],
  [110, 175, 210]
);

// ── 5. Filtres ──
doc.addPage();
section(doc, '5. Filtres et cascade SQL');
para(doc, 'La RPC match_movies_for_recommendation applique une similarité cosinus sur embeddings 32D. Le filtre plateforme n\'est jamais levé. Les niveaux 0→3 relâchent progressivement langue, année, genres, note minimale.');
drawTable(doc,
  ['id debug', 'Étape', 'Description'],
  [
    ['2a-post-filter-origin', 'Langues exclues', 'Filtre langues d\'origine non souhaitées'],
    ['2b-post-filter-voiceGenres', 'Genre vocal', 'Post-filtre genre vocal (seuil ≥ 5)'],
    ['2c-post-filter-decade', 'Décennie', 'voiceDecade (hard) ou profileDecades (soft)'],
    ['5-final-safety', 'Filet final', 'Tri origine + filet genre/langue'],
  ],
  [130, 100, 265]
);

// ── 6. Fallbacks ──
section(doc, '6. Chaîne de fallbacks');
bullet(doc, [
  'Client — getSurpriseRecommendation si < 2 likes ou pas de vecteur',
  '1.4 SQL explicite — vecteur absent ou pool SQL faible (3 niveaux)',
  '2.2 LLM déterministe — si Gemini KO : sélection par score composite',
  '2.5 Retry qualité — complète depuis pool SQL si < 3 films ≥ minMatchScore',
  '4 discover-fallback — trending TMDB with_watch_providers',
  '4b trending-fallback — trending/popular TMDB',
  '4c nuclear-fallback — genre/note levés, plateforme conservée',
  'movie-match FALLBACK — Gemini KO → { fallback: true }, retry 4 s, films réserve',
]);

// ── 7. Params ──
section(doc, '7. Paramètres et constantes');
drawTable(doc,
  ['Paramètre', 'Valeur', 'Description'],
  [
    ['TARGET', '100', 'Pool SQL cible'],
    ['llmPoolSize', '50', 'Top N envoyés au LLM'],
    ['BATCH', '500', 'Taille par round SQL'],
    ['recommendationCount', '5 (défaut)', 'Films demandés ; UI affiche typ. 3'],
    ['LLM sortie', 'count + 2', 'Marge qualité (ex. 5 si count=3)'],
    ['Boost langue', '+15', 'Sur score composite pré-LLM'],
    ['Lang enrich max', '60', 'Candidats original_language null'],
    ['debug', 'true (HomeScreen)', 'Active debugData et [PICK-DEBUG]'],
  ],
  [120, 80, 295]
);

// ── 8. Scores ──
section(doc, '8. Échelles de score');
drawTable(doc,
  ['Échelle', 'Où', 'Plage', 'Usage'],
  [
    ['Sim%', 'SQL / debug', '~0–100', 'Tri candidats debug'],
    ['Composite', 'Pré-LLM', 'sim×100 + note', 'Top 50 avant Gemini'],
    ['LLM matchScore', 'Gemini', '60–99', 'Teaser onBatchReady'],
    ['movie-match', 'Client final', '55–99', 'Badge · fusion max(SP≥60, MM)'],
  ],
  [80, 80, 100, 235]
);
para(doc, 'Attention : les trois échelles ne sont pas directement comparables. Fusion client : ignore SP < 60 %, prend le meilleur entre SP valide et MM.');

// ── 9. Debug ──
doc.addPage();
section(doc, '9. Console debug — [PICK-DEBUG]');
para(doc, 'Activé quand debug: true est envoyé à surprise-personalized (toujours en prod sur HomeScreen).');
drawTable(doc,
  ['Groupe console', 'Champ debugData', 'Contenu'],
  [
    ['Paramètres par étape', 'pipelineStages', 'Params, comptes entrée/sortie, fallback'],
    ['SQL vectoriel 32D', 'sqlCandidates, sqlCascadeLevel', 'Candidats Sim%, snippet RPC'],
    ['Détail cascade', 'sqlLevelDebug', 'Films par niveau 0–3'],
    ['SQL explicite', 'explicitFallbackDebug', 'Complément sans vecteur'],
    ['Top N → LLM', 'top50', 'Jusqu\'à 50 films'],
    ['Sélections LLM', 'llmSelections', 'matchScore + reason'],
    ['Fallback', 'fallbackTrace', 'Mode discover-fallback'],
    ['Timings', 'engineMeta.timings', 'SQL · lang · LLM · TMDB · fallback'],
    ['Résultat MM', '(client)', 'Score MM · rich texts vs FALLBACK'],
  ],
  [120, 130, 245]
);

// ── 10. TNR ──
section(doc, '10. État TNR et tests');
para(doc, 'TNR unitaires : 131/131 OK (25 juin 2026) — dont 70 tests pipeline dédiés.');
drawTable(doc,
  ['Fichier', 'Tests', 'Périmètre'],
  [
    ['taste-engine.test.ts', '28', 'Profil multi-vecteurs'],
    ['recommendation-batch.test.ts', '9', 'Helpers batch client'],
    ['recommendation-pipeline.test.ts', '23', 'Fonctions pures SP'],
    ['recommendation-batch-integration.test.ts', '8', 'Mocks edge, fusion scores'],
    ['recommendation-non-regression.test.ts', '15', 'Invariants exclusions'],
  ],
  [200, 50, 245]
);

section(doc, 'Feuille de route TNR — 3 phases', 3);
drawTable(doc,
  ['Phase', 'État', 'Périmètre'],
  [
    ['1 — Unitaires', 'done', 'taste-engine, batch, pipeline'],
    ['2 — Intégration', 'done (25/06)', 'Fixtures JSON, mocks edge, invariants'],
    ['3 — E2E', 'en cours', 'pipeline.spec.ts, checklist SMOKE_TESTS § 3.2'],
  ],
  [120, 80, 295]
);
para(doc, 'Commandes : npm run test:unit (131 tests, ~10 s) · npm run test:smoke · npm run test:smoke:full');

// ── 11–15 ──
section(doc, '11. Performance');
bullet(doc, [
  'Timings serveur dans engineMeta.timings : SQL, lang, LLM, TMDB, fallback',
  'Timings client : préfixe [Pick⏱] pour SP et movie-match (eager/lazy)',
  'Affichage progressif : onBatchReady sans attendre movie-match',
  'movie-match séquentiel : goulot principal côté client',
  'Backlog 2.8 : Perf reco timeouts UX — todo',
]);

section(doc, '12. Quirks connus (audit juin 2026)');
drawTable(doc,
  ['Quirk', 'Détail', 'Impact'],
  [
    ['reason: null', 'Fallback LLM, retry qualité', 'Raison vide en debug'],
    ['Trois échelles', 'Sim% · LLM · MM', 'Ne pas trier debug par Sim%'],
    ['MM FALLBACK', 'Gemini KO', 'Log FALLBACK, retry 4 s'],
  ],
  [90, 200, 205]
);
para(doc, 'Corrigé (1.23) : sql50/top20 → sqlCandidates/top50 ; platformFallbackTriggered → tasteCascadeTriggered.');

section(doc, '13. Prérequis et garde-fous');
bullet(doc, [
  '≥ 2 likes sinon fallback getSurpriseRecommendation',
  'Vecteur null → SQL explicite ou discover-fallback',
  'Exclusions : excludeIds + usedIds — TNR non-regression',
  'Plateforme toujours en SQL ; safety net client désactivé si plateformes',
  'Auth JWT requise (requireAuth)',
]);

section(doc, '14. Autres points d\'entrée');
drawTable(doc,
  ['Contexte', 'Fichier', 'Variante'],
  [
    ['Wizard /app', 'use-recommendation-engine.ts', 'Même SP, pas debug par défaut'],
    ['Révéler soirée', 'HomeScreen / runRevealPipeline', 'Overrides mood/genres'],
    ['Création événement', 'CreateEventPage.tsx', 'count: 3, pas de MM client'],
    ['Duo', 'HomeScreen + duoUserIds', 'Vecteur fusionné, exclusions partenaire'],
  ],
  [100, 185, 210]
);

doc.addPage();
section(doc, '15. Recommandations de maintenance');
bullet(doc, [
  'Ne pas refactorer le pipeline sans tests 1.19 — satisfait (131 tests)',
  'Avant changement HomeScreen profond : npm run test:unit + non-regression',
  'Clôturer phase 3 TNR : pipeline.spec.ts stable, checklist SMOKE_TESTS § 3.2',
  'Objectif couverture 70 % src/lib/ avant refactor hooks',
  'Conserver cohérence noms debugData (sqlCandidates, top50, tasteCascadeTriggered)',
  'Perf (2.8) : timeouts UX et exploitation engineMeta.timings',
  'TonightPickContext (1.20) : pair humain, PR par étapes',
  'Après modif edge : deploy + smoke manuel § 3.2',
]);

para(doc, 'Document généré le 25 juin 2026 · Références : RECOMMENDATION_PIPELINE.md · BACKLOG.md · SMOKE_TESTS.md');

// Page numbers
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  if (i === 0) continue; // skip title page footer
  doc.switchToPage(i);
  addFooter(doc, i);
}

doc.end();

stream.on('finish', () => {
  import('fs').then(({ statSync }) => {
    const stat = statSync(pdfPath);
    console.log(`PDF generated: ${pdfPath}`);
    console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
    console.log(`Pages: ~${range.count}`);
  });
});
