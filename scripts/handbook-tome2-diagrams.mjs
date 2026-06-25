export const svgJourney = `
<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <text x="360" y="18" text-anchor="middle" font-size="11" fill="#302b63" font-weight="700">Parcours « Pick ce soir » — écran d'accueil</text>
  ${[
    { x: 10, label: 'Tap Ce soir', sub: 'Accueil', color: '#302b63', text: '#fff' },
    { x: 130, label: 'Overlay', sub: 'Chargement', color: '#e8eaf6', text: '#302b63' },
    { x: 250, label: 'Pipeline', sub: 'Reco edge', color: '#e3f2fd', text: '#302b63' },
    { x: 370, label: '3 films', sub: 'Flip cards', color: '#f3e5f5', text: '#302b63' },
    { x: 490, label: 'Swipe', sub: 'Choix', color: '#fff3e0', text: '#302b63' },
    { x: 610, label: 'Film', sub: 'Du soir', color: '#302b63', text: '#fff' },
  ].map((s, i, arr) => {
    const arrow = i < arr.length - 1 ? `<line x1="${s.x + 95}" y1="100" x2="${s.x + 110}" y2="100" stroke="#4a4570" stroke-width="1.5"/>` : '';
    return `${arrow}<rect x="${s.x}" y="55" width="95" height="70" rx="6" fill="${s.color}" stroke="#4a4570" stroke-width="1.5"/>
    <text x="${s.x + 47}" y="88" text-anchor="middle" font-size="9" fill="${s.text}" font-weight="600">${s.label}</text>
    <text x="${s.x + 47}" y="105" text-anchor="middle" font-size="8" fill="${s.text === '#fff' ? '#ddd' : '#5c5780'}">${s.sub}</text>`;
  }).join('')}
  <text x="360" y="165" text-anchor="middle" font-size="8" fill="#5c5780" font-style="italic">Durée cible : moins de 2 minutes · textes enrichis movie-match en arrière-plan</text>
</svg>`;

export const svgPipeline = `
<svg viewBox="0 0 720 320" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <defs><marker id="arrP" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#4a4570"/></marker></defs>
  <text x="360" y="20" text-anchor="middle" font-size="12" fill="#302b63" font-weight="700">Pipeline de recommandation — vue d'ensemble</text>
  <rect x="20" y="40" width="130" height="240" rx="6" fill="#e8eaf6" stroke="#3f51b5" stroke-width="1.5"/>
  <text x="85" y="58" text-anchor="middle" font-size="10" fill="#3f51b5" font-weight="700">Client React</text>
  ${['Profil goût', 'Exclusions', 'Batch client', 'Affichage UI', 'movie-match'].map((l, i) =>
    `<rect x="30" y="${70 + i * 42}" width="110" height="32" rx="4" fill="#fff" stroke="#4a4570"/>
    <text x="85" y="${90 + i * 42}" text-anchor="middle" font-size="8" fill="#302b63">${l}</text>`
  ).join('')}
  <line x1="150" y1="160" x2="175" y2="160" stroke="#4a4570" stroke-width="2" marker-end="url(#arrP)"/>
  <rect x="180" y="40" width="200" height="240" rx="6" fill="#e8f5e9" stroke="#388e3c" stroke-width="1.5"/>
  <text x="280" y="58" text-anchor="middle" font-size="10" fill="#388e3c" font-weight="700">surprise-personalized</text>
  ${['SQL cascade 0→3', 'SQL explicite', 'Enrich. langue', 'Top 50 composite', 'Gemini LLM', 'TMDB enrich', 'Fallbacks'].map((l, i) =>
    `<rect x="190" y="${70 + i * 28}" width="180" height="22" rx="3" fill="#fff" stroke="#4a4570"/>
    <text x="280" y="${85 + i * 28}" text-anchor="middle" font-size="7" fill="#302b63">${l}</text>`
  ).join('')}
  <line x1="380" y1="160" x2="405" y2="160" stroke="#4a4570" stroke-width="2" marker-end="url(#arrP)"/>
  <rect x="410" y="100" width="130" height="120" rx="6" fill="#e0f7fa" stroke="#00838f" stroke-width="1.5"/>
  <text x="475" y="118" text-anchor="middle" font-size="10" fill="#00838f" font-weight="700">movie-match</text>
  ${['Embedding 32D', 'Gemini textes', 'Score 55–99%'].map((l, i) =>
    `<rect x="420" y="${130 + i * 28}" width="110" height="22" rx="3" fill="#fff" stroke="#4a4570"/>
    <text x="475" y="${145 + i * 28}" text-anchor="middle" font-size="7" fill="#302b63">${l}</text>`
  ).join('')}
  <line x1="540" y1="160" x2="565" y2="160" stroke="#4a4570" stroke-width="2" marker-end="url(#arrP)"/>
  <rect x="570" y="100" width="130" height="120" rx="6" fill="#f3e5f5" stroke="#7b1fa2" stroke-width="1.5"/>
  <text x="635" y="118" text-anchor="middle" font-size="10" fill="#7b1fa2" font-weight="700">Interface</text>
  ${['Flip cards', 'Badge match %', 'Textes riches'].map((l, i) =>
    `<rect x="580" y="${130 + i * 28}" width="110" height="22" rx="3" fill="#fff" stroke="#4a4570"/>
    <text x="635" y="${145 + i * 28}" text-anchor="middle" font-size="7" fill="#302b63">${l}</text>`
  ).join('')}
  <text x="360" y="305" text-anchor="middle" font-size="8" fill="#5c5780">Affichage immédiat après LLM · enrichissement movie-match séquentiel en arrière-plan</text>
</svg>`;

export const svgCascade = `
<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <text x="360" y="18" text-anchor="middle" font-size="11" fill="#302b63" font-weight="700">Cascade SQL vectorielle — relâchement progressif</text>
  ${[
    { x: 20, n: '0', label: 'Strict', sub: 'lang · année · genres · note · plateforme', color: '#e8f5e9' },
    { x: 190, n: '1', label: 'Sans lang/année', sub: 'genres · note · plateforme', color: '#e3f2fd' },
    { x: 360, n: '2', label: 'Sans genres profil', sub: 'voiceGenres · note · plateforme', color: '#fff3e0' },
    { x: 530, n: '3', label: 'Minimal goût', sub: 'voiceGenres · plateforme seule', color: '#fce4ec' },
  ].map((l, i) => {
    const arrow = i < 3 ? `<line x1="${l.x + 145}" y1="90" x2="${l.x + 160}" y2="90" stroke="#4a4570" stroke-width="1.5"/>` : '';
    return `${arrow}<rect x="${l.x}" y="45" width="145" height="90" rx="6" fill="${l.color}" stroke="#302b63" stroke-width="1.5"/>
    <text x="${l.x + 72}" y="68" text-anchor="middle" font-size="14" fill="#302b63" font-weight="700">Niv. ${l.n}</text>
    <text x="${l.x + 72}" y="88" text-anchor="middle" font-size="9" fill="#302b63" font-weight="600">${l.label}</text>
    <text x="${l.x + 72}" y="108" text-anchor="middle" font-size="7" fill="#5c5780">${l.sub}</text>`;
  }).join('')}
  <text x="360" y="165" text-anchor="middle" font-size="8" fill="#c62828" font-weight="600">La plateforme n'est JAMAIS levée en cascade SQL</text>
</svg>`;

export const svgFallbacks = `
<svg viewBox="0 0 720 140" xmlns="http://www.w3.org/2000/svg" class="diagram-sm">
  <text x="360" y="16" text-anchor="middle" font-size="10" fill="#302b63" font-weight="700">Chaîne de fallbacks edge (si pool insuffisant)</text>
  ${['SQL vectoriel', 'SQL explicite', 'Discover TMDB', 'Trending', 'Nuclear', 'Safety net'].map((l, i) => {
    const x = 15 + i * 115;
    const colors = ['#e8f5e9','#e3f2fd','#fff3e0','#fce4ec','#ffebee','#302b63'];
    const tc = i === 5 ? '#fff' : '#302b63';
    return `<rect x="${x}" y="35" width="100" height="45" rx="5" fill="${colors[i]}" stroke="#4a4570" stroke-width="1"/>
    <text x="${x + 50}" y="62" text-anchor="middle" font-size="7" fill="${tc}" font-weight="600">${l}</text>
    ${i < 5 ? `<line x1="${x + 100}" y1="57" x2="${x + 115}" y2="57" stroke="#4a4570"/>` : ''}`;
  }).join('')}
  <text x="360" y="110" text-anchor="middle" font-size="8" fill="#5c5780">Chaque étape ne s'active que si la précédente ne produit pas assez de candidats</text>
</svg>`;

export const svgScores = `
<svg viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" class="diagram-sm">
  <text x="360" y="16" text-anchor="middle" font-size="10" fill="#302b63" font-weight="700">Trois échelles de score — non comparables entre elles</text>
  ${[
    { x: 40, label: 'Sim%', range: '0–100', use: 'Tri SQL · debug', color: '#e8eaf6' },
    { x: 260, label: 'LLM matchScore', range: '60–99', use: 'Teaser immédiat', color: '#e8f5e9' },
    { x: 480, label: 'movie-match', range: '55–99', use: 'Badge final UI', color: '#fff3e0' },
  ].map(s => `
    <rect x="${s.x}" y="35" width="180" height="80" rx="6" fill="${s.color}" stroke="#302b63" stroke-width="1.5"/>
    <text x="${s.x + 90}" y="60" text-anchor="middle" font-size="10" fill="#302b63" font-weight="700">${s.label}</text>
    <text x="${s.x + 90}" y="78" text-anchor="middle" font-size="9" fill="#5c5780">Plage : ${s.range}</text>
    <text x="${s.x + 90}" y="98" text-anchor="middle" font-size="8" fill="#5c5780">${s.use}</text>
  `).join('')}
  <text x="360" y="140" text-anchor="middle" font-size="8" fill="#302b63">Fusion client : max(SP ≥ 60, MM) — scores SP &lt; 60 % ignorés comme aberrants</text>
</svg>`;
