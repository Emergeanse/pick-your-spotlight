import { svgFallbacks, svgScores } from './handbook-tome2-diagrams.mjs';

export const CHAPTERS_6_10 = `
<section class="page-break">
  <h2>6. Filtres successifs</h2>
  <p>Le moteur applique une série de filtres en entonnoir : chaque étape réduit le pool candidat. Comprendre l'ordre et les conditions de relâchement est essentiel pour diagnostiquer les recommandations trop génériques ou trop restrictives.</p>

  <div class="diagram-wrap">${svgFallbacks}</div>

  <h3>6.1 — Filtres SQL (edge)</h3>
  <table>
    <thead><tr><th>Filtre</th><th>Quand appliqué</th><th>Relâché à</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Plateforme</td><td>Toujours (si sélectionnée)</td><td>Jamais</td></tr>
      <tr><td class="stack-category">Langue originale</td><td>SQL niv. 0 + voix</td><td>Niveau 1+</td></tr>
      <tr><td class="stack-category">Décennie (min/max year)</td><td>SQL niv. 0 + voiceDecade</td><td>Niveau 1+ (sauf voiceDecade hard)</td></tr>
      <tr><td class="stack-category">Genres profil (likedGenres)</td><td>SQL niv. 0–1</td><td>Niveau 2 (voiceGenres conservés)</td></tr>
      <tr><td class="stack-category">Note minimum TMDB</td><td>SQL niv. 0–2 (≥ 6)</td><td>Niveau 3 (min_rating=0)</td></tr>
      <tr><td class="stack-category">Popularité minimum</td><td>SQL niv. 0–2</td><td>Niveau 3</td></tr>
      <tr><td class="stack-category">excludeIds</td><td>Toujours</td><td>Jamais</td></tr>
      <tr><td class="stack-category">Genres exclus profil</td><td>Toujours</td><td>Jamais (safety net final)</td></tr>
    </tbody>
  </table>

  <h3>6.2 — Post-filtres (après SQL, avant LLM)</h3>
  <p>Trois post-filtres affinent le pool avant le top 50 :</p>
  <ul>
    <li><strong>2a — Langues exclues</strong> : retire les original_language dans effectiveExcludedLangs</li>
    <li><strong>2b — Genres voix</strong> : si ≥ 5 candidats restent après filtre voiceGenres, applique le filtre ; sinon conserve le pool (évite le vide)</li>
    <li><strong>2c — Décennie</strong> : voiceDecade en mode hard (élimination stricte) ou profileDecades en mode soft (boost seulement)</li>
  </ul>
</section>

<section>
  <h3>6.3 — Filtres LLM et TMDB</h3>
  <p>Gemini sélectionne dans le top 50 en tenant compte du profil textuel — ce n'est pas un filtre binaire mais une re-ranking intelligente. L'enrichissement TMDB valide que chaque ID existe, récupère providers streaming et corrige le media_type (movie vs tv).</p>

  <h3>6.4 — Chaîne de fallbacks</h3>
  <table>
    <thead><tr><th>Fallback</th><th>Déclencheur</th><th>Ce qui est relâché</th><th>Ce qui est conservé</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">SQL explicite</td><td>Pool vectoriel &lt; TARGET</td><td>Similarité vectorielle</td><td>Plateforme, exclusions</td></tr>
      <tr><td class="stack-category">LLM déterministe</td><td>Gemini KO / JSON invalide</td><td>Sélection IA</td><td>Top 50 trié composite</td></tr>
      <tr><td class="stack-category">Retry qualité 2.5</td><td>&lt; 3 films ≥ minMatchScore</td><td>Seuil score LLM</td><td>Pool SQL restant</td></tr>
      <tr><td class="stack-category">discover-fallback</td><td>0 films post-LLM</td><td>Personnalisation goût</td><td>Plateforme, excludeIds</td></tr>
      <tr><td class="stack-category">trending-fallback</td><td>discover insuffisant</td><td>Filtres discover</td><td>Plateforme</td></tr>
      <tr><td class="stack-category">nuclear-fallback</td><td>trending insuffisant</td><td>Genres, note min</td><td>Plateforme uniquement</td></tr>
      <tr><td class="stack-category">Safety net final</td><td>count &lt; demandé</td><td>Ordre origine</td><td>Genres/langues exclus</td></tr>
      <tr><td class="stack-category">Backfill client</td><td>Batch &lt; 3 affichés</td><td>—</td><td>Films réserve SP non affichés</td></tr>
    </tbody>
  </table>

  <div class="callout callout-good">
    <strong>✓ Bonnes pratiques</strong>
    <p>Lors d'un diagnostic « recommandations génériques », vérifier tasteCascadeTriggered et le niveau SQL atteint. Un niveau 3 systématique signale un profil contraint ou un pool d'exclusions trop large — pas un bug LLM.</p>
  </div>
</section>

<section class="page-break">
  <h2>7. Paramètres et overrides</h2>
  <p>De multiples sources alimentent le moteur simultanément. Sans hiérarchie claire, les conflits produiraient des comportements imprévisibles. Pick applique une résolution strictement ordonnée.</p>

  <h3>7.1 — Hiérarchie de priorité</h3>
  <div class="ascii-diagram">  Priorité décroissante :
  ┌──────────────────────────────────────┐
  │  1. DUO — profils fusionnés         │
  │  2. VOIX — intention explicite       │
  │  3. AMBIANCE — humeur / soirée       │
  │  4. PROFIL — goûts statiques         │
  └──────────────────────────────────────┘</div>

  <p>En mode Duo, les exclusions des deux partenaires s'additionnent et le vecteur fusionné prime. Une commande vocale « je veux un western » overridera les genres profil mais pas les plateformes duo communes. L'ambiance « intense » booste thrillers et dramas même si le profil stable penche comédie.</p>

  <h3>7.2 — Paramètres ajustables clés</h3>
  <table>
    <thead><tr><th>Paramètre</th><th>Défaut</th><th>Effet</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">recommendationCount</td><td>5 (edge) / 3 (UI)</td><td>Nombre de films produits vs affichés</td></tr>
      <tr><td class="stack-category">explorationLevel</td><td>0–2</td><td>Poids vecteur récent vs stable</td></tr>
      <tr><td class="stack-category">llmPoolSize</td><td>50</td><td>Taille du pool pré-LLM</td></tr>
      <tr><td class="stack-category">minMatchScore</td><td>~60</td><td>Seuil qualité retry 2.5</td></tr>
      <tr><td class="stack-category">min_rating</td><td>6 → 0</td><td>Note TMDB min par niveau cascade</td></tr>
      <tr><td class="stack-category">voiceGenreThreshold</td><td>5</td><td>Min candidats avant filtre genre voix</td></tr>
      <tr><td class="stack-category">preferredLangBoost</td><td>+15</td><td>Bonus langue préférée composite</td></tr>
      <tr><td class="stack-category">spMinValid (fusion)</td><td>60</td><td>Score SP minimum avant fusion MM</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h3>7.3 — Overrides voix</h3>
  <p>voiceGenres, voiceOriginalLanguage et voiceDecade sont extraits de la dictée utilisateur. voiceDecade peut être « hard » (filtre éliminatoire post-SQL) ou absent (profil décennies en soft boost). Les genres voix remplacent likedGenres à partir du niveau SQL 2.</p>

  <h3>7.4 — Overrides ambiance et soirée</h3>
  <p>moodContext décrit l'humeur en texte libre pour le prompt LLM. moodBoostGenres liste les genres à favoriser (ex. « Comédie » en mode détente). En intent Révéler, mediaType, genres et mood sont figés depuis l'événement soirée.</p>

  <div class="callout callout-arch">
    <strong>⚙ Décision d'architecture</strong>
    <p>Les overrides ne modifient jamais excludeIds ni platformIds — ce sont des contraintes dures. Seuls les critères de « goût positif » (genres, décennie, langue) sont sujets à la hiérarchie.</p>
  </div>

  <h3>7.5 — explorationLevel</h3>
  <p>Trois niveaux modulant le mélange stable/récent : niveau 0 (conservateur, profil stable dominant), niveau 1 (équilibré), niveau 2 (explorateur, vecteur récent fortement pondéré). Impacte le query_vector SQL et le ton du prompt LLM.</p>
</section>

<section class="page-break">
  <h2>8. Les trois échelles de score</h2>
  <p>Pick affiche un pourcentage de match sur chaque flip card. Derrière ce chiffre unique se cachent <strong>trois systèmes de scoring distincts</strong>, non directement comparables. Les confondre est l'erreur de debug la plus fréquente.</p>

  <div class="diagram-wrap">${svgScores}</div>

  <h3>8.1 — Sim% (similarité SQL)</h3>
  <p>Produit de la similarité cosinus entre le vecteur utilisateur et l'embedding film, multiplié par 100. Plage typique 0–100. Sert au tri du pool SQL et aux tables debug sqlCandidates. Ne tient pas compte de l'humeur du moment ni du contexte LLM.</p>

  <h3>8.2 — Score composite (pré-LLM)</h3>
  <p>Formule : Sim% + note TMDB (vote_average) + bonus +15 si langue originale préférée. Utilisé pour construire le top 50. Échelle non bornée supérieurement (~0–115). N'apparaît pas directement dans l'UI.</p>

  <h3>8.3 — LLM matchScore</h3>
  <p>Score assigné par Gemini dans selections[], borné 60–99 par le prompt. Reflète l'adéquation contextuelle (« ce soir, comédie légère »). Affiché immédiatement à onBatchReady avant movie-match.</p>

  <h3>8.4 — movie-match score</h3>
  <p>Score 55–99 produit par la edge function movie-match, combinant embedding 32D et jugement Gemini. Alimente le badge final et les textes headline / whyItMatches. Seuil plancher profil à 55 côté MM.</p>
</section>

<section>
  <h3>8.5 — Règles de fusion client</h3>
  <p>Le score affiché final résulte de mergeRecommendationScores :</p>
  <ol>
    <li>Ignorer tout score SP (LLM) &lt; 60 % — considéré aberrant</li>
    <li>Si SP valide et MM disponibles : prendre le maximum des deux</li>
    <li>Sinon : SP valide seul, ou MM seul, ou null</li>
  </ol>

  <div class="callout callout-warn">
    <strong>⚠ Attention debug</strong>
    <p>Ne jamais trier les films finaux par Sim% en supposant refléter l'ordre UI. Un film Sim% 78 peut être classé derrière un Sim% 65 si le LLM l'a favorisé contextuellement. Utiliser llmSelections puis le score fusionné client.</p>
  </div>

  <h3>8.6 — Pourquoi trois échelles ?</h3>
  <p>Chaque échelle optimise un objectif différent : Sim% pour la proximité vectorielle brute, composite pour diversifier avec la qualité TMDB, LLM pour le contexte du soir, movie-match pour la personnalisation fine et les textes. Les fusionner en une seule métrique trop tôt dégraderait l'un de ces objectifs.</p>

  <table>
    <thead><tr><th>Échelle</th><th>Moment</th><th>Visible UI</th><th>Comparable avec</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Sim%</td><td>SQL</td><td>Debug seulement</td><td>Composite (base)</td></tr>
      <tr><td class="stack-category">Composite</td><td>Pré-LLM</td><td>Non</td><td>Sim% (composante)</td></tr>
      <tr><td class="stack-category">LLM matchScore</td><td>Post-Gemini</td><td>Teaser immédiat</td><td>MM (après fusion)</td></tr>
      <tr><td class="stack-category">movie-match</td><td>Post-MM</td><td>Badge final</td><td>LLM (après fusion)</td></tr>
    </tbody>
  </table>
</section>

<section class="page-break">
  <h2>9. Quirks connus</h2>
  <p>L'audit de juin 2026 a identifié plusieurs comportements non intuitifs du moteur. Ils ne sont pas des bugs mais des conséquences de compromis architecturels — à connaître pour éviter fausses alertes.</p>

  <h3>9.1 — reason: null</h3>
  <p><strong>Symptôme</strong> : colonne « Raison » vide dans les tables debug, ou justification absente sur une flip card.</p>
  <p><strong>Causes</strong> : fallback LLM déterministe (Gemini KO), retry qualité étape 2.5, parsing JSON partiel (regex fallback sans champ reason).</p>
  <p><strong>Impact UI</strong> : l'interface conserve parfois le teaser LLM initial même si reason devient null côté edge. Les textes movie-match (headline, whyItMatches) compensent généralement l'absence.</p>
  <p><strong>Debug</strong> : vérifier llmSelections, fallbackTriggered dans pipelineStages 2.2, et logs ⚠️ FALLBACK côté client.</p>

  <h3>9.2 — Trois échelles non comparables</h3>
  <p><strong>Symptôme</strong> : film A Sim% 82 classé derrière film B Sim% 71 dans le résultat final.</p>
  <p><strong>Cause</strong> : le LLM et movie-match re-rankent selon le contexte, pas la similarité brute.</p>
  <p><strong>Impact</strong> : confusion lors de l'analyse debug, fausses régressions signalées.</p>
  <p><strong>Debug</strong> : comparer llmSelections.matchScore et score MM final, pas sqlCandidates.similarity.</p>
</section>

<section>
  <h3>9.3 — movie-match FALLBACK</h3>
  <p><strong>Symptôme</strong> : log client « ⚠️ FALLBACK » pour un film, textes génériques, score MM absent ou par défaut.</p>
  <p><strong>Cause</strong> : Gemini indisponible ou timeout dans movie-match. Retour objet { fallback: true }.</p>
  <p><strong>Impact</strong> : retry automatique après 4 secondes ; film de réserve waterfall si échec persistant.</p>
  <p><strong>Debug</strong> : chronologie [Pick⏱] movie-match · vérifier charge Gemini · un seul FALLBACK occasionnel est normal en pic.</p>

  <h3>9.4 — Autres quirks documentés</h3>
  <table>
    <thead><tr><th>Quirk</th><th>Impact</th><th>Tip debug</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">tasteCascadeTriggered</td><td>Reco plus générique</td><td>Noter sqlCascadeLevel atteint</td></tr>
      <tr><td class="stack-category">Batch 1 film</td><td>UX dégradée</td><td>excludeIds count + plateformes rares</td></tr>
      <tr><td class="stack-category">Plateforme bypass LLM</td><td>Filtre plateforme souvent redondant post-SQL</td><td>platformPool vs llmFiltered</td></tr>
      <tr><td class="stack-category">usedIds régression 2026-06-03</td><td>Doublons en fallback</td><td>Corrigé — must inclure excludeIds</td></tr>
      <tr><td class="stack-category">Backfill TMDB aveugle</td><td>Films hors profil</td><td>Corrigé juin 2026 — réserve SP uniquement</td></tr>
    </tbody>
  </table>

  <div class="callout callout-info">
    <strong>ℹ Corrections récentes (v1.23)</strong>
    <p>Renommage debug top20→top50, sql50→sqlCandidates. platformFallbackTriggered remplacé par tasteCascadeTriggered. platformCandidatesCount n'est plus écrasé par la taille du pool LLM.</p>
  </div>
</section>

<section class="page-break">
  <h2>10. Modes spéciaux</h2>
  <p>Le pipeline s'adapte à des contextes d'appel différents. Le cœur reste identique ; seules les entrées et la sortie diffèrent.</p>

  <h3>10.1 — Fallback &lt; 2 likes</h3>
  <p>Sans profil minimum, surprise-personalized n'est pas invoquée. Le client appelle getSurpriseRecommendation (TMDB trending/discover léger) pour afficher un titre unique non personnalisé. Message UX encourageant l'onboarding.</p>

  <h3>10.2 — Vecteur null</h3>
  <p>Profil avec likes mais vecteur non calculé (cache expiré, migration en cours) : SQL vectoriel sauté, SQL explicite puis discover-fallback. Résultats moins pertinents mais non vides.</p>

  <h3>10.3 — Mode Duo</h3>
  <p>duoUserIds active la fusion de profils : vecteur combiné (moyenne pondérée), excludeIds union des deux historiques, partnerUserId passé au RPC SQL. Genres communs favorisés dans le prompt LLM.</p>

  <h3>10.4 — Intent Révéler (soirée)</h3>
  <p>runRevealPipeline propage mood, genres et mediaType depuis l'événement. Overlay révélation sans flash accueil. Pas de movie-match client sur la création d'événement (count:3 direct). Synchronisation présence temps réel pour la révélation collective.</p>
</section>

<section>
  <h3>10.5 — Wizard vs accueil</h3>
  <table>
    <thead><tr><th>Aspect</th><th>Wizard /app</th><th>Accueil « Ce soir »</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Collecte contexte</td><td>Explicite (étapes)</td><td>Mémorisé + voix/ambiance</td></tr>
      <tr><td class="stack-category">debug: true</td><td>Non par défaut</td><td>Oui (PICK-DEBUG prod)</td></tr>
      <tr><td class="stack-category">Edge function</td><td>surprise-personalized</td><td>Idem</td></tr>
      <tr><td class="stack-category">movie-match</td><td>Oui, séquentiel</td><td>Oui, séquentiel</td></tr>
      <tr><td class="stack-category">UI résultats</td><td>ResultScreen plein écran</td><td>TonightPickOverlay</td></tr>
    </tbody>
  </table>

  <h3>10.6 — Création événement soirée</h3>
  <p>Lors de la création d'une soirée (CreateEventPage), le pipeline produit 3 films sans enrichissement movie-match côté client — les métadonnées SP suffisent pour la prévisualisation organisateur. Le movie-match intervient au moment de la révélation si configuré.</p>

  <div class="callout callout-good">
    <strong>✓ Bonnes pratiques</strong>
    <p>Tester chaque mode spécial indépendamment : profil neuf (&lt;2 likes), duo actif, soirée avec intent restrictif, wizard avec genres étroits. Les TNR phase 2 couvrent les fixtures JSON pour SP complet et safety net 1 film.</p>
  </div>
</section>
`;
