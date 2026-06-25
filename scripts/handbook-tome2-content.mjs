import { CHAPTERS_1_5 } from './handbook-tome2-ch1-5.mjs';
import { CHAPTERS_6_10 } from './handbook-tome2-ch6-10.mjs';
import { CHAPTERS_11_16 } from './handbook-tome2-ch11-16.mjs';

const STYLES = `
  @page { size: A4; margin: 18mm 16mm 22mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 10pt; line-height: 1.55; color: #1a1a2e; background: #fff;
  }
  .cover {
    page-break-after: always; height: 297mm;
    background: linear-gradient(145deg, #1a1640 0%, #302b63 50%, #4a4570 100%);
    color: #fff; display: flex; flex-direction: column; justify-content: center;
    align-items: center; text-align: center; padding: 40mm 30mm; position: relative;
  }
  .cover-logo { font-size: 48pt; margin-bottom: 10mm; }
  .cover h1 { font-size: 22pt; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4mm; }
  .cover .subtitle { font-size: 13pt; font-weight: 300; opacity: 0.9; margin-bottom: 15mm; }
  .cover .handbook { font-size: 11pt; text-transform: uppercase; letter-spacing: 3px; opacity: 0.7; margin-bottom: 25mm; }
  .cover-meta { font-size: 9pt; opacity: 0.65; line-height: 1.8; }
  .cover-meta strong { opacity: 1; }
  .cover-version { position: absolute; bottom: 20mm; left: 0; right: 0; font-size: 8pt; opacity: 0.5; }
  h2 { font-size: 16pt; color: #302b63; margin: 8mm 0 4mm; border-bottom: 2px solid #e8e6f5; padding-bottom: 2mm; }
  h3 { font-size: 11pt; color: #4a4570; margin: 5mm 0 2mm; }
  h4 { font-size: 10pt; color: #302b63; margin: 4mm 0 2mm; }
  p { margin-bottom: 3mm; text-align: justify; }
  ul, ol { margin: 2mm 0 4mm 6mm; }
  li { margin-bottom: 1.5mm; }
  section { padding: 0 2mm; }
  .page-break { page-break-before: always; }
  .toc { page-break-after: always; }
  .toc h2 { border: none; }
  .toc-list { list-style: none; margin: 5mm 0; }
  .toc-list li { display: flex; justify-content: space-between; padding: 2mm 0; border-bottom: 1px dotted #ccc; font-size: 10pt; }
  .toc-list .num { color: #302b63; font-weight: 600; min-width: 8mm; }
  .diagram-wrap { margin: 5mm 0; text-align: center; }
  .diagram { width: 100%; max-width: 170mm; height: auto; }
  .diagram-sm { width: 100%; max-width: 170mm; height: auto; }
  .callout { border-radius: 4px; padding: 3mm 4mm; margin: 4mm 0; font-size: 9pt; line-height: 1.5; }
  .callout strong { display: block; margin-bottom: 1mm; font-size: 9pt; }
  .callout-info { background: #e8eaf6; border-left: 3px solid #3f51b5; }
  .callout-good { background: #e8f5e9; border-left: 3px solid #388e3c; }
  .callout-arch { background: #fff3e0; border-left: 3px solid #f57c00; }
  .callout-warn { background: #fff8e1; border-left: 3px solid #ffc107; }
  table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9pt; }
  thead th { background: #302b63; color: #fff; padding: 2.5mm 3mm; text-align: left; font-weight: 600; }
  tbody td { padding: 2.5mm 3mm; border-bottom: 1px solid #e8e6f5; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f8f7fc; }
  .stack-category { font-weight: 600; color: #302b63; }
  .intro-box { background: linear-gradient(135deg, #f5f4f8, #e8e6f5); border-radius: 6px; padding: 5mm 6mm; margin: 5mm 0; border: 1px solid #d8d4e8; }
  .intro-box p { font-size: 10pt; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .stat-box { text-align: center; background: #302b63; color: #fff; border-radius: 6px; padding: 4mm; }
  .stat-box .num { font-size: 18pt; font-weight: 700; }
  .stat-box .label { font-size: 8pt; opacity: 0.8; }
  .step-block { background: #f8f7fc; border-radius: 4px; padding: 3mm 4mm; margin-bottom: 3mm; border-left: 3px solid #302b63; }
  .ascii-diagram { font-family: 'Consolas', 'Courier New', monospace; font-size: 8pt; background: #f5f4f8; padding: 4mm; border-radius: 4px; line-height: 1.4; white-space: pre; margin: 4mm 0; }
`;

export function buildHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Pick — Engineering Handbook — Tome 2</title>
<style>${STYLES}</style>
</head>
<body>

<div class="cover">
  <div class="cover-logo">🎯</div>
  <div class="handbook">Engineering Handbook</div>
  <h1>Pick — Tome 2</h1>
  <div class="subtitle">Moteur de recommandation</div>
  <div class="cover-meta">
    <strong>Projet</strong> Pick Your Spotlight<br/>
    <strong>Auteur</strong> Chris — Pick Your Spotlight team<br/>
    <strong>Date</strong> Juin 2026<br/>
    <strong>Version</strong> 1.0
  </div>
  <div class="cover-version">Document confidentiel — usage interne et partenaires · Suite du Tome 1 (Vision &amp; Architecture)</div>
</div>

<section class="toc">
  <h2>Table des matières</h2>
  <ul class="toc-list">
    <li><span class="num">1</span> Introduction <span>3</span></li>
    <li><span class="num">2</span> Parcours « Pick ce soir » <span>5</span></li>
    <li><span class="num">3</span> Vue d'ensemble du pipeline <span>8</span></li>
    <li><span class="num">4</span> Les entrées du moteur <span>11</span></li>
    <li><span class="num">5</span> Étape par étape <span>14</span></li>
    <li><span class="num">6</span> Filtres successifs <span>19</span></li>
    <li><span class="num">7</span> Paramètres et overrides <span>22</span></li>
    <li><span class="num">8</span> Les trois échelles de score <span>25</span></li>
    <li><span class="num">9</span> Quirks connus <span>28</span></li>
    <li><span class="num">10</span> Modes spéciaux <span>30</span></li>
    <li><span class="num">11</span> Performance <span>33</span></li>
    <li><span class="num">12</span> Debug &amp; observabilité <span>35</span></li>
    <li><span class="num">13</span> Qualité &amp; TNR <span>38</span></li>
    <li><span class="num">14</span> Évolutions prévues <span>40</span></li>
    <li><span class="num">15</span> Glossaire technique produit <span>42</span></li>
    <li><span class="num">16</span> FAQ moteur <span>44</span></li>
  </ul>
  <div class="callout callout-info">
    <strong>ℹ À propos de ce document</strong>
    <p>Ce tome complète le <strong>Tome 1 — Vision &amp; Architecture</strong> en documentant le moteur de recommandation de Pick : parcours utilisateur, pipeline runtime, filtres, scores, debug et qualité. Il s'adresse aux développeurs, QA et partenaires techniques — sans extraits de code ni chemins de fichiers.</p>
  </div>
</section>

${CHAPTERS_1_5}
${CHAPTERS_6_10}
${CHAPTERS_11_16}

</body>
</html>`;
}
