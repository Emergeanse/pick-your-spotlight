/**
 * Génère docs/handbook/TOME_1_Vision_Architecture.pdf
 * et sauvegarde la source HTML pour éditions futures.
 *
 * Usage: node scripts/generate-handbook-tome1-pdf.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'docs', 'handbook');
const HTML_PATH = join(OUT_DIR, 'tome-1-source.html');
const PDF_PATH = join(OUT_DIR, 'TOME_1_Vision_Architecture.pdf');

// ─── SVG helpers ─────────────────────────────────────────────────────────────

const svgProblemFlow = `
<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#4a4570"/>
    </marker>
  </defs>
  <rect x="10" y="60" width="110" height="80" rx="8" fill="#e8e6f5" stroke="#302b63" stroke-width="1.5"/>
  <text x="65" y="95" text-anchor="middle" font-size="11" fill="#302b63" font-weight="600">Plateformes</text>
  <text x="65" y="115" text-anchor="middle" font-size="9" fill="#5c5780">Netflix · Prime ·</text>
  <text x="65" y="128" text-anchor="middle" font-size="9" fill="#5c5780">Disney+ · Canal+…</text>
  <line x1="120" y1="100" x2="155" y2="100" stroke="#4a4570" stroke-width="2" marker-end="url(#arr)"/>
  <rect x="160" y="60" width="110" height="80" rx="8" fill="#fff3e0" stroke="#e65100" stroke-width="1.5"/>
  <text x="215" y="95" text-anchor="middle" font-size="11" fill="#e65100" font-weight="600">500 000+</text>
  <text x="215" y="115" text-anchor="middle" font-size="9" fill="#5c5780">titres disponibles</text>
  <text x="215" y="128" text-anchor="middle" font-size="9" fill="#5c5780">films &amp; séries</text>
  <line x1="270" y1="100" x2="305" y2="100" stroke="#4a4570" stroke-width="2" marker-end="url(#arr)"/>
  <rect x="310" y="60" width="110" height="80" rx="8" fill="#fce4ec" stroke="#c62828" stroke-width="1.5"/>
  <text x="365" y="95" text-anchor="middle" font-size="11" fill="#c62828" font-weight="600">~45 min</text>
  <text x="365" y="115" text-anchor="middle" font-size="9" fill="#5c5780">de recherche</text>
  <text x="365" y="128" text-anchor="middle" font-size="9" fill="#5c5780">moyenne / soirée</text>
  <line x1="420" y1="100" x2="455" y2="100" stroke="#4a4570" stroke-width="2" marker-end="url(#arr)"/>
  <rect x="460" y="60" width="110" height="80" rx="8" fill="#ffebee" stroke="#b71c1c" stroke-width="2"/>
  <text x="515" y="95" text-anchor="middle" font-size="11" fill="#b71c1c" font-weight="700">Frustration</text>
  <text x="515" y="115" text-anchor="middle" font-size="9" fill="#5c5780">abandon · conflit</text>
  <text x="515" y="128" text-anchor="middle" font-size="9" fill="#5c5780">« on ne regarde rien »</text>
  <text x="360" y="30" text-anchor="middle" font-size="10" fill="#5c5780" font-style="italic">Le paradoxe du choix — chaque soir, le même cycle</text>
</svg>`;

const svgResponseFlow = `
<svg viewBox="0 0 720 120" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <defs><marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#302b63"/></marker></defs>
  ${['Utilisateur','Onboarding','Profil goût','Moteur reco','Movie Match','Film du soir'].map((label, i) => {
    const x = 10 + i * 118;
    const colors = ['#e3f2fd','#e8f5e9','#fff8e1','#f3e5f5','#e0f7fa','#302b63'];
    const textCol = i === 5 ? '#fff' : '#302b63';
    const stroke = i === 5 ? '#1a1640' : '#4a4570';
    const arrow = i < 5 ? `<line x1="${x+95}" y1="55" x2="${x+113}" y2="55" stroke="#302b63" stroke-width="1.5" marker-end="url(#arr2)"/>` : '';
    return `${arrow}<rect x="${x}" y="25" width="95" height="60" rx="6" fill="${colors[i]}" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${x+47}" y="58" text-anchor="middle" font-size="9" fill="${textCol}" font-weight="600">${label}</text>`;
  }).join('')}
</svg>`;

const svgArchStack = `
<svg viewBox="0 0 720 340" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <text x="360" y="22" text-anchor="middle" font-size="12" fill="#302b63" font-weight="700">Architecture technique — couches</text>
  ${[
    { y: 35, h: 55, label: 'Couche présentation', sub: 'React 18 · TypeScript · Vite · Tailwind · shadcn/ui · Framer Motion', color: '#e8eaf6', stroke: '#3f51b5' },
    { y: 100, h: 55, label: 'Couche application', sub: 'React Query · React Router · Hooks métier · Gestion d\'état locale', color: '#e3f2fd', stroke: '#1976d2' },
    { y: 165, h: 55, label: 'Couche services', sub: 'Supabase Client · Edge Functions (Deno) · TMDB · Gemini · ElevenLabs', color: '#e8f5e9', stroke: '#388e3c' },
    { y: 230, h: 55, label: 'Couche données', sub: 'PostgreSQL (Supabase) · Auth · Storage · Vecteurs goût · Embeddings films', color: '#fff3e0', stroke: '#f57c00' },
    { y: 295, h: 35, label: 'Qualité & déploiement', sub: 'Vitest · Playwright · GitHub Actions · CI/CD', color: '#fce4ec', stroke: '#c2185b' },
  ].map(l => `
    <rect x="40" y="${l.y}" width="640" height="${l.h}" rx="6" fill="${l.color}" stroke="${l.stroke}" stroke-width="1.5"/>
    <text x="60" y="${l.y + 22}" font-size="11" fill="${l.stroke}" font-weight="700">${l.label}</text>
    <text x="60" y="${l.y + 40}" font-size="9" fill="#5c5780">${l.sub}</text>
  `).join('')}
</svg>`;

const svgUserFlow = `
<svg viewBox="0 0 720 280" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <text x="360" y="22" text-anchor="middle" font-size="12" fill="#302b63" font-weight="700">Parcours utilisateur principal</text>
  <rect x="300" y="40" width="120" height="40" rx="20" fill="#302b63"/><text x="360" y="65" text-anchor="middle" font-size="10" fill="#fff" font-weight="600">Accueil Pick</text>
  <line x1="360" y1="80" x2="360" y2="100" stroke="#4a4570" stroke-width="1.5"/>
  <rect x="280" y="105" width="160" height="35" rx="6" fill="#e8eaf6" stroke="#3f51b5"/><text x="360" y="127" text-anchor="middle" font-size="9" fill="#302b63">Onboarding initiatique</text>
  <line x1="360" y1="140" x2="360" y2="155" stroke="#4a4570" stroke-width="1.5"/>
  <rect x="250" y="160" width="220" height="35" rx="6" fill="#e3f2fd" stroke="#1976d2"/><text x="360" y="182" text-anchor="middle" font-size="9" fill="#302b63">Wizard Pick ce soir (humeur · genre · plateforme)</text>
  <line x1="360" y1="195" x2="360" y2="210" stroke="#4a4570" stroke-width="1.5"/>
  <rect x="230" y="215" width="260" height="35" rx="6" fill="#f3e5f5" stroke="#7b1fa2"/><text x="360" y="237" text-anchor="middle" font-size="9" fill="#302b63">Résultats · flip cards · film du soir</text>
  <line x1="200" y1="232" x2="130" y2="260" stroke="#4a4570" stroke-width="1"/><line x1="360" y1="250" x2="360" y2="260" stroke="#4a4570"/><line x1="520" y1="232" x2="590" y2="260" stroke="#4a4570"/>
  <rect x="50" y="262" width="100" height="28" rx="4" fill="#e8f5e9" stroke="#388e3c"/><text x="100" y="280" text-anchor="middle" font-size="8" fill="#302b63">Watchlist</text>
  <rect x="310" y="262" width="100" height="28" rx="4" fill="#fff3e0" stroke="#f57c00"/><text x="360" y="280" text-anchor="middle" font-size="8" fill="#302b63">Soirées</text>
  <rect x="570" y="262" width="100" height="28" rx="4" fill="#fce4ec" stroke="#c2185b"/><text x="620" y="280" text-anchor="middle" font-size="8" fill="#302b63">Duo / Match</text>
</svg>`;

const svgRoadmap = `
<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" class="diagram">
  <text x="360" y="20" text-anchor="middle" font-size="12" fill="#302b63" font-weight="700">Feuille de route produit 2026</text>
  <line x1="40" y1="100" x2="680" y2="100" stroke="#302b63" stroke-width="3"/>
  ${[
    { x: 50, label: 'Alpha', sub: 'Juin', done: true },
    { x: 140, label: 'Beta fermée', sub: 'Été', done: false },
    { x: 240, label: 'Beta publique', sub: 'Automne', done: false },
    { x: 340, label: 'V1', sub: 'Q4', done: false },
    { x: 420, label: 'Pick+', sub: 'Monétisation', done: false },
    { x: 500, label: 'Duo', sub: 'Social', done: false },
    { x: 570, label: 'Groupe', sub: 'Pick Together', done: false },
    { x: 650, label: 'IA conv.', sub: 'Assistant', done: false },
  ].map(m => `
    <circle cx="${m.x}" cy="100" r="10" fill="${m.done ? '#302b63' : '#fff'}" stroke="#302b63" stroke-width="2"/>
    <text x="${m.x}" y="130" text-anchor="middle" font-size="8" fill="#302b63" font-weight="600">${m.label}</text>
    <text x="${m.x}" y="143" text-anchor="middle" font-size="7" fill="#5c5780">${m.sub}</text>
  `).join('')}
</svg>`;

function moduleDiagram(title, steps) {
  const w = 640;
  const stepW = Math.min(120, (w - 40) / steps.length - 10);
  return `<svg viewBox="0 0 720 90" xmlns="http://www.w3.org/2000/svg" class="diagram-sm">
    ${steps.map((s, i) => {
      const x = 30 + i * (stepW + 15);
      const arrow = i < steps.length - 1 ? `<line x1="${x + stepW}" y1="45" x2="${x + stepW + 12}" y2="45" stroke="#4a4570" stroke-width="1.5"/>` : '';
      return `${arrow}<rect x="${x}" y="20" width="${stepW}" height="50" rx="5" fill="#f5f4f8" stroke="#302b63" stroke-width="1"/>
      <text x="${x + stepW/2}" y="50" text-anchor="middle" font-size="8" fill="#302b63">${s}</text>`;
    }).join('')}
  </svg>`;
}

// ─── HTML document ─────────────────────────────────────────────────────────

function buildHtml() {
  const modules = [
    {
      icon: '🎬',
      title: 'Onboarding initiatique',
      objectif: 'Construire un profil de goût cinématographique riche dès les premières minutes, sans formulaire fastidieux. L\'onboarding initiatique transforme l\'inscription en expérience ludique : l\'utilisateur « apprend » à Pick ce qu\'il aime en swipant films, acteurs et réalisateurs.',
      fonctionnement: 'Parcours en huit étapes progressives : sélection de films aimés, exploration d\'acteurs et réalisateurs favoris, calibration du profil. Chaque interaction alimente les vecteurs de goût (stable, récent, évitements). Le profil est persisté côté serveur et peut être repris si l\'utilisateur interrompt le parcours.',
      diagram: moduleDiagram('Onboarding', ['Inscription', 'Films aimés', 'Acteurs', 'Réalisateurs', 'Profil goût']),
      extra: 'L\'onboarding n\'est pas optionnel pour une expérience optimale : sans profil initial, les recommandations restent génériques. Pick rappelle et guide les utilisateurs dont le parcours est incomplet.',
      usecase: 'Marie, nouvelle utilisatrice, ouvre Pick un vendredi soir. En cinq minutes, elle a liké une douzaine de films, sélectionné trois acteurs favoris et deux réalisateurs. Son profil est prêt : les premières recommandations sont déjà personnalisées, pas génériques.',
    },
    {
      icon: '🎯',
      title: 'Moteur de recommandation',
      objectif: 'Proposer le bon film pour ce soir, en quelques secondes, en croisant le profil de goût, l\'humeur du moment, les plateformes disponibles et l\'historique de visionnage. Le moteur n\'est pas un catalogue : c\'est un assistant de décision.',
      fonctionnement: 'Le wizard « Pick ce soir » collecte type de média, humeur, genres et plateformes. Le pipeline cascade filtre des candidats via requêtes intelligentes, score chaque titre avec des embeddings et la similarité cosinus sur le profil goût, puis une couche IA (Gemini) sélectionne et justifie les trois meilleures propositions. Un filet de sécurité garantit toujours trois résultats.',
      diagram: moduleDiagram('Reco', ['Wizard', 'Candidats SQL', 'Scoring', 'Gemini', '3 films']),
      extra: 'Le moteur intègre des exclusions automatiques : films déjà vus, dislikes explicites, genres évités. Les métriques de debug permettent à l\'équipe de tracer chaque étape en alpha.',
      usecase: 'Thomas veut un film léger sur Netflix après une journée difficile. Il sélectionne « Comédie », humeur « détente », plateforme Netflix. En 90 secondes, Pick lui propose trois comédies françaises récentes qu\'il n\'a pas vues — dont une qui devient son film préféré du mois.',
    },
    {
      icon: '🔍',
      title: 'Match (photo & voix)',
      objectif: 'Identifier un film à partir d\'un indice visuel ou vocal — affiche floue, citation, description orale — quand l\'utilisateur sait vaguement ce qu\'il cherche mais pas le titre exact.',
      fonctionnement: 'L\'utilisateur capture une photo ou dicte une description. Gemini analyse l\'image ou le texte, croise avec la base TMDB et retourne les correspondances probables avec niveau de confiance. Le module complète le parcours principal sans le remplacer.',
      diagram: moduleDiagram('Match', ['Photo / voix', 'Analyse IA', 'TMDB', 'Résultats']),
      extra: 'Cas d\'usage typique : « Ce film avec l\'acteur chauve dans l\'espace » ou photographie d\'une affiche aperçue dans le métro.',
      usecase: 'Sophie voit une affiche dans le métro sans retenir le titre. Elle photographie l\'affiche avec Match : Gemini identifie « Anatomie d\'une chute » de Justine Triet avec 92 % de confiance. Un tap et le film est dans sa watchlist.',
    },
    {
      icon: '🎉',
      title: 'Révéler (Soirées)',
      objectif: 'Transformer le choix d\'un film en moment social partagé. Les soirées permettent d\'organiser une session collective, de définir des critères communs et de révéler le film choisi au moment opportun — comme ouvrir un cadeau.',
      fonctionnement: 'Création d\'une soirée en trois étapes : critères (genres, humeur, type), invitation des participants via lien unique, puis lancement du pipeline de recommandation adapté au groupe. La révélation affiche le film sans flash parasite, avec overlay instantané. L\'intent soirée propage les préférences vers le moteur reco.',
      diagram: moduleDiagram('Soirées', ['Création', 'Invite', 'Reco groupe', 'Révéler']),
      extra: 'En alpha, le parcours soirées est en cours de stabilisation bout-en-bout. L\'objectif beta : création → invitation → révélation fluide pour 2 à 10 participants.',
      usecase: 'Lucas organise une soirée film avec cinq amis. Il crée la soirée, définit « Science-fiction, intense », envoie le lien. Chacun rejoint, le moteur propose trois films. À 21h, Lucas révèle le choix : « Interstellar » — moment de surprise collective garanti.',
    },
    {
      icon: '⭐',
      title: 'Watchlist',
      objectif: 'Conserver les films repérés pour plus tard, sans perdre la trace dans le flux des recommandations quotidiennes.',
      fonctionnement: 'Ajout en un geste depuis les flip cards ou la fiche détail. La watchlist est synchronisée avec le compte utilisateur et accessible depuis la navigation principale. Les titres watchlistés influencent le profil de goût par des signaux positifs différés.',
      diagram: moduleDiagram('Watchlist', ['Découverte', 'Ajout', 'Sync cloud', 'Consultation']),
      extra: 'La watchlist s\'articule avec la bibliothèque : un film watchlisté puis vu migre naturellement vers l\'historique.',
      usecase: 'Emma découvre « The Holdovers » via une recommandation mais n\'a pas le temps ce soir. Un tap sur l\'étoile : le film rejoint sa watchlist. Deux semaines plus tard, un vendredi calme, elle consulte sa liste et lance le film sur Disney+.',
    },
    {
      icon: '📚',
      title: 'Bibliothèque (Mon cinéma)',
      objectif: 'Offrir une vue personnelle de l\'historique cinématographique : films vus, aimés, notés — le « ADN cinéma » matérialisé.',
      fonctionnement: 'Agrégation des interactions (likes, vues, skips, notes) en profil visuel. La page Mon cinéma expose l\'historique, les statistiques de genres et les tendances. Le profil ADN cinéma détaille les vecteurs de goût sous forme accessible.',
      diagram: moduleDiagram('Bibliothèque', ['Interactions', 'Vecteurs goût', 'Historique', 'ADN']),
      extra: 'La bibliothèque est le miroir du moteur de recommandation : ce que l\'utilisateur y voit reflète ce que Pick « comprend » de ses goûts.',
      usecase: 'Antoine consulte son ADN cinéma : 42 % drame, 28 % thriller, affinité forte pour Denis Villeneuve et Cillian Murphy. Il comprend pourquoi Pick lui propose « Prisoners » un soir de novembre — et apprécie la transparence.',
    },
    {
      icon: '✨',
      title: 'Pick+',
      objectif: 'Proposer une expérience premium avec fonctionnalités avancées — recommandations illimitées, filtres poussés, priorité sur les nouveautés — tout en gardant une version gratuite généreuse en alpha.',
      fonctionnement: 'Couche d\'abonnement gérée côté client avec garde-fous freemium. En alpha, les limites sont assouplies et le paywall affiche « Bientôt ». L\'architecture anticipe l\'intégration Stripe pour la monétisation en beta publique.',
      diagram: moduleDiagram('Pick+', ['Gratuit', 'Limites', 'Premium', 'Stripe']),
      extra: 'Pick+ n\'est pas un module technique isolé : c\'est une stratégie produit qui influence le gating des fonctionnalités dans toute l\'application.',
      usecase: 'En alpha, tous les utilisateurs bénéficient de l\'expérience complète gratuitement. Le paywall « Bientôt » sur la page Pick+ communique l\'intention premium sans bloquer l\'expérience — préparant la transition vers un modèle freemium en beta publique.',
    },
    {
      icon: '👥',
      title: 'Pick Together & Duo',
      objectif: 'Résoudre le dilemme du choix à deux (ou en petit groupe) en fusionnant les profils de goût et en trouvant un compromis satisfaisant pour tous.',
      fonctionnement: 'Duo : deux profils liés, recommandations croisées tenant compte des goûts communs et des divergences. Pick Together : session collaborative multi-utilisateurs avec présence temps réel, votes et convergence vers un titre unique. Les sessions sont hébergées sur Supabase avec synchronisation en direct.',
      diagram: moduleDiagram('Duo', ['Lien duo', 'Profils fusionnés', 'Reco commune', 'Choix']),
      extra: 'En alpha, Duo et Pick Together sont en beta avancée avec marquage « Bientôt » sur certaines options. Le mode groupe au-delà de deux personnes est planifié pour fin 2026.',
      usecase: 'Julie aime les comédies romantiques, son partenaire Max préfère les thrillers. En mode Duo, Pick croise leurs profils et propose « Game Night » — une comédie suspense qui satisfait les deux goûts sans compromis frustrant.',
    },
  ];

  const personas = [
    { icon: '🎞️', name: 'Le cinéphile', desc: 'Regarde 5+ films par semaine, connaît les réalisateurs, cherche la perle rare. Utilise Pick pour découvrir hors algorithmes plateforme. Sensibilité : qualité des recommandations, profondeur du profil ADN, accès aux films d\'auteur.' },
    { icon: '💑', name: 'Le couple', desc: 'Deux goûts différents, un canapé. Le vendredi soir, 45 minutes à scroller sans décider. Utilise Duo et les soirées pour trouver le compromis. Sensibilité : rapidité, mode duo, révélation ludique.' },
    { icon: '🍿', name: 'Les amis', desc: 'Soirée chez l\'un d\'eux, 4-6 personnes, personne ne veut imposer son choix. Utilise Pick Together et les soirées groupe. Sensibilité : invitation simple, vote collectif, expérience sociale.' },
    { icon: '👨‍👩‍👧‍👦', name: 'La famille', desc: 'Parents avec enfants, besoin de contenu adapté à tous les âges. Utilise les filtres genre/humeur et les profils séparés. Sensibilité : sécurité contenu, simplicité, pas de violence/graphique non désiré.' },
  ];

  const principles = [
    {
      title: 'Simplicité',
      body: 'Chaque écran doit répondre à une question unique. Le wizard Pick ce soir ne demande que l\'essentiel : type, humeur, genre, plateforme. Pas de configuration avancée exposée par défaut. La complexité technique reste invisible — l\'utilisateur voit trois films, pas un algorithme.',
      practice: 'Limiter les choix par écran à 5-7 options. Utiliser des défauts intelligents basés sur le profil. Masquer les options avancées derrière Pick+.',
      decision: 'Wizard linéaire plutôt que page de filtres exhaustive. Décision validée par les tests utilisateurs alpha.',
    },
    {
      title: 'Confidentialité',
      body: 'Les goûts cinématographiques sont intimes. Pick ne vend pas de données, ne publie pas de profils et minimise la collecte. L\'authentification passe par Supabase Auth ; les données de goût restent liées au compte et ne sont pas exposées aux autres utilisateurs sans consentement explicite (Duo, soirées).',
      practice: 'Rôles admin côté serveur uniquement. Rate limiting sur les fonctions de recherche d\'utilisateurs. Politique de confidentialité avant beta publique.',
      decision: 'Hébergement Supabase en Europe. Pas de tracking tiers en alpha. Secret TMDB côté serveur avant ouverture aux testeurs externes.',
    },
    {
      title: 'IA comme assistance',
      body: 'L\'intelligence artificielle (Gemini) assiste la décision, elle ne la remplace pas. Le moteur filtre d\'abord par données structurées et vecteurs ; l\'IA intervient en dernier pour sélectionner, classer et rédiger les justifications. En cas d\'indisponibilité IA, des fallbacks garantissent des résultats.',
      practice: 'Cascade de modèles (gemini-2.5-flash → gemini-2.0-flash). Timeouts et retry avec messages utilisateur clairs. Jamais de résultat vide.',
      decision: 'Gemini choisi pour le rapport qualité/coût/latence. Pas de dépendance à un seul modèle.',
    },
    {
      title: 'Testabilité',
      body: 'Un produit qui recommande des films doit pouvoir être testé sans regarder 500 films. Pick investit dans les tests automatisés : 131 tests unitaires sur la logique métier, tests d\'intégration avec fixtures JSON, 33 scénarios E2E Playwright, CI GitHub Actions sur chaque PR.',
      practice: 'Fonctions pures extraites du pipeline. Fixtures pour les réponses edge functions. Smoke tests reproductibles en moins de 2 minutes.',
      decision: 'Vitest pour la vitesse. Playwright pour les parcours critiques. Objectif 70 % couverture sur la logique métier avant refactor majeur.',
    },
  ];

  const archChoices = [
    { name: 'React 18', text: 'Framework UI mature, écosystème riche, compatibilité mobile via responsive design. React 18 apporte la concurrence et les transitions pour des animations fluides (Framer Motion) sans bloquer l\'interface. Choix naturel pour une SPA interactive avec de nombreux écrans et états.' },
    { name: 'Supabase', text: 'Backend-as-a-Service combinant PostgreSQL, authentification, temps réel et edge functions. Élimine la gestion d\'infrastructure pour une équipe réduite. Le temps réel est essentiel pour Duo et Pick Together (présence, votes). PostgreSQL supporte nativement les vecteurs pour le profil goût.' },
    { name: 'Edge Functions (Deno)', text: 'Logique serveur déployée au plus près des utilisateurs. Les fonctions surprise-personalized, movie-match, identify-film et companion-chat s\'exécutent en Deno sur l\'infrastructure Supabase. Avantages : latence réduite, secrets serveur (clés API), scalabilité automatique.' },
    { name: 'TypeScript', text: 'Typage statique sur l\'ensemble du frontend et partagé avec les types Supabase générés. Réduit les erreurs de runtime sur un domaine complexe (films, profils, sessions). Standard de l\'industrie pour les applications React professionnelles.' },
    { name: 'Vite', text: 'Bundler moderne, démarrage instantané en dev, builds optimisés pour la production. Remplace Create React App avec une DX supérieure. Plugin React SWC pour une compilation rapide.' },
    { name: 'TMDB', text: 'The Movie Database : source de vérité pour les métadonnées films et séries (titres, affiches, genres, disponibilité plateformes). API mature, communauté active, couverture internationale. Toutes les requêtes en français (fr-FR) pour le public cible.' },
    { name: 'Google Gemini', text: 'Modèle IA principal pour la sélection de films, l\'identification visuelle, le chat compagnon et les profils cinématographiques. Cascade gemini-2.5-flash → gemini-2.0-flash pour la résilience. Interface OpenAI-compatible via l\'API Google AI.' },
    { name: 'Vitest', text: 'Runner de tests unitaires natif Vite, rapide, compatible Jest. 131 tests couvrant le taste engine, le pipeline de recommandation, les interactions films et l\'onboarding. Exécution en ~10 secondes sans réseau.' },
    { name: 'Playwright', text: 'Tests E2E cross-browser (Chromium en CI). 33 scénarios couvrant auth, navigation, pipeline reco, révélation, cinéma, soirées, onboarding. Mocks des edge functions pour des tests déterministes.' },
    { name: 'GitHub Actions', text: 'CI/CD intégré : lint + TypeScript + tests unitaires sur chaque PR, E2E sur push main. Secrets pour le compte test E2E. Garantit que chaque merge préserve la non-régression.' },
  ];

  const modulePages = modules.map(m => `
    <section class="module-page page-break">
      <div class="module-header">
        <span class="module-icon">${m.icon}</span>
        <h2>${m.title}</h2>
      </div>
      <div class="module-grid">
        <div class="module-block">
          <h3>◆ Objectif</h3>
          <p>${m.objectif}</p>
        </div>
        <div class="module-block">
          <h3>◆ Fonctionnement</h3>
          <p>${m.fonctionnement}</p>
        </div>
      </div>
      <div class="diagram-wrap">${m.diagram}</div>
      <div class="callout callout-info">
        <strong>ℹ Note produit</strong>
        <p>${m.extra}</p>
      </div>
      <div class="callout callout-good">
        <strong>✓ Cas d'usage</strong>
        <p>${m.usecase}</p>
      </div>
    </section>
  `).join('');

  const personaCards = personas.map(p => `
    <div class="persona-card">
      <div class="persona-icon">${p.icon}</div>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
    </div>
  `).join('');

  const principleSections = principles.map(p => `
    <div class="principle-block">
      <h3>§ ${p.title}</h3>
      <p>${p.body}</p>
      <div class="callout callout-good">
        <strong>✓ Bonnes pratiques</strong>
        <p>${p.practice}</p>
      </div>
      <div class="callout callout-arch">
        <strong>⚙ Décision d'architecture</strong>
        <p>${p.decision}</p>
      </div>
    </div>
  `).join('');

  const archChoiceSections = archChoices.map(a => `
    <div class="arch-choice">
      <h3>${a.name}</h3>
      <p>${a.text}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Pick — Engineering Handbook — Tome 1</title>
<style>
  @page { size: A4; margin: 18mm 16mm 22mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: #1a1a2e;
    background: #fff;
  }

  /* ── Cover ── */
  .cover {
    page-break-after: always;
    height: 297mm;
    background: linear-gradient(145deg, #1a1640 0%, #302b63 50%, #4a4570 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 40mm 30mm;
    position: relative;
  }
  .cover-logo { font-size: 48pt; margin-bottom: 10mm; }
  .cover h1 { font-size: 22pt; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4mm; }
  .cover .subtitle { font-size: 13pt; font-weight: 300; opacity: 0.9; margin-bottom: 15mm; }
  .cover .handbook { font-size: 11pt; text-transform: uppercase; letter-spacing: 3px; opacity: 0.7; margin-bottom: 25mm; }
  .cover-meta { font-size: 9pt; opacity: 0.65; line-height: 1.8; }
  .cover-meta strong { opacity: 1; }
  .cover-version {
    position: absolute; bottom: 20mm; left: 0; right: 0;
    font-size: 8pt; opacity: 0.5;
  }

  /* ── Typography ── */
  h2 { font-size: 16pt; color: #302b63; margin: 8mm 0 4mm; border-bottom: 2px solid #e8e6f5; padding-bottom: 2mm; }
  h3 { font-size: 11pt; color: #4a4570; margin: 5mm 0 2mm; }
  p { margin-bottom: 3mm; text-align: justify; }
  ul { margin: 2mm 0 4mm 6mm; }
  li { margin-bottom: 1.5mm; }

  section { padding: 0 2mm; }
  .page-break { page-break-before: always; }

  /* ── TOC ── */
  .toc { page-break-after: always; }
  .toc h2 { border: none; }
  .toc-list { list-style: none; margin: 5mm 0; }
  .toc-list li {
    display: flex; justify-content: space-between;
    padding: 2mm 0; border-bottom: 1px dotted #ccc;
    font-size: 10pt;
  }
  .toc-list .num { color: #302b63; font-weight: 600; min-width: 8mm; }

  /* ── Diagrams ── */
  .diagram-wrap { margin: 5mm 0; text-align: center; }
  .diagram { width: 100%; max-width: 170mm; height: auto; }
  .diagram-sm { width: 100%; max-width: 170mm; height: auto; }

  /* ── Callouts ── */
  .callout {
    border-radius: 4px; padding: 3mm 4mm; margin: 4mm 0;
    font-size: 9pt; line-height: 1.5;
  }
  .callout strong { display: block; margin-bottom: 1mm; font-size: 9pt; }
  .callout-info { background: #e8eaf6; border-left: 3px solid #3f51b5; }
  .callout-good { background: #e8f5e9; border-left: 3px solid #388e3c; }
  .callout-arch { background: #fff3e0; border-left: 3px solid #f57c00; }
  .callout-warn { background: #fff8e1; border-left: 3px solid #ffc107; }

  /* ── Personas ── */
  .persona-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 5mm 0; }
  .persona-card {
    border: 1px solid #e0dce8; border-radius: 6px; padding: 4mm;
    background: #faf9fc;
  }
  .persona-icon { font-size: 20pt; margin-bottom: 2mm; }
  .persona-card h3 { font-size: 10pt; color: #302b63; margin-bottom: 2mm; }
  .persona-card p { font-size: 9pt; }

  /* ── Modules ── */
  .module-header { display: flex; align-items: center; gap: 4mm; margin-bottom: 5mm; }
  .module-icon { font-size: 24pt; }
  .module-header h2 { border: none; margin: 0; }
  .module-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 4mm; }
  .module-block { background: #f8f7fc; border-radius: 4px; padding: 3mm 4mm; }
  .module-block h3 { font-size: 9pt; margin-bottom: 2mm; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9pt; }
  thead th {
    background: #302b63; color: #fff; padding: 2.5mm 3mm;
    text-align: left; font-weight: 600;
  }
  tbody td { padding: 2.5mm 3mm; border-bottom: 1px solid #e8e6f5; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f8f7fc; }
  .stack-category { font-weight: 600; color: #302b63; }

  /* ── Principles ── */
  .principle-block { margin-bottom: 8mm; }

  /* ── Arch choices ── */
  .arch-choice { margin-bottom: 6mm; }
  .arch-choice h3 {
    background: #302b63; color: #fff; display: inline-block;
    padding: 1.5mm 4mm; border-radius: 3px; font-size: 10pt; margin-bottom: 3mm;
  }

  /* ── Footer ── */
  .page-footer {
    position: fixed; bottom: 8mm; left: 16mm; right: 16mm;
    font-size: 7pt; color: #999; text-align: center;
    border-top: 1px solid #eee; padding-top: 2mm;
  }

  /* ── Intro box ── */
  .intro-box {
    background: linear-gradient(135deg, #f5f4f8, #e8e6f5);
    border-radius: 6px; padding: 5mm 6mm; margin: 5mm 0;
    border: 1px solid #d8d4e8;
  }
  .intro-box p { font-size: 10pt; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .stat-box {
    text-align: center; background: #302b63; color: #fff;
    border-radius: 6px; padding: 4mm;
  }
  .stat-box .num { font-size: 18pt; font-weight: 700; }
  .stat-box .label { font-size: 8pt; opacity: 0.8; }

  .roadmap-detail { margin-top: 5mm; }
  .roadmap-item {
    display: flex; gap: 4mm; margin-bottom: 3mm; align-items: flex-start;
  }
  .roadmap-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #302b63;
    margin-top: 2mm; flex-shrink: 0;
  }
  .roadmap-item strong { color: #302b63; }
</style>
</head>
<body>

<!-- ═══════════════ COVER ═══════════════ -->
<div class="cover">
  <div class="cover-logo">🎬</div>
  <div class="handbook">Engineering Handbook</div>
  <h1>Pick — Tome 1</h1>
  <div class="subtitle">Vision, Architecture &amp; Principes</div>
  <div class="cover-meta">
    <strong>Projet</strong> Pick Your Spotlight<br/>
    <strong>Auteur</strong> Chris — Pick Your Spotlight team<br/>
    <strong>Date</strong> Juin 2026<br/>
    <strong>Version</strong> 1.0
  </div>
  <div class="cover-version">Document confidentiel — usage interne et partenaires</div>
</div>

<!-- ═══════════════ TOC ═══════════════ -->
<section class="toc">
  <h2>Table des matières</h2>
  <ul class="toc-list">
    <li><span class="num">1</span> Vision — Pourquoi Pick ? <span>3</span></li>
    <li><span class="num">2</span> Le problème <span>5</span></li>
    <li><span class="num">3</span> Notre réponse <span>8</span></li>
    <li><span class="num">4</span> Les personas <span>11</span></li>
    <li><span class="num">5</span> Les grands modules <span>14</span></li>
    <li><span class="num">5.1</span> Onboarding initiatique <span>14</span></li>
    <li><span class="num">5.2</span> Moteur de recommandation <span>16</span></li>
    <li><span class="num">5.3</span> Match (photo &amp; voix) <span>18</span></li>
    <li><span class="num">5.4</span> Révéler (Soirées) <span>20</span></li>
    <li><span class="num">5.5</span> Watchlist <span>22</span></li>
    <li><span class="num">5.6</span> Bibliothèque (Mon cinéma) <span>24</span></li>
    <li><span class="num">5.7</span> Pick+ <span>26</span></li>
    <li><span class="num">5.8</span> Pick Together &amp; Duo <span>28</span></li>
    <li><span class="num">6</span> Les principes <span>30</span></li>
    <li><span class="num">7</span> Architecture générale <span>35</span></li>
    <li><span class="num">8</span> Stack technique <span>38</span></li>
    <li><span class="num">9</span> Choix d'architecture <span>40</span></li>
    <li><span class="num">10</span> Roadmap 2026 <span>44</span></li>
    <li><span class="num">11</span> Écosystème et intégrations <span>47</span></li>
    <li><span class="num">12</span> Métriques de succès <span>49</span></li>
    <li><span class="num">13</span> Glossaire produit <span>51</span></li>
    <li><span class="num">14</span> Modèle économique <span>53</span></li>
    <li><span class="num">15</span> Équipe et gouvernance <span>55</span></li>
    <li><span class="num">16</span> Design et expérience utilisateur <span>57</span></li>
    <li><span class="num">17</span> Questions fréquentes <span>59</span></li>
  </ul>
  <div class="callout callout-info">
    <strong>ℹ À propos de ce document</strong>
    <p>Ce tome s'adresse aux nouveaux développeurs, investisseurs et partenaires. Il explique <em>ce qu'est Pick et pourquoi cette application existe</em> — sans entrer dans le détail du code. Les tomes suivants couvriront les modules techniques en profondeur.</p>
  </div>
</section>

<!-- ═══════════════ 1. VISION ═══════════════ -->
<section class="page-break">
  <h2>1. Vision — Pourquoi Pick ?</h2>
  <div class="intro-box">
    <p><strong>Pick Your Spotlight</strong> (Pick) est un assistant personnel de choix cinématographique. Sa mission : éliminer la paralysie du choix le vendredi soir et transformer la recherche d'un film en un moment de plaisir — pas en corvée.</p>
  </div>

  <h3>Le constat fondateur</h3>
  <p>Nous vivons l'âge d'abondance du streaming. Plus de 500 000 films et séries sont accessibles en quelques clics, répartis sur une dizaine de plateformes. Pourtant, le temps moyen consacré à « trouver quoi regarder » atteint 45 minutes par soirée. Ce n'est pas un problème de catalogue — c'est un problème de <strong>décision</strong>.</p>

  <p>Les plateformes de streaming optimisent l'engagement, pas la satisfaction. Leurs algorithmes poussent le contenu sponsorisé et les productions maison. Ils ne connaissent ni votre humeur du moment, ni les goûts de votre partenaire, ni les films que vous avez abandonnés à mi-parcours.</p>

  <h3>Notre conviction</h3>
  <p>Pick n'est pas une base de données de films. C'est un <strong>assistant de décision</strong> qui :</p>
  <ul>
    <li><strong>Connaît vos goûts</strong> — profil construit progressivement, pas un formulaire unique</li>
    <li><strong>Comprend le contexte</strong> — humeur, plateformes disponibles, avec qui vous regardez</li>
    <li><strong>Propose, ne noie pas</strong> — trois films, pas trois cents résultats</li>
    <li><strong>Apprend de vos retours</strong> — chaque like, skip ou note affine le profil</li>
  </ul>

  <div class="callout callout-warn">
    <strong>⚠ Ce que Pick n'est PAS</strong>
    <p>Pas un agrégateur de catalogues. Pas un réseau social cinéphile. Pas un remplacement de Netflix ou Prime Video. Pick vous aide à <em>choisir</em> — ensuite, vous regardez sur la plateforme de votre choix.</p>
  </div>

  <h3>Positionnement</h3>
  <p>Pick se situe à l'intersection de trois tendances :</p>
  <ul>
    <li><strong>Personnalisation IA</strong> — les grands modèles de langage rendent possible une compréhension nuancée des goûts</li>
    <li><strong>Social viewing</strong> — le retour des soirées film, mais avec des outils numériques adaptés</li>
    <li><strong>Fatigue décisionnelle</strong> — un marché de plus en plus conscient du coût cognitif du choix</li>
  </ul>

  <h3>Histoire du projet</h3>
  <p>Pick Your Spotlight est né d'une frustration personnelle : chaque vendredi soir, le même scénario — 45 minutes à scroller Netflix sans trouver, finissant par regarder un épisode déjà vu pour la dixième fois. L'idée était simple : et si un assistant connaissait vraiment nos goûts et proposait trois films parfaits en deux minutes ?</p>
  <p>Le prototype initial a été développé sur Lovable, puis migré vers une stack professionnelle (React + Supabase) pour supporter la personnalisation avancée, les tests automatisés et la scalabilité. En juin 2026, Pick compte 8 modules fonctionnels, 131 tests automatisés et se prépare à accueillir ses premiers testeurs beta.</p>

  <h3>Mission et valeurs</h3>
  <p><strong>Mission</strong> : Rendre le choix d'un film aussi agréable que le film lui-même.</p>
  <p><strong>Valeurs</strong> :</p>
  <ul>
    <li><em>Respect du temps</em> — chaque minute passée à chercher est une minute non passée à regarder</li>
    <li><em>Respect des goûts</em> — pas de jugement, pas de mode, chaque profil est unique</li>
    <li><em>Respect de la vie privée</em> — vos goûts cinéma restent les vôtres</li>
    <li><em>Plaisir partagé</em> — le film est meilleur quand le choix est collectif</li>
  </ul>

  <div class="two-col" style="margin-top:6mm">
    <div class="stat-box"><div class="num">500k+</div><div class="label">titres disponibles en streaming</div></div>
    <div class="stat-box"><div class="num">45 min</div><div class="label">temps moyen de recherche / soirée</div></div>
  </div>
</section>

<!-- Vision suite -->
<section>
  <h3>La promesse Pick</h3>
  <p>En moins de deux minutes, Pick ce soir vous propose trois films adaptés à votre humeur, vos plateformes et votre profil. Pas de scroll infini. Pas de page de résultats. Trois flip cards, une décision éclairée, un film du soir.</p>

  <p>Cette promesse s'étend au-delà du solo :</p>
  <ul>
    <li><strong>En couple</strong> — Duo fusionne deux profils pour trouver le compromis parfait</li>
    <li><strong>Entre amis</strong> — les Soirées et Pick Together transforment le choix en jeu collectif</li>
    <li><strong>En famille</strong> — les filtres et profils séparés garantissent un contenu adapté</li>
  </ul>

  <h3>Public cible</h3>
  <p>Pick s'adresse d'abord au public francophone (France, Belgique, Suisse, Canada). L'interface, les genres et les métadonnées TMDB sont en français. L'expérience est pensée mobile-first : le choix du film se fait souvent depuis le canapé, téléphone en main.</p>

  <h3>Stade actuel — Juin 2026</h3>
  <p>Pick est en <strong>phase alpha avancée</strong>. Les modules cœur (onboarding, recommandation, watchlist, bibliothèque) sont fonctionnels. Les modules sociaux (soirées, duo) sont en beta. Pick+ est en coquille UI. L'équipe prépare une beta fermée avec 10 à 30 testeurs pour l'été 2026.</p>

  <div class="callout callout-good">
    <strong>✓ Indicateurs alpha</strong>
    <p>131 tests unitaires passants · 33 scénarios E2E Playwright · Pipeline de recommandation documenté · CI GitHub Actions opérationnelle · 8 étapes d'onboarding initiatique déployées</p>
  </div>
</section>

<!-- ═══════════════ 2. LE PROBLÈME ═══════════════ -->
<section class="page-break">
  <h2>2. Le problème</h2>
  <p>Le paradoxe du choix touche le streaming plus que tout autre domaine du divertissement. Comprendre ce problème — dans ses dimensions psychologiques, techniques et sociales — est essentiel pour saisir la raison d'être de Pick.</p>

  <div class="diagram-wrap">${svgProblemFlow}</div>

  <h3>◆ Abondance du catalogue</h3>
  <p>Netflix, Prime Video, Disney+, Canal+, OCS, Apple TV+, Paramount+ — chaque plateforme ajoute des centaines de titres chaque mois. Le catalogue cumulé dépasse 500 000 films et séries. Aucun être humain ne peut maintenir une vue d'ensemble. Les interfaces de recherche des plateformes sont conçues pour la rétention, pas pour la décision rapide.</p>

  <h3>◆ Fragmentation des plateformes</h3>
  <p>Le film que vous voulez regarder est peut-être sur Netflix. Ou sur Prime. Ou nulle part en streaming — il faut le louer. Avant même de choisir <em>quoi</em> regarder, il faut savoir <em>où</em>. Cette friction ajoute 10 à 15 minutes à chaque recherche.</p>

  <h3>◆ Algorithmes opaques</h3>
  <p>Les recommandations des plateformes servent leurs intérêts commerciaux : productions originales, contenus sponsorisés, nouveautés à promouvoir. Elles ne tiennent pas compte de votre humeur du moment, de vos changements de goût, ni des préférences de la personne à côté de vous.</p>
</section>

<section>
  <h3>◆ Coût cognitif</h3>
  <p>La recherche de contenu active le même circuit décisionnel que les achats importants. Face à trop d'options, le cerveau entre en « paralysie du choix » : augmentation du stress, diminution de la satisfaction, tendance à abandonner. Résultat : « On ne regarde finalement rien » ou repli sur un épisode déjà vu.</p>

  <h3>◆ Dimension sociale</h3>
  <p>Le problème s'amplifie à plusieurs. En couple, les goûts divergent. Entre amis, personne ne veut imposer son choix. En famille, les âges et sensibilités diffèrent. Les outils actuels (envoyer des liens, voter dans un groupe WhatsApp) sont artisanaux et frustrants.</p>

  <div class="callout callout-warn">
    <strong>⚠ Chiffres clés</strong>
    <p>• 45 minutes : temps moyen de recherche par soirée (études sectorielles)<br/>
    • 67 % des utilisateurs abandonnent après 20 minutes sans trouver<br/>
    • 3,2 plateformes en moyenne par foyer français<br/>
    • 78 % des couples citent le choix du film comme source de friction</p>
  </div>

  <h3>◆ Ce que les solutions existantes ne résolvent pas</h3>
  <ul>
    <li><strong>JustWatch / Reelgood</strong> — agrègent la disponibilité mais ne recommandent pas selon vos goûts</li>
    <li><strong>Letterboxd</strong> — excellent pour les cinéphiles, trop complexe pour le grand public</li>
    <li><strong>Algorithmes plateforme</strong> — optimisés pour l'engagement, pas la satisfaction</li>
    <li><strong>ChatGPT / assistants génériques</strong> — pas de profil persistant, pas de données TMDB structurées</li>
  </ul>

  <p>Pick comble cet espace : un assistant personnel, persistent, social, alimenté par des données cinématographiques fiables et une IA de sélection.</p>

  <h3>Analyse concurrentielle détaillée</h3>
  <table>
    <thead><tr><th>Solution</th><th>Force</th><th>Faiblesse</th><th>Position Pick</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Netflix / Prime</td><td>Catalogue, player intégré</td><td>Algo orienté engagement, pas le contexte</td><td>Pick recommande, la plateforme diffuse</td></tr>
      <tr><td class="stack-category">JustWatch</td><td>Disponibilité multi-plateforme</td><td>Pas de personnalisation goût</td><td>Pick intègre la dispo + le profil</td></tr>
      <tr><td class="stack-category">Letterboxd</td><td>Communauté cinéphile</td><td>Trop complexe, pas de reco IA</td><td>Pick = Letterboxd + assistant IA</td></tr>
      <tr><td class="stack-category">ChatGPT</td><td>Conversation naturelle</td><td>Pas de profil persistant, pas de TMDB</td><td>Pick = ChatGPT + données structurées</td></tr>
      <tr><td class="stack-category">Reelgood</td><td>Agrégation US</td><td>Pas adapté marché FR, pas social</td><td>Pick cible FR, soirées, duo</td></tr>
    </tbody>
  </table>
</section>

<!-- ═══════════════ 3. NOTRE RÉPONSE ═══════════════ -->
<section class="page-break">
  <h2>3. Notre réponse</h2>
  <p>Pick transforme le parcours « quoi regarder ce soir ? » en une expérience guidée, personnalisée et — quand le contexte s'y prête — sociale.</p>

  <div class="diagram-wrap">${svgResponseFlow}</div>

  <h3>Le parcours en six étapes</h3>
  <ol style="margin-left:6mm">
    <li><strong>Utilisateur</strong> — ouvre Pick depuis son canapé, un vendredi soir</li>
    <li><strong>Onboarding</strong> — si premier usage, parcours initiatique pour calibrer le profil (films, acteurs, réalisateurs)</li>
    <li><strong>Profil de goût</strong> — vecteurs multi-dimensionnels : goûts stables, tendances récentes, évitements</li>
    <li><strong>Moteur de recommandation</strong> — wizard contextuel + pipeline cascade (SQL → scoring → IA)</li>
    <li><strong>Movie Match</strong> — scoring fin de chaque candidat contre le profil, justification IA</li>
    <li><strong>Film du soir</strong> — trois propositions en flip cards, une décision, un moment</li>
  </ol>

  <h3>Différenciateurs clés</h3>
  <div class="two-col">
    <div>
      <h3>Personnalisation profonde</h3>
      <p>Le profil de goût n'est pas un quiz unique. Il évolue avec chaque interaction : likes, vues, skips, notes, watchlist. Trois vecteurs complémentaires capturent les préférences stables, les envies récentes et les contenus à éviter.</p>
    </div>
    <div>
      <h3>Contexte du moment</h3>
      <p>Humeur (léger, intense, émouvant), type (film ou série), durée souhaitée, plateformes disponibles — le wizard capture l'intention du soir, pas seulement l'historique.</p>
    </div>
  </div>
</section>

<section>
  <h3>Trois films, pas trois cents</h3>
  <p>Le choix délibéré de limiter les résultats à trois propositions est fondamental. La recherche académique sur le paradoxe du choix (Iyengar & Lepper, 2000) démontre que la satisfaction diminue au-delà de 6-7 options. Trois flip cards avec affiche, synopsis, score de match et justification IA : c'est suffisant pour décider, pas assez pour paralyser.</p>

  <h3>Boucle d'apprentissage</h3>
  <p>Chaque soirée enrichit le profil. Un film aimé renforce les vecteurs de genre et de ton. Un skip alimente le vecteur d'évitement. Un ajout watchlist signale un intérêt différé. Le moteur s'améliore avec l'usage — plus vous utilisez Pick, plus il vous connaît.</p>

  <h3>Extension sociale</h3>
  <p>Le parcours solo n'est que la base. Les soirées ajoutent une dimension collective : critères communs, invitation, révélation synchronisée. Duo fusionne deux profils. Pick Together gère les groupes avec présence temps réel. Le même moteur de recommandation s'adapte au contexte — solo, duo ou groupe.</p>

  <div class="callout callout-good">
    <strong>✓ Expérience cible</strong>
    <p>Ouverture de Pick → 2 minutes de wizard → 3 propositions → 1 film → lecture sur la plateforme. Total : moins de 5 minutes entre « qu'est-ce qu'on regarde ? » et le générique de début.</p>
  </div>
</section>

<!-- ═══════════════ 4. PERSONAS ═══════════════ -->
<section class="page-break">
  <h2>4. Les personas</h2>
  <p>Quatre profils types guident les décisions produit et la priorisation des fonctionnalités. Chaque persona représente un segment réel de nos utilisateurs alpha.</p>

  <div class="persona-grid">
    ${personaCards}
  </div>

  <h3>Matrice besoins × fonctionnalités</h3>
  <table>
    <thead>
      <tr><th>Persona</th><th>Fonctionnalité clé</th><th>Critère de succès</th></tr>
    </thead>
    <tbody>
      <tr><td class="stack-category">Cinéphile</td><td>Pick ce soir + ADN cinéma</td><td>Découvre un film qu'il n'aurait pas trouvé seul</td></tr>
      <tr><td class="stack-category">Couple</td><td>Duo + Soirées</td><td>Décision en moins de 5 minutes, les deux satisfaits</td></tr>
      <tr><td class="stack-category">Amis</td><td>Pick Together + Révéler</td><td>Invitation fluide, révélation ludique</td></tr>
      <tr><td class="stack-category">Famille</td><td>Filtres + Profils séparés</td><td>Contenu adapté à tous les âges</td></tr>
    </tbody>
  </table>

  <div class="callout callout-info">
    <strong>ℹ Priorité alpha</strong>
    <p>Le persona « couple » est le plus représenté parmi les testeurs alpha. Le parcours Duo et les soirées sont donc prioritaires pour la beta fermée. Le cinéphile est le early adopter qui valide la qualité des recommandations.</p>
  </div>
</section>

<!-- Personas journey maps -->
<section class="page-break">
  <h3>Parcours type — Le couple (persona prioritaire)</h3>
  <p>Vendredi 20h30. Julie et Max sont sur le canapé. Julie ouvre Pick, active le mode Duo. Le wizard propose des critères communs : « Comédie légère, moins de 2h, Netflix ou Prime ». En 3 minutes, trois films apparaissent. Max swipe les flip cards, Julie valide « The Nice Guys ». Le film démarre à 20h38. Temps total de décision : 8 minutes.</p>

  <div class="diagram-wrap">
    <svg viewBox="0 0 720 100" xmlns="http://www.w3.org/2000/svg" class="diagram-sm">
      ${['20h30\nOuvre Pick','20h32\nMode Duo','20h34\nWizard','20h36\n3 films','20h38\nLecture'].map((s,i) => {
        const x = 20 + i * 135;
        const lines = s.split('\n');
        return `<rect x="${x}" y="15" width="110" height="55" rx="5" fill="#f5f4f8" stroke="#302b63"/>
        <text x="${x+55}" y="38" text-anchor="middle" font-size="8" fill="#302b63" font-weight="600">${lines[0]}</text>
        <text x="${x+55}" y="52" text-anchor="middle" font-size="7" fill="#5c5780">${lines[1]}</text>
        ${i<4?`<line x1="${x+110}" y1="42" x2="${x+125}" y2="42" stroke="#4a4570" stroke-width="1.5"/>`:''}`;
      }).join('')}
    </svg>
  </div>

  <h3>Parcours type — Le cinéphile</h3>
  <p>Antoine, 34 ans, a noté 200 films sur Pick. Son ADN cinéma montre une affinité pour le cinéma d'auteur nordique et les thrillers psychologiques. Un mardi soir, il lance Pick ce soir avec humeur « intense » et genre « Thriller ». Le moteur propose « The Guilty » (Danemark), « Prisoners » et « Zodiac » — trois films qu'il n'avait pas en tête mais qui correspondent parfaitement. Il ajoute « The Guilty » à sa watchlist et le regarde le week-end suivant.</p>

  <h3>Parcours type — Soirée entre amis</h3>
  <p>Lucas crée une soirée « Horreur, ambiance Halloween » et invite 5 amis via lien WhatsApp. Chacun rejoint la soirée depuis son téléphone. Le moteur groupe analyse les profils croisés et propose « Get Out », « A Quiet Place » et « The Conjuring ». Lucas lance la révélation à 21h15 — overlay synchronisé sur tous les écrans. « Get Out » l'emporte. Moment garanti.</p>
</section>

<!-- ═══════════════ 5. MODULES ═══════════════ -->
<section class="page-break">
  <h2>5. Les grands modules</h2>
  <p>Pick est composé de huit modules fonctionnels, chacun répondant à un besoin distinct dans le parcours utilisateur. Cette section présente l'objectif et le fonctionnement de chaque module — sans entrer dans l'implémentation technique (réservée au Tome 2).</p>
  <div class="callout callout-arch">
    <strong>⚙ Architecture modulaire</strong>
    <p>Chaque module est relativement indépendant mais partage le profil de goût et les données TMDB. Le moteur de recommandation est le hub central ; les autres modules l'alimentent (onboarding, interactions) ou l'étendent (soirées, duo).</p>
  </div>
</section>

${modulePages}

<!-- ═══════════════ 6. PRINCIPES ═══════════════ -->
<section class="page-break">
  <h2>6. Les principes</h2>
  <p>Quatre principes directeurs guident chaque décision produit et technique chez Pick. Ils sont non négociables et servent de référence pour arbitrer les compromis.</p>
  ${principleSections}
</section>

<!-- ═══════════════ 7. ARCHITECTURE ═══════════════ -->
<section class="page-break">
  <h2>7. Architecture générale</h2>
  <p>Pick suit une architecture moderne en couches, séparant clairement la présentation, la logique applicative, les services externes et la persistance. Cette séparation permet à une petite équipe de maintenir et faire évoluer le produit rapidement.</p>

  <h3>7.1 — Stack technique en couches</h3>
  <div class="diagram-wrap">${svgArchStack}</div>

  <h3>7.2 — Flux de données</h3>
  <p>Le client React communique exclusivement via le client Supabase (authentification, requêtes base, temps réel) et les edge functions (logique métier lourde). Les edge functions appellent TMDB pour les métadonnées et Gemini pour l'IA. Aucune clé API n'est exposée côté client.</p>

  <ul>
    <li><strong>Client → Supabase Auth</strong> — sessions JWT, refresh automatique</li>
    <li><strong>Client → PostgreSQL</strong> — profils, interactions, watchlist, sessions (via RLS)</li>
    <li><strong>Client → Edge Functions</strong> — recommandation, match, chat, embeddings</li>
    <li><strong>Edge Functions → TMDB</strong> — métadonnées, disponibilité plateformes, images</li>
    <li><strong>Edge Functions → Gemini</strong> — sélection IA, identification, profils</li>
    <li><strong>Edge Functions → ElevenLabs</strong> — synthèse vocale (TTS)</li>
  </ul>
</section>

<section class="page-break">
  <h3>7.3 — Parcours utilisateur (vue architecture)</h3>
  <div class="diagram-wrap">${svgUserFlow}</div>

  <h3>7.4 — Sécurité</h3>
  <p>La sécurité est structurée en trois niveaux :</p>
  <ul>
    <li><strong>Authentification</strong> — Supabase Auth avec sessions persistantes, routes protégées côté client et Row Level Security côté base</li>
    <li><strong>Secrets serveur</strong> — clés TMDB, Google AI et ElevenLabs stockées comme secrets Supabase, jamais dans le bundle client</li>
    <li><strong>RLS PostgreSQL</strong> — chaque table sensible a des policies garantissant qu'un utilisateur ne voit que ses propres données</li>
  </ul>

  <div class="callout callout-warn">
    <strong>⚠ Avant beta testeurs</strong>
    <p>La rotation de la clé TMDB vers un secret serveur (Supabase Secrets) est planifiée avant l'ouverture aux testeurs externes. En alpha interne, le risque est maîtrisé.</p>
  </div>

  <h3>7.5 — Edge Functions (logique serveur)</h3>
  <p>Les edge functions Deno constituent le cerveau côté serveur de Pick. Chaque fonction a une responsabilité unique :</p>
  <table>
    <thead><tr><th>Fonction</th><th>Rôle</th><th>IA utilisée</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">surprise-personalized</td><td>Pipeline complet de recommandation (candidats → scoring → sélection)</td><td>Gemini 2.5-flash</td></tr>
      <tr><td class="stack-category">movie-match</td><td>Scoring fin d'un film contre le profil utilisateur</td><td>Gemini 2.5-flash</td></tr>
      <tr><td class="stack-category">identify-film</td><td>Identification visuelle ou textuelle d'un film</td><td>Gemini 2.5-flash</td></tr>
      <tr><td class="stack-category">companion-chat</td><td>Chat conversationnel compagnon cinéma</td><td>Gemini 2.5-flash</td></tr>
      <tr><td class="stack-category">generate-embedding</td><td>Création d'embeddings 32D pour les films</td><td>—</td></tr>
      <tr><td class="stack-category">group-recommend</td><td>Recommandation collaborative (soirées, duo)</td><td>Gemini</td></tr>
      <tr><td class="stack-category">tmdb-proxy</td><td>Proxy sécurisé vers l'API TMDB</td><td>—</td></tr>
      <tr><td class="stack-category">pick-tts</td><td>Synthèse vocale ElevenLabs</td><td>ElevenLabs</td></tr>
    </tbody>
  </table>

  <h3>7.6 — Temps réel et sessions</h3>
  <p>Supabase Realtime alimente les fonctionnalités collaboratives. Les sessions Pick Together et la présence Duo utilisent des canaux temps réel pour synchroniser l'état entre participants : qui est connecté, quels votes ont été émis, quand la révélation est déclenchée. Cette architecture évite le polling et garantit une expérience fluide même avec 6-8 participants.</p>
</section>

<!-- ═══════════════ 8. STACK ═══════════════ -->
<section class="page-break">
  <h2>8. Stack technique</h2>
  <p>Vue d'ensemble des technologies utilisées pour construire Pick, avec le rôle de chacune dans l'architecture globale.</p>

  <table>
    <thead>
      <tr><th>Catégorie</th><th>Technologie</th><th>Rôle</th><th>Version</th></tr>
    </thead>
    <tbody>
      <tr><td class="stack-category">Frontend</td><td>React</td><td>Framework UI, composants, état</td><td>18.3</td></tr>
      <tr><td class="stack-category">Frontend</td><td>TypeScript</td><td>Typage statique, sécurité du code</td><td>5.8</td></tr>
      <tr><td class="stack-category">Frontend</td><td>Vite</td><td>Bundler, dev server, HMR</td><td>5.4</td></tr>
      <tr><td class="stack-category">Frontend</td><td>Tailwind CSS</td><td>Styles utilitaires, responsive</td><td>3.4</td></tr>
      <tr><td class="stack-category">Frontend</td><td>shadcn/ui</td><td>Composants UI accessibles (Radix)</td><td>—</td></tr>
      <tr><td class="stack-category">Frontend</td><td>Framer Motion</td><td>Animations, transitions, flip cards</td><td>12.x</td></tr>
      <tr><td class="stack-category">Frontend</td><td>React Query</td><td>Cache serveur, synchronisation données</td><td>5.x</td></tr>
      <tr><td class="stack-category">Frontend</td><td>React Router</td><td>Navigation SPA, routes protégées</td><td>6.30</td></tr>
      <tr><td class="stack-category">Frontend</td><td>Three.js (R3F)</td><td>Visuels 3D (accueil, ambiance)</td><td>8.x / 9.x</td></tr>
      <tr><td class="stack-category">Backend</td><td>Supabase</td><td>BaaS : Auth, DB, Storage, Realtime</td><td>2.99</td></tr>
      <tr><td class="stack-category">Backend</td><td>PostgreSQL</td><td>Base relationnelle, vecteurs goût</td><td>15+</td></tr>
      <tr><td class="stack-category">Backend</td><td>Edge Functions</td><td>Logique serveur Deno déployée</td><td>Deno</td></tr>
      <tr><td class="stack-category">IA</td><td>Google Gemini</td><td>Sélection films, match, chat, profils</td><td>2.5-flash</td></tr>
      <tr><td class="stack-category">IA</td><td>ElevenLabs</td><td>Synthèse vocale (TTS compagnon)</td><td>0.14</td></tr>
      <tr><td class="stack-category">Données</td><td>TMDB API</td><td>Métadonnées films/séries, plateformes FR</td><td>v3</td></tr>
      <tr><td class="stack-category">Tests</td><td>Vitest</td><td>Tests unitaires et intégration</td><td>3.2</td></tr>
      <tr><td class="stack-category">Tests</td><td>Playwright</td><td>Tests E2E (33 scénarios)</td><td>1.57</td></tr>
      <tr><td class="stack-category">Tests</td><td>Testing Library</td><td>Tests composants React</td><td>16.x</td></tr>
      <tr><td class="stack-category">CI/CD</td><td>GitHub Actions</td><td>Lint, tsc, unit, E2E sur PR/main</td><td>—</td></tr>
      <tr><td class="stack-category">Validation</td><td>Zod</td><td>Schémas de validation runtime</td><td>3.25</td></tr>
    </tbody>
  </table>
</section>

<!-- ═══════════════ 9. CHOIX ARCHITECTURE ═══════════════ -->
<section class="page-break">
  <h2>9. Choix d'architecture</h2>
  <p>Chaque technologie a été choisie délibérément. Cette section documente le <em>pourquoi</em> derrière chaque choix — information précieuse pour les nouveaux arrivants et les partenaires techniques.</p>
  ${archChoiceSections}
</section>

<!-- ═══════════════ 10. ROADMAP ═══════════════ -->
<section class="page-break">
  <h2>10. Roadmap 2026</h2>
  <p>La feuille de route produit et technique pour l'année 2026, de l'alpha actuelle à l'assistant cinéma conversationnel.</p>

  <div class="diagram-wrap">${svgRoadmap}</div>

  <div class="roadmap-detail">
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>Alpha (Juin 2026)</strong> — État actuel. Modules cœur fonctionnels, tests automatisés, documentation pipeline. Clôture : smoke tests, README, déploiement edge functions aligné.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>Beta fermée (Été 2026)</strong> — 10-30 testeurs sélectionnés. Stabilisation soirées bout-en-bout, onboarding complet, secret TMDB serveur, E2E onboarding films/acteurs/réalisateurs.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>Beta publique (Automne 2026)</strong> — Ouverture élargie. CGU et politique de confidentialité, monitoring erreurs (Sentry), attribution TMDB, accessibilité mobile.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>V1 (Q4 2026)</strong> — Version publique stable. Performance reco optimisée, refactoring HomeScreen, couverture tests 70 %, documentation complète.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>Pick+ (Q4 2026)</strong> — Monétisation via Stripe ou gratuit prolongé explicite. Fonctionnalités premium : reco illimitées, filtres avancés, priorité nouveautés.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>Duo (Fin 2026)</strong> — Mode duo stabilisé, profils liés, recommandations croisées. Notifications ami et duo.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>Groupe — Pick Together (2027)</strong> — Sessions collaboratives multi-utilisateurs, votes, convergence. Au-delà du duo de 2 personnes.</div></div>
    <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong>IA conversationnelle (2027)</strong> — Chat compagnon cinéma, assistant vocal, anecdotes. Gemini + ElevenLabs TTS. « Dis-moi un film comme Inception mais en plus léger ».</div></div>
  </div>

  <div class="callout callout-good" style="margin-top:8mm">
    <strong>✓ Prochaine étape immédiate</strong>
    <p>Clôturer le Sprint A (alpha) : smoke tests complets, README projet, alignement edge functions prod. Puis enchaîner Sprint B (beta fermée) avec secret TMDB et stabilisation soirées.</p>
  </div>
</section>

<!-- ═══════════════ 11. ÉCOSYSTÈME ═══════════════ -->
<section class="page-break">
  <h2>11. Écosystème et intégrations</h2>
  <p>Pick ne fonctionne pas en vase clos. Il s'appuie sur un écosystème de services et de données externes, chacun jouant un rôle précis dans l'expérience utilisateur.</p>

  <h3>TMDB — The Movie Database</h3>
  <p>Source unique de vérité pour toutes les métadonnées cinématographiques : titres, synopsis, affiches, genres, casting, équipe, notes, dates de sortie et — crucial pour Pick — disponibilité sur les plateformes de streaming en France. Toutes les requêtes sont localisées en français (fr-FR) avec la région France (watch_region=FR).</p>

  <h3>Google Gemini — Intelligence artificielle</h3>
  <p>Moteur IA principal pour la sélection contextuelle de films, l'identification visuelle (Match), la génération de profils cinématographiques et le chat compagnon. Architecture en cascade : gemini-2.5-flash en premier choix, bascule automatique vers gemini-2.0-flash en cas de surcharge. Cette résilience garantit que l'utilisateur reçoit toujours des résultats, même en pic de charge.</p>

  <h3>ElevenLabs — Synthèse vocale</h3>
  <p>Technologie TTS (Text-to-Speech) pour le compagnon vocal de Pick. Permet à l'assistant de « parler » à l'utilisateur — narration de synopsis, anecdotes cinéma, interaction mains libres. Intégration via l'edge function pick-tts.</p>

  <h3>Supabase — Infrastructure backend</h3>
  <p>Plateforme tout-en-un : authentification (email, OAuth), base PostgreSQL avec Row Level Security, stockage fichiers, temps réel (présence Duo/Together), et hébergement des edge functions Deno. Choix stratégique pour une équipe réduite : zéro serveur à gérer, scalabilité automatique.</p>

  <table>
    <thead><tr><th>Service</th><th>Type</th><th>Données échangées</th><th>Criticité</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">TMDB</td><td>API REST</td><td>Métadonnées films, affiches, plateformes</td><td>Critique</td></tr>
      <tr><td class="stack-category">Google Gemini</td><td>API IA</td><td>Prompts contextuels, images (Match)</td><td>Critique</td></tr>
      <tr><td class="stack-category">Supabase</td><td>BaaS</td><td>Profils, interactions, sessions</td><td>Critique</td></tr>
      <tr><td class="stack-category">ElevenLabs</td><td>API TTS</td><td>Texte → audio</td><td>Optionnel</td></tr>
      <tr><td class="stack-category">GitHub</td><td>CI/CD</td><td>Code source, déploiement</td><td>Important</td></tr>
    </tbody>
  </table>
</section>

<!-- ═══════════════ 12. MÉTRIQUES ═══════════════ -->
<section class="page-break">
  <h2>12. Métriques de succès</h2>
  <p>Les indicateurs clés de performance (KPI) permettent de mesurer si Pick remplit sa mission. Ces métriques guident les décisions produit et les priorités de développement.</p>

  <h3>Métriques produit</h3>
  <table>
    <thead><tr><th>KPI</th><th>Description</th><th>Cible beta</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Time-to-pick</td><td>Temps entre ouverture et film choisi</td><td>&lt; 5 minutes</td></tr>
      <tr><td class="stack-category">Taux de satisfaction</td><td>Film aimé après recommandation</td><td>&gt; 70 %</td></tr>
      <tr><td class="stack-category">Taux de complétion onboarding</td><td>Parcours initiatique terminé</td><td>&gt; 80 %</td></tr>
      <tr><td class="stack-category">Rétention J7</td><td>Retour dans les 7 jours</td><td>&gt; 40 %</td></tr>
      <tr><td class="stack-category">Reco → visionnage</td><td>Film recommandé effectivement regardé</td><td>&gt; 50 %</td></tr>
      <tr><td class="stack-category">NPS soirées</td><td>Satisfaction événements groupe</td><td>&gt; 8/10</td></tr>
    </tbody>
  </table>

  <h3>Métriques techniques</h3>
  <table>
    <thead><tr><th>KPI</th><th>Description</th><th>Cible</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Latence reco</td><td>Temps pipeline complet (wizard → résultats)</td><td>&lt; 15 secondes</td></tr>
      <tr><td class="stack-category">Disponibilité</td><td>Uptime edge functions</td><td>&gt; 99,5 %</td></tr>
      <tr><td class="stack-category">Taux d'erreur</td><td>Échecs pipeline / total requêtes</td><td>&lt; 2 %</td></tr>
      <tr><td class="stack-category">Couverture tests</td><td>Tests unitaires logique métier</td><td>&gt; 70 %</td></tr>
      <tr><td class="stack-category">Tests E2E</td><td>Scénarios Playwright passants</td><td>33/33</td></tr>
      <tr><td class="stack-category">Build time</td><td>Compilation production Vite</td><td>&lt; 30 secondes</td></tr>
    </tbody>
  </table>

  <div class="callout callout-info">
    <strong>ℹ Métriques engineMeta</strong>
    <p>Le pipeline de recommandation expose des métriques détaillées (engineMeta) : nombre de candidats SQL, temps par étape, modèle Gemini utilisé, déclenchement du filet de sécurité. Ces données alimentent l'optimisation continue du moteur.</p>
  </div>
</section>

<!-- ═══════════════ 13. GLOSSAIRE ═══════════════ -->
<section class="page-break">
  <h2>13. Glossaire produit</h2>
  <p>Termes et concepts utilisés dans l'écosystème Pick, pour faciliter l'onboarding des nouveaux membres de l'équipe et des partenaires.</p>

  <table>
    <thead><tr><th>Terme</th><th>Définition</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Pick ce soir</td><td>Parcours principal de recommandation : wizard contextuel → 3 films proposés</td></tr>
      <tr><td class="stack-category">Onboarding initiatique</td><td>Parcours de calibration du profil en 8 étapes (films, acteurs, réalisateurs)</td></tr>
      <tr><td class="stack-category">Profil de goût</td><td>Représentation vectorielle des préférences : stable, récent, évitements</td></tr>
      <tr><td class="stack-category">Vecteur stable</td><td>Goûts long terme, décroissance exponentielle 150 jours</td></tr>
      <tr><td class="stack-category">Vecteur récent</td><td>Tendances des 30 derniers jours, décroissance 21 jours</td></tr>
      <tr><td class="stack-category">Vecteur évitement</td><td>Contenus à éviter (skips, dislikes), décroissance 60 jours</td></tr>
      <tr><td class="stack-category">Flip card</td><td>Carte interactive affichant un film (recto : affiche, verso : détails)</td></tr>
      <tr><td class="stack-category">Film du soir</td><td>Le film finalement choisi et retenu pour la soirée</td></tr>
      <tr><td class="stack-category">Movie Match</td><td>Scoring fin d'un candidat contre le profil + justification IA</td></tr>
      <tr><td class="stack-category">Surprise personnalisée</td><td>Edge function principale du pipeline de recommandation</td></tr>
      <tr><td class="stack-category">Révéler</td><td>Action de dévoiler le film choisi lors d'une soirée groupe</td></tr>
      <tr><td class="stack-category">Soirée</td><td>Événement film partagé avec critères, invitations et révélation</td></tr>
      <tr><td class="stack-category">Duo</td><td>Mode deux profils liés pour recommandations croisées</td></tr>
      <tr><td class="stack-category">Pick Together</td><td>Session collaborative multi-utilisateurs avec présence temps réel</td></tr>
      <tr><td class="stack-category">ADN cinéma</td><td>Visualisation du profil de goût (genres, réalisateurs, tendances)</td></tr>
      <tr><td class="stack-category">Mon cinéma</td><td>Bibliothèque personnelle : historique, stats, films vus</td></tr>
      <tr><td class="stack-category">Pick+</td><td>Offre premium (monétisation future, gratuite en alpha)</td></tr>
      <tr><td class="stack-category">Embedding</td><td>Vecteur numérique 32 dimensions représentant un film</td></tr>
      <tr><td class="stack-category">Filet de sécurité</td><td>Mécanisme garantissant 3 résultats même si le pipeline échoue partiellement</td></tr>
      <tr><td class="stack-category">TNR</td><td>Tests de Non-Régression — suite automatisée protégeant le pipeline</td></tr>
    </tbody>
  </table>
</section>

<!-- ═══════════════ 14. MODÈLE ÉCONOMIQUE ═══════════════ -->
<section class="page-break">
  <h2>14. Modèle économique</h2>
  <p>Pick adopte un modèle freemium : une expérience gratuite généreuse pour acquérir les utilisateurs, et une offre premium (Pick+) pour les fonctionnalités avancées.</p>

  <h3>Phase alpha (actuelle)</h3>
  <p>Toutes les fonctionnalités sont accessibles gratuitement. Le paywall Pick+ affiche « Bientôt » sans bloquer l'expérience. L'objectif est de valider le produit et collecter les retours, pas de monétiser.</p>

  <h3>Phase beta — Pick+ freemium</h3>
  <div class="two-col">
    <div>
      <h3>Gratuit</h3>
      <ul>
        <li>3 recommandations Pick ce soir par jour</li>
        <li>Onboarding complet</li>
        <li>Watchlist (limite 50 titres)</li>
        <li>Bibliothèque et ADN cinéma</li>
        <li>1 soirée active</li>
      </ul>
    </div>
    <div>
      <h3>Pick+ (premium)</h3>
      <ul>
        <li>Recommandations illimitées</li>
        <li>Filtres avancés (durée, décennie, langue)</li>
        <li>Watchlist illimitée</li>
        <li>Soirées illimitées</li>
        <li>Mode Duo prioritaire</li>
        <li>Assistant IA conversationnel</li>
      </ul>
    </div>
  </div>

  <h3>Monétisation technique</h3>
  <p>L'intégration Stripe est planifiée pour la beta publique (Q4 2026). Le hook use-pick-plus gère déjà le gating côté client. En alpha, isPremium est temporairement à true pour tous les utilisateurs.</p>

  <div class="callout callout-arch">
    <strong>⚙ Décision stratégique</strong>
    <p>Le prix Pick+ sera positionné entre 3 et 5 €/mois — en dessous d'un abonnement streaming, au-dessus d'une app utilitaire. La valeur perçue repose sur le temps économisé (45 min → 5 min) et la qualité des découvertes.</p>
  </div>
</section>

<!-- ═══════════════ 15. ÉQUIPE ═══════════════ -->
<section class="page-break">
  <h2>15. Équipe et gouvernance</h2>
  <p>Pick Your Spotlight est développé par une équipe réduite et agile, avec une gouvernance produit claire et des processus de qualité rigoureux.</p>

  <h3>Organisation</h3>
  <p>L'équipe combine développement full-stack (React + Supabase), design produit et expertise cinématographique. Les décisions produit sont prises en sprint hebdomadaire, avec un backlog centralisé et priorisé (P0 → P3).</p>

  <h3>Processus de développement</h3>
  <ul>
    <li><strong>Sprints</strong> — cycles d'une semaine avec objectif clair (Sprint A : alpha, Sprint B : beta fermée)</li>
    <li><strong>Backlog unique</strong> — fichier BACKLOG.md, référence pour toute l'équipe</li>
    <li><strong>Revue de code</strong> — chaque PR passe par lint + TypeScript + tests unitaires (CI GitHub Actions)</li>
    <li><strong>TNR</strong> — 131 tests unitaires + 33 scénarios E2E protègent les régressions</li>
    <li><strong>Documentation</strong> — Engineering Handbook (ce document), pipeline reco, smoke tests</li>
  </ul>

  <h3>Outils de collaboration</h3>
  <table>
    <thead><tr><th>Outil</th><th>Usage</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">GitHub</td><td>Code source, PR, CI/CD, issues</td></tr>
      <tr><td class="stack-category">Supabase Dashboard</td><td>Base de données, edge functions, auth</td></tr>
      <tr><td class="stack-category">Cursor / Claude Code</td><td>Développement assisté par IA</td></tr>
      <tr><td class="stack-category">Lovable</td><td>Prototypage rapide initial</td></tr>
    </tbody>
  </table>

  <div class="callout callout-good">
    <strong>✓ Culture d'équipe</strong>
    <p>Simplicité > complexité. Tests avant refactor. Documentation vivante. Pas de code mort. Chaque fonctionnalité doit répondre à un persona identifié. L'utilisateur ne voit jamais la complexité technique.</p>
  </div>
</section>

<!-- ═══════════════ 16. DESIGN UX ═══════════════ -->
<section class="page-break">
  <h2>16. Design et expérience utilisateur</h2>
  <p>L'interface de Pick est conçue mobile-first, avec une esthétique cinématographique sombre et immersive. Chaque écran est pensé pour réduire la friction cognitive et guider l'utilisateur vers la décision.</p>

  <h3>Principes de design</h3>
  <ul>
    <li><strong>Dark mode natif</strong> — fond sombre, accents lumineux, ambiance « salle de cinéma »</li>
    <li><strong>Mobile-first</strong> — le choix du film se fait depuis le canapé, téléphone en main</li>
    <li><strong>Animations fluides</strong> — Framer Motion pour les transitions, flip cards, révélations</li>
    <li><strong>Affichage visuel</strong> — les affiches TMDB sont au centre de l'expérience, pas du texte</li>
    <li><strong>Accessibilité</strong> — safe areas mobile, contrastes suffisants, aria-labels (en cours)</li>
  </ul>

  <h3>Composants clés de l'interface</h3>
  <table>
    <thead><tr><th>Composant</th><th>Rôle UX</th><th>Module</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Flip card</td><td>Présentation film (affiche ↔ détails)</td><td>Pick ce soir, Résultats</td></tr>
      <tr><td class="stack-category">Wizard steps</td><td>Collecte progressive du contexte</td><td>Pick ce soir, Soirées</td></tr>
      <tr><td class="stack-category">Mur d'affiches</td><td>Onboarding visuel (swipe films)</td><td>Onboarding initiatique</td></tr>
      <tr><td class="stack-category">Overlay révélation</td><td>Moment de surprise synchronisé</td><td>Soirées</td></tr>
      <tr><td class="stack-category">Bottom tab bar</td><td>Navigation principale (5 onglets)</td><td>Global</td></tr>
      <tr><td class="stack-category">Tonight overlay</td><td>Film du soir persistant sur l'accueil</td><td>Accueil</td></tr>
    </tbody>
  </table>

  <h3>Palette et identité visuelle</h3>
  <p>La palette principale s'articule autour du violet profond (#302b63) et de ses déclinaisons, évoquant le rideau de cinéma et la magie du 7e art. Les accents dorés ponctuent les moments de révélation et de succès. La typographie utilise des polices système (Segoe UI, SF Pro) pour la lisibilité, avec des tailles généreuses adaptées au mobile.</p>

  <div class="callout callout-good">
    <strong>✓ Règle d'or UX</strong>
    <p>Chaque écran doit répondre à une seule question. Si l'utilisateur hésite plus de 5 secondes, le design a échoué. Le wizard Pick ce soir est l'incarnation de ce principe : une question par écran, des choix visuels, pas de texte libre.</p>
  </div>
</section>

<!-- ═══════════════ 17. FAQ ═══════════════ -->
<section class="page-break">
  <h2>17. Questions fréquentes</h2>
  <p>Réponses aux questions que se posent les nouveaux arrivants, investisseurs et partenaires.</p>

  <h3>Produit</h3>
  <p><strong>Pick remplace-t-il Netflix ?</strong><br/>Non. Pick aide à choisir un film ; la lecture se fait sur la plateforme de streaming de votre choix. Pick est un assistant de décision, pas un lecteur vidéo.</p>

  <p><strong>Comment Pick connaît-il mes goûts ?</strong><br/>Via l'onboarding initiatique (films, acteurs, réalisateurs) et chaque interaction ultérieure (likes, skips, notes, watchlist). Trois vecteurs complémentaires capturent vos préférences stables, récentes et vos évitements.</p>

  <p><strong>Pourquoi seulement 3 films ?</strong><br/>La recherche sur le paradoxe du choix démontre que la satisfaction diminue au-delà de 6-7 options. Trois propositions ciblées avec justification IA permettent de décider rapidement sans paralysie.</p>

  <p><strong>Pick fonctionne-t-il hors de France ?</strong><br/>En alpha, Pick cible le marché francophone avec des métadonnées TMDB en fr-FR et la disponibilité plateformes France. L'internationalisation est planifiée post-V1.</p>

  <h3>Technique</h3>
  <p><strong>Pourquoi Supabase et pas un backend custom ?</strong><br/>Pour une équipe réduite, Supabase offre Auth + PostgreSQL + Realtime + Edge Functions sans infrastructure à gérer. Le temps économisé est réinvesti dans le produit.</p>

  <p><strong>Pourquoi Gemini et pas OpenAI ?</strong><br/>Rapport qualité/coût/latence supérieur pour la sélection de films. L'API Google AI offre une interface OpenAI-compatible et des modèles rapides (flash) adaptés à notre cas d'usage temps réel.</p>

  <p><strong>Comment garantir la qualité des recommandations ?</strong><br/>131 tests automatisés, pipeline en cascade avec filet de sécurité, métriques engineMeta, et boucle de feedback utilisateur (like/skip) qui affine continuellement le profil.</p>

  <h3>Business</h3>
  <p><strong>Quel est le modèle de revenus ?</strong><br/>Freemium via Pick+ (3-5 €/mois estimé). Gratuit généreux en alpha et beta fermée. Monétisation Stripe planifiée Q4 2026.</p>

  <p><strong>Quelle est la taille du marché ?</strong><br/>45+ millions de foyers streaming en France. Si 1 % adopte Pick à 4 €/mois, c'est 1,8 M€ ARR. Le marché francophone élargi (Belgique, Suisse, Canada) multiplie ce potentiel.</p>
</section>

<!-- ═══════════════ FIN ═══════════════ -->
<section class="page-break" style="text-align:center;padding-top:60mm">
  <div style="font-size:36pt;margin-bottom:10mm">🎬</div>
  <h2 style="border:none">Fin du Tome 1</h2>
  <p style="text-align:center;max-width:120mm;margin:5mm auto">Vision, Architecture &amp; Principes</p>
  <p style="text-align:center;font-size:9pt;color:#5c5780;margin-top:15mm">
    Pick Your Spotlight — Engineering Handbook<br/>
    Version 1.0 — Juin 2026<br/><br/>
    Tome 2 (à venir) : Modules techniques en profondeur<br/>
    Tome 3 (à venir) : Pipeline de recommandation &amp; IA
  </p>
</section>

</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

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
        Pick — Engineering Handbook · Tome 1 · v1.0 · Juin 2026 — <span class="pageNumber"></span> / <span class="totalPages"></span>
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
