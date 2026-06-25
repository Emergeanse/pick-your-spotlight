import { svgJourney, svgPipeline, svgCascade } from './handbook-tome2-diagrams.mjs';

export const CHAPTERS_1_5 = `
<section class="page-break">
  <h2>1. Introduction</h2>
  <div class="intro-box">
    <p>Le <strong>moteur de recommandation</strong> est le cœur technique de Pick. Il transforme un profil de goût cinématographique, enrichi par le contexte du moment, en trois propositions de films — rarement plus — que l'utilisateur peut choisir en quelques secondes. Ce tome documente son fonctionnement produit et technique, en complément du <strong>Tome 1 — Vision &amp; Architecture</strong>.</p>
  </div>

  <h3>1.1 — Rôle dans l'écosystème Pick</h3>
  <p>Dans le Tome 1, le moteur de recommandation apparaît comme l'un des huit modules fonctionnels de Pick. En réalité, il est le <em>hub central</em> : l'onboarding l'alimente en signaux, la watchlist et la bibliothèque le nourrissent en retours, les soirées et le mode Duo modifient ses entrées, et les flip cards en sont la vitrine.</p>
  <p>Sa mission est double : <strong>filtrer</strong> des centaines de milliers de titres pour ne garder qu'un pool pertinent, puis <strong>sélectionner</strong> les meilleurs candidats avec une couche d'intelligence artificielle qui justifie chaque proposition en langage naturel.</p>

  <h3>1.2 — Promesse produit</h3>
  <p>Pick ne propose pas un catalogue. Pick propose une <strong>décision</strong>. Le moteur garantit :</p>
  <ul>
    <li>Trois films adaptés au profil, à l'humeur et aux plateformes disponibles</li>
    <li>Aucun film déjà vu, disliké ou exclu par l'utilisateur</li>
    <li>Des justifications personnalisées (« Pourquoi ce film ce soir ? »)</li>
    <li>Un résultat même en cas de profil incomplet ou de contraintes extrêmes (filet de sécurité)</li>
  </ul>

  <div class="callout callout-arch">
    <strong>⚙ Décision d'architecture</strong>
    <p>Le pipeline est scindé en deux edge functions : une pour la sélection batch (surprise-personalized) et une pour le scoring fin par film (movie-match). Cette séparation permet un affichage immédiat des propositions LLM pendant que les textes riches se chargent en arrière-plan.</p>
  </div>

  <h3>1.3 — Prérequis d'activation</h3>
  <p>Le pipeline personnalisé complet ne s'active que si l'utilisateur possède au minimum <strong>deux films likés</strong> et un <strong>vecteur de goût 32 dimensions</strong> calculé. En dessous de ce seuil, un fallback TMDB léger propose un titre générique — suffisant pour l'expérience alpha, insuffisant pour la promesse Pick.</p>

  <div class="two-col" style="margin-top:5mm">
    <div class="stat-box"><div class="num">3</div><div class="label">films affichés typiquement</div></div>
    <div class="stat-box"><div class="num">&lt; 15 s</div><div class="label">latence pipeline cible</div></div>
  </div>
</section>

<section>
  <h3>1.4 — Lien avec le Tome 1</h3>
  <p>Le Tome 1 posait la vision (« trois films, pas trois cents »), les personas (couple, cinéphile, amis) et l'architecture en couches (React → Supabase → Gemini → TMDB). Ce Tome 2 descend dans le détail du module reco : comment le wizard ou l'écran d'accueil déclenche le pipeline, quelles données entrent, quels filtres s'appliquent, et comment interpréter les métriques de debug.</p>

  <h3>1.5 — Public et périmètre</h3>
  <p>Ce document s'adresse aux développeurs rejoignant l'équipe, aux ingénieurs QA responsables des TNR, et aux partenaires techniques évaluant la robustesse du moteur. Il décrit le comportement produit et les mécanismes internes — sans extraits de code ni références aux fichiers sources.</p>

  <div class="callout callout-good">
    <strong>✓ Bonnes pratiques</strong>
    <p>Avant de modifier le pipeline, lire ce tome et la documentation pipeline associée. Toute modification des filtres, seuils ou fallbacks doit être accompagnée d'un test de non-régression. Ne jamais supposer que deux scores affichés sont comparables sans vérifier leur échelle (voir chapitre 8).</p>
  </div>
</section>

<section class="page-break">
  <h2>2. Parcours « Pick ce soir »</h2>
  <p>Deux points d'entrée principaux alimentent le même moteur : l'<strong>écran d'accueil</strong> (tap « Ce soir ») et le <strong>wizard guidé</strong> (parcours /app). Ce chapitre décrit le parcours le plus fréquent — depuis l'accueil.</p>

  <div class="diagram-wrap">${svgJourney}</div>

  <h3>2.1 — Déclenchement</h3>
  <p>L'utilisateur ouvre Pick depuis son canapé et tape le bouton « Ce soir » sur l'écran d'accueil. Si un profil est prêt (≥ 2 likes, vecteur calculé), le client lance immédiatement la génération. Sinon, un message invite à compléter l'onboarding ou un fallback léger s'affiche.</p>

  <h3>2.2 — Overlay de chargement</h3>
  <p>Pendant le pipeline, un overlay semi-transparent masque l'accueil avec une animation de chargement. L'utilisateur voit que Pick « réfléchit » — pas un écran blanc. Dès que les trois propositions LLM arrivent (typiquement 5 à 12 secondes), les flip cards apparaissent sans attendre la fin du movie-match.</p>

  <h3>2.3 — Flip cards et choix</h3>
  <p>Chaque flip card présente : affiche TMDB, titre, score de match (%), raison LLM (« Ce thriller psychologique correspond à votre amour récent pour… »). Un swipe horizontal permet de parcourir les trois propositions. Tap sur une card → détail enrichi (synopsis, plateformes, textes movie-match si disponibles).</p>

  <h3>2.4 — Film du soir</h3>
  <p>L'utilisateur retient un film comme « film du soir ». Il persiste sur l'accueil via l'overlay TonightPick jusqu'au visionnage ou au lendemain. Ce choix alimente le profil (signal positif différé).</p>

  <div class="callout callout-info">
    <strong>ℹ Note produit</strong>
    <p>Le wizard /app collecte explicitement type (film/série), humeur, genres et plateformes avant d'invoquer le même pipeline. L'accueil utilise les préférences mémorisées et les overrides voix/ambiance si actifs. Les deux parcours convergent vers la même edge function.</p>
  </div>
</section>

<section>
  <h3>2.5 — Timeline type (accueil)</h3>
  <table>
    <thead><tr><th>Instant</th><th>Action</th><th>Perception utilisateur</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">T+0 s</td><td>Tap « Ce soir »</td><td>Overlay chargement</td></tr>
      <tr><td class="stack-category">T+1 s</td><td>Calcul profil + exclusions client</td><td>Animation continue</td></tr>
      <tr><td class="stack-category">T+3–8 s</td><td>SQL cascade + LLM Gemini</td><td>Toujours en chargement</td></tr>
      <tr><td class="stack-category">T+8–12 s</td><td>Batch prêt → flip cards</td><td>3 films visibles, raisons LLM</td></tr>
      <tr><td class="stack-category">T+12–25 s</td><td>movie-match séquentiel (×3)</td><td>Textes riches apparaissent progressivement</td></tr>
      <tr><td class="stack-category">T+30 s</td><td>Choix utilisateur</td><td>Film du soir enregistré</td></tr>
    </tbody>
  </table>

  <div class="callout callout-good">
    <strong>✓ Cas d'usage</strong>
    <p>Thomas, 22h un vendredi, tape « Ce soir » sans repasser par le wizard. Pick se souvient de ses plateformes (Netflix, Prime), de son humeur récente (détente) et de ses 47 likes. En 9 secondes, trois comédies françaises récentes apparaissent. Il retourne la deuxième flip card, lit la justification movie-match qui arrive 4 secondes plus tard, et valide « Le Sens de la fête ».</p>
  </div>
</section>

<section class="page-break">
  <h2>3. Vue d'ensemble du pipeline</h2>
  <p>Le pipeline de recommandation est un flux orchestré entre le client React, deux edge functions Supabase et les APIs externes TMDB et Gemini. Il se décompose en trois acteurs distincts.</p>

  <div class="diagram-wrap">${svgPipeline}</div>

  <h3>3.1 — Couche client</h3>
  <p>Le client prépare la requête : calcul du profil multi-vecteurs (stable, récent, évitement), agrégation des exclusions (historique, session, duo), résolution des overrides (voix, ambiance, duo). Il invoque surprise-personalized avec le flag debug activé en production sur l'accueil.</p>
  <p>À la réception, le batch client extrait les films, affiche immédiatement les trois premiers, puis lance movie-match en séquence pour enrichir textes et scores.</p>

  <h3>3.2 — Edge surprise-personalized</h3>
  <p>Cerveau du pipeline. Enchaîne : recherche vectorielle SQL en cascade, complément SQL explicite si besoin, enrichissement langue TMDB, calcul du top 50 composite, sélection Gemini, enrichissement métadonnées TMDB, et chaîne de fallbacks (discover, trending, nuclear, safety net). Retourne un tableau de films avec scores LLM, raisons et métadonnées debug.</p>

  <h3>3.3 — Edge movie-match</h3>
  <p>Second passage IA, par film. Compare l'embedding 32D du film au profil utilisateur, génère headline et texte « pourquoi ça match », produit un score de confiance 55–99 %. Appelé séquentiellement côté client pour limiter la charge Gemini.</p>

  <div class="callout callout-arch">
    <strong>⚙ Décision d'architecture</strong>
    <p>La plateforme de streaming est filtrée dès la requête SQL et n'est jamais relâchée — même en cascade ou fallback nuclear. C'est une contrainte produit forte : Pick ne recommande que ce que l'utilisateur peut regarder maintenant.</p>
  </div>
</section>

<section>
  <h3>3.4 — Flux de données simplifié</h3>
  <div class="ascii-diagram">  [Utilisateur]
       │
       ▼
  ┌─────────────┐     JWT + profil + exclusions
  │   Client    │──────────────────────────────────────┐
  └─────────────┘                                      │
       │                                               ▼
       │                              ┌───────────────────────────┐
       │                              │  surprise-personalized    │
       │                              │  SQL → Top50 → Gemini     │
       │                              │  → TMDB → Fallbacks       │
       │                              └───────────────────────────┘
       │                                       │
       │◄──────── movies[] + debugData ────────┘
       │
       ├──► Affichage immédiat (3 flip cards)
       │
       └──► movie-match (×3 séquentiel) ──► textes riches + score final</div>

  <h3>3.5 — Sortie attendue</h3>
  <p>Typiquement <strong>3 films</strong> visibles (configurable jusqu'à 5 via recommendationCount). Chaque film inclut : identifiant TMDB, titre, affiche, type média, score fusionné, raison LLM, et après movie-match : headline, whyItMatches, providers streaming.</p>
</section>

<section class="page-break">
  <h2>4. Les entrées du moteur</h2>
  <p>La qualité des recommandations dépend autant des entrées que de l'algorithme. Le moteur consomme une dizaine de paramètres, parfois contradictoires — d'où une hiérarchie de résolution documentée au chapitre 7.</p>

  <h3>4.1 — Profil et vecteurs de goût</h3>
  <p>Trois vecteurs 32D complémentaires alimentent la similarité cosinus SQL :</p>
  <ul>
    <li><strong>Vecteur stable</strong> — goûts long terme, décroissance 150 jours, construit depuis tout l'historique</li>
    <li><strong>Vecteur récent</strong> — tendances 30 derniers jours, décroissance 21 jours</li>
    <li><strong>Vecteur évitement</strong> — skips et dislikes, décroissance 60 jours</li>
  </ul>
  <p>Le vecteur envoyé au SQL est une combinaison pondérée du stable et du récent, modulée par le niveau d'exploration.</p>

  <h3>4.2 — Likes et historique</h3>
  <p>Minimum 2 likes pour activer le pipeline complet. Les likes alimentent les genres préférés (likedGenres) utilisés en SQL niveau 0–2. L'historique complet (vues, skips, dislikes) alimente excludeIds — jamais un film déjà interagi ne doit réapparaître (invariant TNR).</p>

  <h3>4.3 — Plateformes</h3>
  <p>Liste des provider IDs TMDB (Netflix, Prime, Disney+, etc.) sélectionnés par l'utilisateur. Toujours appliquée en SQL. Si aucune plateforme n'est sélectionnée, le moteur cherche sur l'ensemble du catalogue streaming FR.</p>

  <h3>4.4 — Exclusions</h3>
  <p>excludeIds agrège : feedback utilisateur, rejets de session en cours, pool chat compagnon, historique partenaire duo, titres déjà proposés ce soir. Côté edge, usedIds reprend excludeIds pour éviter les doublons dans les fallbacks (régression corrigée juin 2026).</p>
</section>

<section>
  <h3>4.5 — Voix et ambiance</h3>
  <p>L'utilisateur peut dicter ou saisir une intention (« un polar des années 80 en VO »). La couche voix extrait : genres vocaux (voiceGenres), langue originale, décennie. Ces paramètres overrident le profil statique avec une priorité élevée (voir chapitre 7).</p>
  <p>L'<strong>ambiance</strong> (humeur du wizard ou intent soirée) modifie moodContext et moodBoostGenres — des genres boostés ou pénalisés selon l'humeur sélectionnée (léger, intense, émouvant…).</p>

  <h3>4.6 — Mode Duo</h3>
  <p>Quand duoUserIds est présent, le moteur fusionne les profils des deux partenaires : vecteur combiné, exclusions croisées (films déjà vus par l'un ou l'autre), genres communs priorisés. Le partenaire n'a pas besoin d'être connecté — son profil est lu côté serveur.</p>

  <h3>4.7 — Intent Révéler (soirée)</h3>
  <p>Les soirées groupées propagent des overrides depuis l'événement : genres imposés, humeur, type média. Le pipeline révéler réutilise le même moteur avec ces contraintes figées au moment de la création de la soirée.</p>

  <table>
    <thead><tr><th>Entrée</th><th>Source</th><th>Impact principal</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Vecteur 32D</td><td>Profil calculé</td><td>Similarité SQL</td></tr>
      <tr><td class="stack-category">excludeIds</td><td>Client + serveur</td><td>Films jamais reproposés</td></tr>
      <tr><td class="stack-category">platformIds</td><td>Préférences utilisateur</td><td>Filtre SQL permanent</td></tr>
      <tr><td class="stack-category">voiceGenres</td><td>Dictée / saisie</td><td>Post-filtres + cascade SQL</td></tr>
      <tr><td class="stack-category">moodBoostGenres</td><td>Wizard / soirée</td><td>Boost composite score</td></tr>
      <tr><td class="stack-category">duoUserIds</td><td>Mode Duo</td><td>Fusion profils + exclusions</td></tr>
      <tr><td class="stack-category">recommendationCount</td><td>Contexte appel</td><td>Nombre de films demandés (défaut 5, affichage 3)</td></tr>
    </tbody>
  </table>

  <div class="callout callout-warn">
    <strong>⚠ Attention debug</strong>
    <p>Les paramètres effectifs edge (après résolution voix/ambiance/duo) diffèrent parfois des paramètres client bruts. Toujours vérifier le groupe debug « Paramètres edge » et pipelineStages id 0-edge-request.</p>
  </div>
</section>

<section class="page-break">
  <h2>5. Étape par étape</h2>
  <p>Le pipeline complet comporte une quinzaine d'étapes numérotées, traçables via pipelineStages en mode debug. Ce chapitre les détaille dans l'ordre d'exécution.</p>

  <table>
    <thead><tr><th>#</th><th>Étape</th><th>Comptes typiques</th><th>Rôle</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">0</td><td>Préparation client</td><td>20–200+ excludeIds</td><td>Profil, exclusions, invocation edge</td></tr>
      <tr><td class="stack-category">1</td><td>SQL vectoriel cascade 0→3</td><td>Pool cible ~100</td><td>Similarité cosinus 32D, relâchement progressif</td></tr>
      <tr><td class="stack-category">1.4</td><td>SQL explicite</td><td>Complète jusqu'à 100</td><td>Sans vecteur ou pool insuffisant</td></tr>
      <tr><td class="stack-category">1.7</td><td>Enrichissement langue</td><td>Jusqu'à 60 candidats</td><td>Backfill original_language via TMDB</td></tr>
      <tr><td class="stack-category">2a–c</td><td>Post-filtres</td><td>Variable</td><td>Langues exclues, genres voix, décennie</td></tr>
      <tr><td class="stack-category">2</td><td>Top 50 composite</td><td>50 films</td><td>sim×100 + note TMDB + boost langue</td></tr>
      <tr><td class="stack-category">2.2</td><td>LLM Gemini</td><td>Entrée 50 → sortie count+2</td><td>Sélection + raisons JSON</td></tr>
      <tr><td class="stack-category">2.5</td><td>Retry qualité</td><td>+N si &lt; 3 ≥ minScore</td><td>Complète depuis pool SQL restant</td></tr>
      <tr><td class="stack-category">3</td><td>TMDB enrichissement</td><td>1 appel / sélection</td><td>Métadonnées complètes, providers</td></tr>
      <tr><td class="stack-category">4</td><td>discover-fallback</td><td>0–3 films</td><td>Trending TMDB avec plateformes</td></tr>
      <tr><td class="stack-category">4b</td><td>trending-fallback</td><td>0–3 films</td><td>Popular / trending élargi</td></tr>
      <tr><td class="stack-category">4c</td><td>nuclear-fallback</td><td>0–3 films</td><td>Genres et note levés, plateforme conservée</td></tr>
      <tr><td class="stack-category">5</td><td>Final safety net</td><td>Garantit count films</td><td>Tri origine + filet genre/langue</td></tr>
      <tr><td class="stack-category">6</td><td>movie-match client</td><td>1 appel / film séquentiel</td><td>Textes riches + score final</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h3>5.1 — Étape 0 : préparation client</h3>
  <p>Avant tout appel réseau, le client calcule le profil multi-vecteurs, normalise les plateformes, agrège excludeIds depuis feedback Supabase, sessionStorage et partenaire duo. Il envoie recommendationCount (souvent 5 côté edge, 3 affichés), explorationLevel, et debug:true sur l'accueil.</p>

  <h3>5.2 — Étape 1 : cascade SQL vectorielle</h3>
  <div class="diagram-wrap">${svgCascade}</div>
  <p>Quatre niveaux de relâchement, du plus strict au plus permissif. Le moteur tente le niveau 0 ; si le pool reste sous ~100 candidats non-interagis, il passe au niveau suivant. Le flag tasteCascadeTriggered indique qu'un relâchement a eu lieu.</p>

  <h3>5.3 — Étape 1.4 : SQL explicite</h3>
  <p>Si le vecteur est absent ou le pool vectoriel insuffisant, une requête sans similarité complète le pool via match_movies_explicit en trois niveaux (goût strict → plateforme seule).</p>

  <h3>5.4 — Étape 2.2 : sélection Gemini</h3>
  <p>Le top 50 composite est numéroté et envoyé à Gemini avec le profil utilisateur complet. Le modèle retourne un JSON selections[{rank, matchScore, reason}]. En cas d'échec LLM, un fallback déterministe prend les N premiers du top 50 avec reason:null.</p>

  <div class="callout callout-arch">
    <strong>⚙ Décision d'architecture</strong>
    <p>Le LLM reçoit count+2 sélections (ex. 5 si count=3) pour laisser une marge au client qui n'affichera que les 3 meilleurs après fusion et exclusions résiduelles.</p>
  </div>
</section>

<section>
  <h3>5.5 — Fallbacks discover, trending, nuclear</h3>
  <p>Si SQL + LLM produisent zéro film valide, la chaîne de fallbacks TMDB s'enclenche : discover avec filtres plateforme, puis trending/popular, puis mode nuclear (genres et note minimum levés, plateforme toujours active). Chaque fallback est tracé dans fallbackTrace.</p>

  <h3>5.6 — Safety net et backfill client</h3>
  <p>Le filet de sécurité edge (étape 5-final-safety) garantit le nombre de films demandés en complétant depuis le pool SQL restant, avec vérification genres/langues exclus. Côté client, ensureRecommendationBatch peut backfiller de 1 à 3 films si le batch initial est incomplet — sans appel TMDB aveugle (correction audit juin 2026).</p>

  <div class="callout callout-warn">
    <strong>⚠ Attention debug</strong>
    <p>Un batch de 1 seul film indique généralement des contraintes trop strictes (plateforme rare + genres voix étroits) ou un pool SQL épuisé. Vérifier sqlCascadeLevel, fallbackTrace et le nombre d'excludeIds.</p>
  </div>

  <h3>5.7 — Constantes serveur clés</h3>
  <table>
    <thead><tr><th>Constante</th><th>Valeur</th><th>Signification</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">TARGET</td><td>100</td><td>Pool SQL cible</td></tr>
      <tr><td class="stack-category">llmPoolSize</td><td>50</td><td>Films envoyés au LLM</td></tr>
      <tr><td class="stack-category">BATCH</td><td>500</td><td>Candidats par round RPC</td></tr>
      <tr><td class="stack-category">minMatchScore</td><td>~60</td><td>Seuil retry qualité étape 2.5</td></tr>
      <tr><td class="stack-category">min_rating SQL</td><td>6 (niv. 0–2), 0 (niv. 3)</td><td>Note TMDB minimum</td></tr>
    </tbody>
  </table>
</section>
`;
