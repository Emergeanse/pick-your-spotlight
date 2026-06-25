export const CHAPTERS_11_16 = `
<section class="page-break">
  <h2>11. Performance</h2>
  <p>La promesse Pick (« moins de 2 minutes ») impose une latence pipeline cible inférieure à 15 secondes pour l'affichage des flip cards. Ce chapitre documente les timings observés, les goulots d'étranglement et la feuille de route optimisation.</p>

  <h3>11.1 — Timings typiques (accueil)</h3>
  <table>
    <thead><tr><th>Étape</th><th>Durée typique</th><th>Variable principale</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Profil client</td><td>100–300 ms</td><td>Cache user_taste_vectors</td></tr>
      <tr><td class="stack-category">SQL cascade</td><td>800 ms – 2 s</td><td>Niveau atteint, excludeIds count</td></tr>
      <tr><td class="stack-category">Enrichissement langue</td><td>0–3 s</td><td>Candidats lang null</td></tr>
      <tr><td class="stack-category">Top 50 + post-filtres</td><td>&lt; 100 ms</td><td>Taille pool</td></tr>
      <tr><td class="stack-category">Gemini LLM</td><td>2–6 s</td><td>Charge API Google</td></tr>
      <tr><td class="stack-category">TMDB enrich batch</td><td>500 ms – 1.5 s</td><td>Nombre sélections</td></tr>
      <tr><td class="stack-category">Fallbacks (si déclenchés)</td><td>+1–4 s</td><td>Type fallback</td></tr>
      <tr><td class="stack-category">movie-match ×3</td><td>6–15 s total</td><td>Séquentiel — 2–5 s/appel</td></tr>
    </tbody>
  </table>
  <p><strong>Total perçu utilisateur</strong> : 5–12 s jusqu'aux flip cards (sans movie-match), 15–25 s jusqu'aux textes riches complets.</p>

  <h3>11.2 — Goulot principal : movie-match séquentiel</h3>
  <p>Chaque appel movie-match enchaîne embedding lookup, prompt Gemini et formatage réponse. Trois films affichés = trois appels séquentiels (~2–5 s chacun). C'est le poste d'amélioration prioritaire (voir chapitre 14).</p>

  <div class="callout callout-arch">
    <strong>⚙ Décision d'architecture</strong>
    <p>L'affichage immédiat post-LLM (onBatchReady) compense la latence movie-match : l'utilisateur voit des propositions en ~10 s pendant que les textes riches se chargent. Ne pas bloquer l'UI sur movie-match.</p>
  </div>
</section>

<section>
  <h3>11.3 — Autres facteurs de latence</h3>
  <ul>
    <li><strong>Cascade SQL niveau 3</strong> — plusieurs rounds RPC 500 candidats</li>
    <li><strong>Enrichissement langue 1.7</strong> — jusqu'à 60 appels TMDB unitaires</li>
    <li><strong>excludeIds volumineux</strong> — 200+ IDs ralentissent les RPC PostgreSQL</li>
    <li><strong>Fallback chain</strong> — discover + trending + nuclear en cascade</li>
  </ul>

  <h3>11.4 — Roadmap optimisation (P2)</h3>
  <table>
    <thead><tr><th>Optimisation</th><th>Gain estimé</th><th>Statut</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">movie-match parallèle (×3 concurrent)</td><td>−10 s</td><td>Planifié</td></tr>
      <tr><td class="stack-category">Cache embeddings TMDB</td><td>−1–2 s SQL</td><td>Partiel (movie_embeddings)</td></tr>
      <tr><td class="stack-category">recentTasteVector in SQL</td><td>Meilleure pertinence sans latence</td><td>Planifié</td></tr>
      <tr><td class="stack-category">Timeouts UX + retry</td><td>Perception</td><td>Toast erreur fait (1.4)</td></tr>
      <tr><td class="stack-category">engineMeta → monitoring</td><td>Observabilité prod</td><td>Planifié (2.8)</td></tr>
    </tbody>
  </table>

  <div class="callout callout-good">
    <strong>✓ Bonnes pratiques</strong>
    <p>Utiliser les préfixes [Pick⏱] et engineMeta.timings pour profiler chaque requête. Comparer SQL ms vs LLM ms vs MM ms avant d'optimiser — ne pas paralléliser MM si le goulot est SQL niveau 3.</p>
  </div>
</section>

<section class="page-break">
  <h2>12. Debug &amp; observabilité</h2>
  <p>Le moteur expose une instrumentation riche activée par debug:true. En production sur l'accueil, les groupes [PICK-DEBUG] structurent la console développeur pour tracer chaque étape sans outil externe.</p>

  <h3>12.1 — Groupes console [PICK-DEBUG]</h3>
  <table>
    <thead><tr><th>Groupe</th><th>Contenu</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">📋 Paramètres par étape</td><td>pipelineStages — synthèse entrée/sortie/fallback</td></tr>
      <tr><td class="stack-category">📤 Paramètres envoyés</td><td>Vecteur, plateformes, genres, excludeIds (client)</td></tr>
      <tr><td class="stack-category">1️⃣ SQL vectoriel 32D</td><td>sqlCandidates, sqlCascadeLevel, sqlRpcParams, snippet RPC</td></tr>
      <tr><td class="stack-category">📈 Détail par niveau</td><td>sqlLevelDebug — films gagnés par niveau 0–3</td></tr>
      <tr><td class="stack-category">1️⃣⁺ SQL explicite</td><td>explicitFallbackDebug</td></tr>
      <tr><td class="stack-category">🧠 Profil → LLM</td><td>llmProfile, systemPrompt complet</td></tr>
      <tr><td class="stack-category">2️⃣ Top N → LLM</td><td>top50 — jusqu'à 50 films numérotés</td></tr>
      <tr><td class="stack-category">3️⃣ Sélections LLM</td><td>llmSelections — matchScore + reason</td></tr>
      <tr><td class="stack-category">🔀 Films fallback</td><td>fallbackTrace — discover/trending/nuclear</td></tr>
      <tr><td class="stack-category">3️⃣.5 TMDB enrich</td><td>tmdbEnrichment — OK/échec par ID</td></tr>
      <tr><td class="stack-category">4️⃣ Films finaux edge</td><td>finalMoviesList avant movie-match</td></tr>
      <tr><td class="stack-category">⏱️ Timings pipeline</td><td>engineMeta.timings par étape</td></tr>
      <tr><td class="stack-category">4️⃣ Résultat final MM</td><td>Score MM, rich texts vs FALLBACK</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h3>12.2 — pipelineStages (v25+)</h3>
  <p>Tableau ordonné d'objets { id, name, params, fallbackTriggered, fallbackReason, inputCount, outputCount }. Permet de reconstruire le parcours complet sans lire chaque groupe console.</p>

  <table>
    <thead><tr><th>id</th><th>Étape tracée</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">0-client-request</td><td>Paramètres avant invoke</td></tr>
      <tr><td class="stack-category">0-edge-request</td><td>Paramètres effectifs (voix/mood/duo résolus)</td></tr>
      <tr><td class="stack-category">1-sql-vector</td><td>Cascade SQL 0→3</td></tr>
      <tr><td class="stack-category">1.4-sql-explicit</td><td>Complément explicite</td></tr>
      <tr><td class="stack-category">1.7-lang-enrich</td><td>Backfill langue TMDB</td></tr>
      <tr><td class="stack-category">2a–c post-filters</td><td>Langue, genre voix, décennie</td></tr>
      <tr><td class="stack-category">2-top50-composite</td><td>Top 50 score composé</td></tr>
      <tr><td class="stack-category">2.2-llm-selection</td><td>Gemini + fallback déterministe</td></tr>
      <tr><td class="stack-category">2.5-quality-retry</td><td>Complément minMatchScore</td></tr>
      <tr><td class="stack-category">3-tmdb-enrich</td><td>Lookup TMDB batch</td></tr>
      <tr><td class="stack-category">4-discover / 4b / 4c</td><td>Chaîne fallbacks TMDB</td></tr>
      <tr><td class="stack-category">5-final-safety</td><td>Filet sécurité edge</td></tr>
      <tr><td class="stack-category">6-movie-match</td><td>Appels séquentiels client</td></tr>
    </tbody>
  </table>

  <h3>12.3 — engineMeta</h3>
  <p>Objet retourné avec la réponse SP : tasteCascadeTriggered, sqlCandidatesCount, llmPoolCount, mode (normal/fallback), timings détaillés (sqlMs, langMs, llmMs, tmdbMs, fallbackMs). Alimente l'optimisation continue et le monitoring futur (Sentry, tâche 2.8).</p>

  <div class="callout callout-warn">
    <strong>⚠ Attention debug</strong>
    <p>debugData n'est pas exposé en production aux utilisateurs finaux — visible console uniquement. Ne jamais logger systemPrompt ou profil complet côté serveur persistant (RGPD). Le flag debug reste actif sur l'accueil pour l'équipe alpha.</p>
  </div>
</section>

<section class="page-break">
  <h2>13. Qualité &amp; TNR</h2>
  <p>Le moteur de recommandation est protégé par une suite de tests de non-régression (TNR) en trois phases. L'objectif : toute modification du pipeline doit être vérifiable sans regarder 500 films.</p>

  <h3>13.1 — État juin 2026</h3>
  <div class="two-col">
    <div class="stat-box"><div class="num">131</div><div class="label">tests unitaires passants</div></div>
    <div class="stat-box"><div class="num">70</div><div class="label">tests pipeline dédiés</div></div>
  </div>

  <table>
    <thead><tr><th>Suite</th><th>Tests</th><th>Périmètre</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">taste-engine</td><td>28</td><td>Vecteurs, decay, profil multi-vecteurs</td></tr>
      <tr><td class="stack-category">recommendation-pipeline</td><td>23</td><td>Fonctions pures SP extraites (composite, cascade, parse LLM)</td></tr>
      <tr><td class="stack-category">recommendation-batch</td><td>9</td><td>Extraction payload, fusion scores, normalisation textes</td></tr>
      <tr><td class="stack-category">recommendation-batch-integration</td><td>8</td><td>Mocks SP/MM, backfill, genres exclus</td></tr>
      <tr><td class="stack-category">recommendation-non-regression</td><td>15</td><td>Invariants exclusions, usedIds, filet 1→3</td></tr>
    </tbody>
  </table>

  <h3>13.2 — Phases TNR pipeline</h3>
  <table>
    <thead><tr><th>Phase</th><th>Statut</th><th>Livrables</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Phase 1 — Unitaires</td><td>✅ Done</td><td>taste-engine, batch helpers, fonctions pures SP</td></tr>
      <tr><td class="stack-category">Phase 2 — Intégration</td><td>✅ Done (25/06)</td><td>Fixtures JSON SP/MM, batch-integration, non-regression étendu</td></tr>
      <tr><td class="stack-category">Phase 3 — E2E</td><td>⏳ En cours</td><td>pipeline.spec stable, smoke post-deploy, couverture 70 %</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h3>13.3 — Invariants non négociables</h3>
  <ul>
    <li><strong>Jamais de film déjà interagi</strong> — excludeIds respecté en sortie edge et client</li>
    <li><strong>Genres exclus absents</strong> — safety net checkFinalSafety</li>
    <li><strong>usedIds inclut excludeIds</strong> — régression 2026-06-03 documentée</li>
    <li><strong>Backfill sans TMDB aveugle</strong> — réserve SP uniquement (correction audit)</li>
    <li><strong>Plateforme conservée en fallback nuclear</strong> — contrainte produit</li>
    <li><strong>mergeScore ignore SP &lt; 60</strong> — pas de score aberrant affiché</li>
  </ul>

  <h3>13.4 — Gaps phase 3</h3>
  <ul>
    <li>E2E pipeline avec credentials stables (pas seulement mocks)</li>
    <li>Checklist manuelle post-deploy § smoke tests 3.2</li>
    <li>Mesure automatisée couverture 70 % sur logique métier lib/</li>
    <li>Tests duo bout-en-bout non automatisés</li>
  </ul>

  <div class="callout callout-good">
    <strong>✓ Bonnes pratiques</strong>
    <p>Avant tout refactor HomeScreen ou pipeline : npm run test:unit (131 tests, ~10 s). Ajouter un test pour chaque bug corrigé. Les fixtures sp-response-full.json et sp-response-safety-net-1.json servent de références shape API.</p>
  </div>
</section>

<section class="page-break">
  <h2>14. Évolutions prévues</h2>
  <p>Le moteur alpha est fonctionnel mais pas optimisé. Cette section recense les améliorations planifiées, classées par impact.</p>

  <h3>14.1 — Performance</h3>
  <ul>
    <li><strong>movie-match parallèle</strong> — Promise.all sur 3 films au lieu de séquentiel (−10 s typique)</li>
    <li><strong>recentTasteVector in SQL</strong> — intégrer le vecteur récent directement dans la RPC pour meilleure pertinence sans latence client</li>
    <li><strong>Batch TMDB lang enrich</strong> — réduire les appels unitaires étape 1.7</li>
  </ul>

  <h3>14.2 — Maintenabilité</h3>
  <ul>
    <li><strong>HomeScreen refactor (2.5)</strong> — extraction hooks useProfileLoader, useRecommendationEngine, useTonightMovieState — petits diffs, pas de gros bang</li>
    <li><strong>TonightPickContext (1.20)</strong> — réduire ~30 props overlay, PR par étapes pair humain</li>
    <li><strong>Split ResultScreen + Overlay (2.10)</strong> — composants &gt;1000 lignes chacun</li>
  </ul>

  <h3>14.3 — Observabilité &amp; prod</h3>
  <ul>
    <li><strong>engineMeta → Sentry/dashboard (2.8)</strong> — timings, cascade level, fallback rate</li>
    <li><strong>Métriques produit</strong> — time-to-pick, satisfaction post-reco, taux fallback</li>
    <li><strong>Secret TMDB serveur (1.16)</strong> — avant beta testeurs externes</li>
  </ul>

  <div class="callout callout-arch">
    <strong>⚙ Décision d'architecture</strong>
    <p>Aucun refactor pipeline profond sans tests 1.19 en place — désormais satisfait (131 tests). Les prochains refactors HomeScreen sont débloqués mais doivent rester incrémentaux.</p>
  </div>
</section>

<section class="page-break">
  <h2>15. Glossaire technique produit</h2>
  <p>Termes spécifiques au moteur de recommandation Pick, complémentaires au glossaire produit du Tome 1.</p>

  <table>
    <thead><tr><th>Terme</th><th>Définition</th></tr></thead>
    <tbody>
      <tr><td class="stack-category">Vecteur stable</td><td>Embedding 32D goûts long terme, decay 150 jours</td></tr>
      <tr><td class="stack-category">Vecteur récent</td><td>Embedding 32D tendances 30 jours, decay 21 jours</td></tr>
      <tr><td class="stack-category">Vecteur évitement</td><td>Embedding 32D skips/dislikes, decay 60 jours</td></tr>
      <tr><td class="stack-category">Cascade goût (SQL)</td><td>4 niveaux 0→3 relâchant progressivement lang, année, genres, note</td></tr>
      <tr><td class="stack-category">SQL explicite</td><td>Requête sans similarité vectorielle, complément pool</td></tr>
      <tr><td class="stack-category">Top 50 composite</td><td>Pool pré-LLM trié par sim×100 + note + boost langue</td></tr>
      <tr><td class="stack-category">Sim%</td><td>Similarité cosinus × 100 — échelle debug SQL</td></tr>
      <tr><td class="stack-category">matchScore LLM</td><td>Score 60–99 assigné par Gemini à la sélection</td></tr>
      <tr><td class="stack-category">surprise-personalized</td><td>Edge function pipeline batch principal</td></tr>
      <tr><td class="stack-category">movie-match</td><td>Edge function scoring fin + textes riches par film</td></tr>
      <tr><td class="stack-category">Filet sécurité (safety net)</td><td>Mécanisme edge garantissant le count demandé</td></tr>
      <tr><td class="stack-category">Pool backfill</td><td>Films réserve SP utilisés par le client si batch &lt; 3</td></tr>
      <tr><td class="stack-category">excludeIds</td><td>Liste TMDB IDs jamais reproposés (historique + session)</td></tr>
      <tr><td class="stack-category">usedIds</td><td>Set edge incluant excludeIds — anti-doublon fallbacks</td></tr>
      <tr><td class="stack-category">tasteCascadeTriggered</td><td>Flag : relâchement SQL niveau &gt; 0</td></tr>
      <tr><td class="stack-category">onBatchReady</td><td>Callback client — affichage immédiat post-LLM</td></tr>
      <tr><td class="stack-category">pipelineStages</td><td>Tableau debug trace ordonnée des étapes</td></tr>
      <tr><td class="stack-category">engineMeta</td><td>Métriques timings et counts retournées par SP</td></tr>
      <tr><td class="stack-category">PICK-DEBUG</td><td>Préfixe groupes console debug pipeline</td></tr>
      <tr><td class="stack-category">Fallback nuclear</td><td>Dernier recours TMDB — plateforme seule, genres/note levés</td></tr>
      <tr><td class="stack-category">TNR</td><td>Tests de Non-Régression — 131 tests unitaires juin 2026</td></tr>
    </tbody>
  </table>
</section>

<section class="page-break">
  <h2>16. FAQ moteur</h2>

  <h3>Pourquoi seulement 1 film parfois ?</h3>
  <p>Contraints trop strictes combinées : plateforme rare (ex. Canal+ seul), genres voix étroits, excludeIds volumineux (utilisateur actif), cascade niveau 3 insuffisante. Le filet sécurité edge et le backfill client tentent d'atteindre 3 — si 1 seul persiste, vérifier debug fallbackTrace et sqlCandidatesCount.</p>

  <h3>Pourquoi une cascade SQL et pas un seul filtre ?</h3>
  <p>Un filtre unique strict produirait souvent zéro résultat (profils exigeants, plateformes limitées). La cascade préserve la qualité quand possible (niveau 0) et dégrade gracieusement (niveaux 1–3) avant d'en appeler aux fallbacks TMDB. La plateforme reste non négociable à tous les niveaux.</p>

  <h3>Pourquoi reason vide (null) ?</h3>
  <p>Gemini n'a pas répondu ou le JSON est partiel. Le fallback déterministe sélectionne par score composite sans générer de raison. L'UI peut conserver un teaser antérieur ; movie-match compense via whyItMatches. Vérifier llmSelections et fallbackTriggered.</p>

  <h3>Pourquoi le score affiché diffère du Sim% debug ?</h3>
  <p>Trois échelles distinctes (chapitre 8). Le badge UI montre max(SP≥60, MM), pas Sim%. C'est voulu — le contexte du soir prime sur la similarité brute.</p>

  <h3>Pourquoi movie-match prend-il autant de temps ?</h3>
  <p>Appels séquentiels (3× Gemini). Optimisation parallèle planifiée. L'UI n'attend pas — flip cards visibles dès le LLM.</p>

  <h3>Le wizard et l'accueil utilisent-ils le même moteur ?</h3>
  <p>Oui — même edge function surprise-personalized. Différences : collecte contexte (explicite vs mémorisé), debug activé sur accueil seulement, UI résultats (ResultScreen vs Overlay).</p>

  <h3>Comment tester sans API live ?</h3>
  <p>npm run test:unit — 131 tests dont 70 pipeline, fixtures JSON, zéro réseau. E2E pipeline.spec.ts mocke les edge functions.</p>

  <div class="callout callout-info">
    <strong>ℹ Aller plus loin</strong>
    <p>Documentation pipeline détaillée (diagrammes Mermaid, mapping debug complet) · Backlog TNR phases 1–3 · Smoke tests § 3.2 pour validation manuelle post-deploy.</p>
  </div>
</section>

<section class="page-break" style="text-align:center;padding-top:60mm">
  <div style="font-size:36pt;margin-bottom:10mm">🎯</div>
  <h2 style="border:none">Fin du Tome 2</h2>
  <p style="text-align:center;max-width:120mm;margin:5mm auto">Moteur de recommandation</p>
  <p style="text-align:center;font-size:9pt;color:#5c5780;margin-top:15mm">
    Pick Your Spotlight — Engineering Handbook<br/>
    Version 1.0 — Juin 2026<br/><br/>
    Tome 1 : Vision, Architecture &amp; Principes<br/>
    Tome 3 (à venir) : Pick Together, Soirées &amp; Social
  </p>
</section>
`;
