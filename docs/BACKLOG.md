# Backlog Pick — suivi équipe

> **Référence unique** pour prioriser, assigner et suivre l'avancement alpha → beta.  
> Dernière mise à jour : **24 juin 2026** (session Claude Code terminée · file Cursor recalibrée)

---

## TNR & smoke — état et lancement

> Guides : **[SMOKE_TESTS.md](SMOKE_TESTS.md)** · **[RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md)** (moteur reco)

### Ce qui existe aujourd'hui


| Couche            | Outil                                | Fichiers                                                              | État local (24/06)                         |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------ |
| **TNR unitaires** | Vitest                               | `event-reveal`, `recommendation-non-regression`, `movie-interactions`, `tonight-poster-wall`, `onboarding-initiation` | **60/60 OK**                               |
| **Smoke rapide**  | build + Vitest + Playwright (`auth`) | `npm run test:smoke`                                                  | build + unit OK · E2E si Chromium installé |
| **Smoke complet** | + 5 specs E2E                        | `npm run test:smoke:full`                                             | requiert `.env.test` + Playwright          |
| **CI GitHub**     | Actions sur `main` + PR              | `.github/workflows/ci.yml`                                            | unit + tsc sur PR · E2E sur push `main` · lockfile sync `f46ea156` |


**E2E Playwright (33 scénarios)** : `auth`, `navigation`, `pipeline` (+ carrousel affiches), `reveal`, `cinema`, `soirees` (fix sélecteur `3295ae55`), `onboarding` (smoke 3/3) — mocks edge functions pour pipeline/révéler.

**Non automatisé** : onboarding complet (films/acteurs/réalisateurs), duo/invite, TMDB proxy prod, création soirée bout-en-bout.

**Gap audit (→ 1.19)** : ~~pas encore de tests unitaires sur `taste-engine.ts` ni `recommendation-batch.ts`~~ ✅ **37 tests** (`taste-engine` 28 · `recommendation-batch` 9) · objectif **70 % couverture `src/lib/`** avant refactor pipeline reco.

**Documentation pipeline** : **[RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md)** — diagramme, étapes, mapping `[PICK-DEBUG]`, quirks (✅ juin 2026).

### TNR pipeline reco — feuille de route (3 phases)

> Référence technique : **[RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md)**

| Phase | Périmètre | Livrables | Dépendances |
| ----- | --------- | --------- | ----------- |
| **1 — Unitaires** | `taste-engine.ts` (**1.19**) · helpers `recommendation-batch.ts` (`extractRecommendationMovies`, `normalizeRecommendationTexts`, fusion scores) · fonctions pures SP si extractibles (`compositeScore`, parsing LLM) | `taste-engine.test.ts` · `recommendation-batch.test.ts` · objectif 70 % `src/lib/` | Aucune — **priorité Cursor #1** |
| **2 — Intégration** | Mocks réponses edge (`surprise-personalized`, `movie-match`) · niveau cascade SQL attendu · `reason` non-null sur sélections LLM réussies · invariant exclusions (étendre `recommendation-non-regression`) | Tests Vitest avec fixtures JSON · pas de réseau | Phase 1 |
| **3 — E2E** | `pipeline.spec.ts` — mocks alignés sur le vrai shape SP (`{ movies, debugData }`) · smoke post-deploy checklist § [SMOKE_TESTS.md](SMOKE_TESTS.md) 3.2 | E2E stable · campagne manuelle documentée | Phase 2 · Playwright + `.env.test` |

**Quick win debug** : **1.23** — ~~renommer `debugData.top20` → `top50`, `sql50` → `sqlCandidates`, corriger libellés `[PICK-DEBUG]` et `platformFallbackTriggered`~~ **`done`** (juin 2026).

### Lancer les premiers TNR (ordre recommandé)

**Étape 0 — une fois par machine**

```powershell
cd pick-your-spotlight
npm ci
npx playwright install chromium
.\scripts\check-playwright.ps1   # [READY] E2E prêt : OUI
```

**Étape 1 — TNR unitaires (sans réseau, ~10 s)**

```powershell
npm run test:unit
```

Couvre : file sessionStorage « Révéler », exclusion films déjà vus, états feedback/watchlist.

**Étape 2 — Smoke minimal (sans compte test, ~2 min)**

```powershell
npm run test:smoke
```

Couvre : `vite build` + `event-reveal` + garde routes `/app/*` → auth (4 tests publics).

**Étape 3 — Smoke E2E complet (avec compte test, ~5–10 min)**

```powershell
cp .env.test.example .env.test
# Renseigner E2E_TEST_EMAIL / E2E_TEST_PASSWORD (ex. testpick@gmail.com)
# Créer le compte si besoin : node scripts/create-test-user.mjs

npm run test:smoke:full
# ou : .\scripts\smoke-test.ps1 -Full
```

**Étape 4 — Checklist manuelle Sprint A** (§ [Checklist smoke test](#checklist-smoke-test-03)) — onboarding, soirée + invite, edge functions prod.

### Prérequis CI (secrets GitHub)


| Secret              | Usage                     |
| ------------------- | ------------------------- |
| `E2E_TEST_EMAIL`    | Login E2E sur push `main` |
| `E2E_TEST_PASSWORD` | Idem                      |


Sans secrets → job E2E CI exécute les tests mais **skip** la majorité (guard `E2E_TEST_EMAIL`).

### Migrations Supabase (onboarding — manuel prod)

Exécuter dans Supabase SQL Editor (idempotent) :

`supabase/migrations/20260622180000_onboarding_migrations_verify.sql`

Inclut : `onboarding_step`, `onboarding_paused`, films (`progress`, `liked_ids`, `proposed_ids`), personnes (`actors_*`, `directors_*`).

---

## Comment utiliser ce fichier

1. **Prendre un sujet** : choisir la première tâche `todo` du [Sprint actif](#sprint-actif) ou de la [file Cursor](#file-dattente-cursor-recalibrée--24-juin).
2. **La réserver** : passer le statut à `in_progress`, renseigner **Mode** / **Owner** et la date dans [Journal](#journal-des-mises-à-jour).
3. **La terminer** : statut `done`, cocher la case, noter la PR ou le commit en **Notes**.
4. **Bloquer** : statut `blocked` + explication en Notes.

### Statuts


| Statut        | Signification                         |
| ------------- | ------------------------------------- |
| `todo`        | Pas commencé                          |
| `in_progress` | Quelqu'un travaille dessus            |
| `blocked`     | En attente d'une dépendance externe   |
| `done`        | Terminé et vérifié                    |
| `cancelled`   | Plus pertinent / reporté indéfiniment |


### Priorités


| Niveau | Quand s'en occuper              |
| ------ | ------------------------------- |
| **P0** | Maintenant — bloquant technique |
| **P1** | Beta fermée (10–30 testeurs)    |
| **P2** | Avant ouverture publique        |
| **P3** | Dette / plus tard               |


### Effort (indicatif)

`S` < 1 j · `M` 1–3 j · `L` 1–2 sem · `XL` > 2 sem

### Mode d'exécution


| Mode            | Signification                                              |
| --------------- | ---------------------------------------------------------- |
| **Claude ✅**   | Traitée en session Claude Code (24 juin 2026)              |
| **Cursor**      | Prochaine file d'attente IDE Cursor                        |
| **Pair humain** | Découpe sensible — revue humaine, PR par étapes            |

---

## Session Claude Code — 24 juin 2026 (terminé ✅)

> Travail livré en commits locaux (`87416704` → `e73e3e8e`). Extraction plateformes Cursor = **redondante** — fusionnée par Claude (#3).

| Audit | Sujet                         | Résultat                                                                 | ID     |
| ----- | ----------------------------- | ------------------------------------------------------------------------ | ------ |
| #2    | `console.log` en prod         | 5 lignes `main.tsx` neutralisent **218** appels (no-op prod)           | 1.17   |
| #3    | Plateformes dupliquées        | `platforms.ts` source unique · **−80 lignes** `HomeScreen`               | 1.18   |
| #7    | Cache profil localStorage     | Greeting instantané via clé `pys_greeting`                               | 1.21   |
| #8    | Erreurs pipeline silencieuses | `toast.error` différencié rate-limit / réseau                          | 1.4    |
| #10   | Validation localStorage       | Déjà protégé côté code — rien à faire                                    | 1.22   |

**HomeScreen** : pas de gros refactor pour l'instant — cartographie hooks faite (candidats A/B/C ci-dessous), petits diffs uniquement.

---

## File d'attente Cursor (recalibrée · 24 juin)

> Ordre strict — **1.19 avant** tout changement pipeline / hooks HomeScreen profonds.

| #   | Audit | ID   | Tâche                                              | Mode          | Statut | Notes                                                                 |
| --- | ----- | ---- | -------------------------------------------------- | ------------- | ------ | --------------------------------------------------------------------- |
| 1   | #4    | 1.19 | Tests unitaires `taste-engine.ts` (+ batch)        | Cursor        | `done` | 37 tests · 97 total `test:unit` · [TNR pipeline](#tnr-pipeline-reco--feuille-de-route-3-phases) phase 1 |
| 1b  | —     | 1.23 | Métriques debug pipeline (`top50`, libellés PICK-DEBUG) | Cursor   | `done` | Quick win · [RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md) quirks |
| 2   | #5    | 2.11 | `aria-label` boutons icon-only                       | Cursor        | `todo` | Complète **2.9** a11y                                                 |
| 3   | #1    | 2.5  | Hooks `HomeScreen` — **reporté**                     | Cursor        | `todo` | Rationalisation seule · cartographie A/B/C faite · pas de gros diff   |
| 4   | #6    | 1.20 | `TonightPickContext`                               | Pair humain   | `todo` | PR par étapes · après **1.19** si touch pipeline                      |
| 5   | #9    | 2.10 | Split `ResultScreen` + `TonightPickOverlay`        | Cursor        | `todo` | Sprint Tech 3 · >1000 l. chacun                                       |

### Cartographie hooks `HomeScreen` (2.5 — candidats A/B/C)

| Candidat | Hook proposé               | Périmètre                                      | Risque refactor |
| -------- | -------------------------- | ---------------------------------------------- | --------------- |
| **A**    | `useProfileLoader`         | Profil, greeting, cache `pys_greeting`         | Faible · **1.21** adresse le cache |
| **B**    | `useRecommendationEngine`  | Pipeline `generateTonightPick`, états reco     | Élevé · bloqué sans **1.19** |
| **C**    | `useTonightMovieState`     | État soirée / overlay / film du soir           | Moyen · couplé **1.20** |

---

## Sprint actif — **A** (clôture alpha)

**Sprint A — « Ça marche chez nous »** · alpha interne · semaine du 22 juin 2026

**Hors scope** : ~~0.1~~ secret TMDB → **1.16** (avant beta testeurs externes)

### Objectif

Valider que l'app alpha est utilisable de bout en bout : smoke tests OK, edge functions alignées avec le code si besoin, README install.

### File d'attente (dans l'ordre)


| #   | ID   | Tâche                   | Statut        | Action                                                                                                         |
| --- | ---- | ----------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | 0.4  | `.env` hors Git         | `done`        | —                                                                                                              |
| 2   | 0.3  | Smoke tests             | `in_progress` | TNR unit OK · smoke auto partiel · checklist manuelle restante → [TNR & smoke](#tnr--smoke--état-et-lancement) |
| 3   | 0.2  | Déployer edge functions | `todo`        | Seulement si prod ≠ code local · `deploy-edge-functions.ps1`                                                   |
| 4   | 1.11 | README projet           | `todo`        | Install, `.env`, commandes dev/test                                                                            |


### Definition of done — Sprint A

- [x] `npm run build` OK
- [ ] `npm run test:smoke` OK (build + unit OK · E2E = `npx playwright install chromium`)
- [ ] Checklist manuelle 0.3 cochée (au moins une passe équipe)
- [ ] README à jour (1.11)

---

## Prochain sprint — **B** (produit) + **Tech 1** (audit)

> **Ordre recommandé** : clôturer Sprint A (0.3, 1.11) **puis** enchaîner Sprint B produit. Le **Sprint Tech 1** peut démarrer en parallèle limité dès que A est stable (pas de gros refactor reco sans **1.19**).

### Sprint B — « Testeurs heureux » (produit · beta fermée)


| #   | ID   | Tâche                                                            | Effort | Statut | Notes                                      |
| --- | ---- | ---------------------------------------------------------------- | ------ | ------ | ------------------------------------------ |
| 1   | 1.3  | Marquer « Bientôt » (Duo, options soirée)                        | S      | `todo` | `DuoPage`, `CreateEventPage`               |
| 2   | 1.16 | Secret `TMDB_API_KEY` Supabase + rotation (**2.2**)              | S      | `todo` | **Avant** ouverture beta testeurs externes |
| 3   | 1.6  | Soirées bout-en-bout (création → invite → révélation)            | L      | `in_progress` | Seed compte E2E · `soirees` / `reveal` |
| 4   | 1.5  | Rappeler / forcer onboarding incomplet                           | M      | `in_progress` | Parcours 8 étapes · E2E films/acteurs manquant |
| 5   | 1.10 | E2E onboarding initiatique (films, acteurs, réalisateurs)        | M      | `in_progress` | Smoke 3/3 OK · reste parcours complet      |


### Sprint Tech 1 — « Fondations code » (audit juin 2026)

| #   | ID   | Tâche (audit)                                      | Effort | Mode     | Statut | Notes                                              |
| --- | ---- | -------------------------------------------------- | ------ | -------- | ------ | -------------------------------------------------- |
| 1   | 1.17 | Logger / neutralisation `console.log` prod         | S      | Claude ✅ | `done` | `main.tsx` no-op prod · 218 appels · `87416704`    |
| 2   | 1.18 | Centraliser logique plateformes (`platforms.ts`)   | M      | Claude ✅ | `done` | Source unique · −80 l. HomeScreen · `737c0617`     |
| 3   | 1.19 | Tests unitaires `taste-engine` (+ batch)           | L      | Cursor   | `done` | 28 + 9 tests · `test:unit` = 97 · juin 2026 |
| 4   | 2.11 | `aria-label` boutons icon-only                     | M      | Cursor   | `todo` | File Cursor #2                                     |
| 5   | 2.5  | Hooks `HomeScreen` (~2700 l.)                      | L      | Cursor   | `todo` | **Reporté** · candidats A/B/C · petits diffs seulement |


**Règle audit** : ne pas refactorer le pipeline reco (hooks HomeScreen profonds, splits overlay) **sans** tests **1.19** en place. Pas de gros refactor `HomeScreen` — analyse faite, diffs ciblés uniquement.

### Sprints suivants (planifiés)


| Sprint    | Thème              | Tâches clés                                              |
| --------- | ------------------ | -------------------------------------------------------- |
| B         | Testeurs heureux   | 1.3–1.6, **1.16**, seed compte E2E, **1.10**             |
| Tech 2    | Qualité & perf     | **1.19** tests lib · **1.20** context (pair) · ~~**1.4**~~ · ~~**1.21**~~ |
| C         | Social fiable      | 1.7–1.8, 1.12–1.13, **1.10b**                            |
| Tech 3    | Découpe & a11y     | **2.10** splits · **2.11** aria-labels · ~~**1.22**~~ (N/A) |


> **En parallèle alpha** (hors clôture Sprint A) : **1.6** soirées, correctifs UX — déjà **1.14** / **1.15** faits.

---

## Audit technique (juin 2026)

> Synthèse audit Claude Code · croisée avec le backlog existant. Les IDs backlog priment ; la colonne **Audit** est la référence d'origine. Voir aussi [Session Claude Code](#session-claude-code--24-juin-2026-terminé-) et [File d'attente Cursor](#file-dattente-cursor-recalibrée--24-juin).

### 🔴 Critique


| Audit | ID backlog | Tâche                                                                 | Effort | Mode     | Statut | Notes                                                                 |
| ----- | ---------- | --------------------------------------------------------------------- | ------ | -------- | ------ | --------------------------------------------------------------------- |
| #1    | **2.5**    | `HomeScreen.tsx` (~2700 l.) → hooks A/B/C (voir cartographie)         | L      | Cursor   | `todo` | **Reporté** · pas de gros refactor · rationalisation seule            |
| #2    | **1.17**   | 50+ `console.log` en prod → no-op `main.tsx`                          | S      | Claude ✅ | `done` | 218 appels neutralisés · `87416704`                                   |
| #3    | **1.18**   | Logique plateformes dupliquée 4× → `platforms.ts`                     | M      | Claude ✅ | `done` | −80 l. HomeScreen · extraction Cursor = redondante                    |
| #4    | **1.19**   | Tests unitaires `taste-engine.ts`, `recommendation-batch.ts`          | L      | Cursor   | `done` | 37 tests · 97 `test:unit` · [RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md) |
| #4b   | **1.23**   | Métriques debug pipeline (noms `top50`/`sqlCandidates`, libellés console) | S  | Cursor   | `done` | Quick win · quirks [RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md) |
| #5    | **2.11**   | `aria-label` sur boutons icônes (sans texte visible)                  | M      | Cursor   | `todo` | Priorité Cursor #2 · complète **2.9** a11y                            |


### 🟠 Important


| Audit | ID backlog | Tâche                                              | Effort | Mode        | Statut | Notes                                                                 |
| ----- | ---------- | -------------------------------------------------- | ------ | ----------- | ------ | --------------------------------------------------------------------- |
| #6    | **1.20**   | `TonightPickOverlay` (~30 props) → `TonightPickContext` | M      | Pair humain | `todo` | Cursor #4 · PR par étapes · après **1.19** si touch pipeline        |
| #7    | **1.21**   | Cache profil `localStorage` (TTL, invalidation)    | S      | Claude ✅   | `done` | `pys_greeting` · greeting instantané · `737c0617`                     |
| #8    | **1.4**    | Erreurs pipeline reco : toast + retry              | S–M    | Claude ✅   | `done` | Rate-limit / réseau · `e73e3e8e`                                      |
| #9    | **2.10**   | Découper `ResultScreen` + `TonightPickOverlay`     | L      | Cursor      | `todo` | Cursor #5 · complète **3.2**                                        |
| #10   | **1.22**   | Validation `localStorage` (schémas zod)            | S      | Claude ✅   | `done` | Déjà protégé — rien à faire                                           |


### 🟡 Backlog / dette (P3)


| Sujet audit              | ID backlog | Notes                                      |
| ------------------------ | ---------- | ------------------------------------------ |
| Réduire types `any`      | **3.7**    | Fichiers lib + composants pick             |
| `React.memo` composants lourds | **3.8** | Après splits **2.10**                      |
| Skeleton loaders         | **3.9**    | Reco, biblio, profil                       |
| Regénérer types Supabase | **3.10**   | `supabase gen types typescript`            |
| Preload batch affiches TMDB | **3.11** | Mur d'affiches, carrousel                  |
| Rotation clé API TMDB    | **2.2** / **1.16** | Déjà backlog · avant beta testeurs   |

---

## P0 — Sprint A (alpha)


| ID  | Tâche                                   | Effort | Statut        | Owner | Notes                                                               |
| --- | --------------------------------------- | ------ | ------------- | ----- | ------------------------------------------------------------------- |
| 0.2 | Redéployer les edge functions modifiées | S      | `todo`        | —     | `scripts/deploy-edge-functions.ps1` — si prod diverge du repo       |
| 0.3 | Smoke test manuel + automatisé          | S      | `in_progress` | —     | Guide : `docs/SMOKE_TESTS.md` · `npm run test:smoke`                |
| 0.4 | `.env` hors Git + `.env.example`        | S      | `done`        | —     | `.env` retiré du suivi Git ; `.gitignore` + `.env.example` en place |


### Checklist smoke test (0.3)

> Détail pas-à-pas, matrice E2E et dépannage : **[docs/SMOKE_TESTS.md](SMOKE_TESTS.md)**

**Automatisé (sans compte test)** : `npm run test:smoke`  
**Complet (avec `.env.test`)** : `npm run test:smoke:full` ou `.\scripts\smoke-test.ps1 -Full`

- [ ] Connexion / onboarding
- [ ] Reco complète depuis `/app` (wizard → résultats)
- [ ] Fiche film (flip card / détail TMDB via proxy)
- [ ] Ajout watchlist + consultation `/app/my-cinema`
- [ ] Création soirée + lien d'invitation
- [ ] **Révéler** soirée sans flash accueil + film enregistré
- [ ] Edge functions prod (`tmdb-proxy`, `surprise-personalized`) sans 500

### Commandes Sprint A (référence)

```powershell
cd pick-your-spotlight
npm ci
npx playwright install chromium          # une fois par machine

npm run test:unit                        # TNR rapides (60 tests)
npm run test:smoke                       # build + unit + auth E2E public
# npm run test:smoke:full                # + pipeline, reveal, cinema, soirees (nécessite .env.test)

npx supabase login
npx supabase link --project-ref lrjhpflvkrebbngfnaif
.\scripts\deploy-edge-functions.ps1      # optionnel en alpha si prod déjà à jour
npm run dev                              # puis checklist manuelle (SMOKE_TESTS.md)
```

> Secret `TMDB_API_KEY` : **pas requis en alpha** — traiter avant l'ouverture aux beta testeurs (**1.16**).

---

## P1 — Beta fermée confortable

### Produit & UX


| ID  | Tâche                                                           | Effort | Statut        | Owner | Notes                                                                                 |
| --- | --------------------------------------------------------------- | ------ | ------------- | ----- | ------------------------------------------------------------------------------------- |
| 1.1 | Clarifier Pick+ dans l'UI (alpha = gratuit)                     | S      | `done`        | —     | `isPremium = true` temporaire dans `use-pick-plus.ts`                                 |
| 1.2 | Assouplir limites freemium en alpha                             | S      | `done`        | —     | Idem — paywall « Bientôt » encore visible sur `/app/pick-plus`                        |
| 1.3 | Marquer explicitement « Bientôt » (groupes Duo, options soirée) | S      | `todo`        | —     | `DuoPage`, `CreateEventPage`, `HomeScreenChoiceModal`                                 |
| 1.4 | Messages d'erreur clairs si TMDB / edge function down           | M      | `done`        | Claude ✅ | Audit #8 · toast rate-limit / réseau · `e73e3e8e`                                   |
| 1.5 | Rappeler / forcer onboarding incomplet                          | M      | `in_progress` | —     | Parcours initiatique refondu (8 étapes) · redirect partiel depuis `/app` · E2E absent |


### Soirées & social


| ID   | Tâche                                                            | Effort | Statut        | Owner | Notes                                                                                 |
| ---- | ---------------------------------------------------------------- | ------ | ------------- | ----- | ------------------------------------------------------------------------------------- |
| 1.6  | Stabiliser soirées bout-en-bout (création → invite → révélation) | L      | `in_progress` | —     | E2E `soirees.spec.ts`, `reveal.spec.ts` · **seed soirée non révélée** sur compte test |
| 1.14 | Révéler sans flash accueil (overlay instantané)                  | S      | `done`        | —     | 22/06 — `TonightPickOverlay`, `Index`, `HomeScreen`                                   |
| 1.15 | Intent soirée complet (genres, mood, mediaType → pipeline)       | S      | `done`        | —     | 22/06 — `RevealIntent`, `EventDetailPage`, `runRevealPipeline`                        |
| 1.7  | Documenter + tester flow Duo                                     | M      | `todo`        | —     | `/app/duo`, `/join-duo/:code`                                                         |
| 1.8  | Vérifier notifications (ami, soirée, duo)                        | M      | `todo`        | —     | `lib/notifications.ts`                                                                |


### Qualité code (audit)


| ID    | Tâche                                                      | Effort | Statut | Mode      | Notes                                                                                                   |
| ----- | ---------------------------------------------------------- | ------ | ------ | --------- | ------------------------------------------------------------------------------------------------------- |
| 1.17  | Neutralisation `console.log` prod (`main.tsx`)             | S      | `done` | Claude ✅ | Audit #2 · 218 appels · `87416704`                                                                      |
| 1.18  | Centraliser plateformes (`platforms.ts`)                   | M      | `done` | Claude ✅ | Audit #3 · −80 l. HomeScreen · extraction Cursor redondante · `737c0617`                                |
| 1.19  | Tests unitaires `taste-engine` + `recommendation-batch`    | L      | `done` | Cursor    | 28 + 9 tests · 97 total · juin 2026 |
| 1.23  | Métriques debug pipeline (`top50`, `sqlCandidates`, libellés) | S   | `done` | Cursor    | Quick win · quirks pipeline doc |
| 1.20  | `TonightPickContext` (réduire props overlay)               | M      | `todo` | Pair humain | Audit #6 · Cursor #4 · PR par étapes · après **1.19**                                                 |
| 1.21  | Cache profil `localStorage` (`pys_greeting`)               | S      | `done` | Claude ✅ | Audit #7 · greeting instantané · `737c0617`                                                             |
| 1.22  | Validation `localStorage` (zod)                            | S      | `done` | Claude ✅ | Audit #10 · déjà protégé — N/A                                                                            |


### Qualité & docs


| ID    | Tâche                                                      | Effort | Statut | Owner | Notes                                                                                                   |
| ----- | ---------------------------------------------------------- | ------ | ------ | ----- | ------------------------------------------------------------------------------------------------------- |
| 1.16  | Secret `TMDB_API_KEY` Supabase + rotation clé projet       | S      | `todo` | —     | **Avant beta testeurs externes** — `npx supabase secrets set TMDB_API_KEY=...` · lien **2.2**           |
| 1.9   | CI GitHub Actions : Vitest + tsc + E2E Playwright          | M      | `done` | —     | `.github/workflows/ci.yml` · unit + lint sur PR · E2E sur push `main` · secrets `E2E_TEST_*` à vérifier |
| 1.10  | E2E Playwright — onboarding initiatique                    | M      | `in_progress` | —     | Smoke `onboarding.spec.ts` **3/3 OK** · reste films (10 likes), acteurs, réalisateurs |
| 1.10b | E2E Playwright — création soirée complète                  | M      | `todo` | —     | Wizard 3 étapes + invite · complète `soirees.spec.ts`                                                   |
| 1.11  | README projet (install, `.env`, secrets Supabase)          | S      | `todo` | —     | Remplacer template Lovable · clôture Sprint A                                                           |
| 1.24  | Doc pipeline reco (`RECOMMENDATION_PIPELINE.md`)           | S      | `done` | Cursor    | Diagramme · étapes · PICK-DEBUG · TNR 3 phases · juin 2026                                              |
| 1.12  | Retirer `ADMIN_EMAILS` du client → rôle serveur uniquement | S      | `todo` | —     | `hooks/use-admin.ts`                                                                                    |
| 1.13  | Restreindre `find-user-by-email` (amis + rate limit)       | M      | `todo` | —     | Edge function                                                                                           |


### Tests — état connu


| Suite                                   | Tests | Statut                      | Inclus smoke ?                     |
| --------------------------------------- | ----- | --------------------------- | ---------------------------------- |
| `event-reveal.test.ts`                  | 11    | ✅                           | Oui (`test:smoke`)                 |
| `tonight-poster-wall.test.ts`           | 13    | ✅                           | Non (via `test:unit`)              |
| `onboarding-initiation.test.ts`         | 15    | ✅                           | Non (via `test:unit`)              |
| `recommendation-non-regression.test.ts` | 12    | ✅                           | Non (via `test:unit`)              |
| `movie-interactions.test.tsx`           | 9     | ✅                           | Non (via `test:unit`)              |
| `taste-engine.test.ts`                  | 28    | ✅                           | Non (via `test:unit`)              |
| `recommendation-batch.test.ts`          | 9     | ✅                           | Non (via `test:unit`)              |
| E2E Playwright                          | 33    | ⚠️ credentials + Playwright | Partiel (`test:smoke` = 4 publics) |


**Dette** : `reveal.spec.ts` / `soirees.spec.ts` skip souvent si compte test sans soirée adaptée → tâche seed (1.6).

## P2 — Avant beta publique


| ID   | Tâche                                                 | Effort | Statut | Owner | Notes                                                 |
| ---- | ----------------------------------------------------- | ------ | ------ | ----- | ----------------------------------------------------- |
| 2.1  | Pick+ : Stripe **ou** gratuit prolongé explicite      | L      | `todo` | —     | Gating codé, paiement absent                          |
| 2.2  | Rotation / compte TMDB « projet »                     | S      | `todo` | —     | Couplé à **1.16** — avant beta testeurs, pas en alpha |
| 2.3  | Attribution TMDB (logo + mention légale)              | S      | `todo` | —     | Obligatoire TMDB en prod                              |
| 2.4  | Pick Together groupe : finaliser ou retirer de la nav | L      | `todo` | —     | `/app/pick-together` → redirect `/app`                |
| 2.5  | Refactor `HomeScreen.tsx` — extraction hooks (A/B/C)      | L      | `todo` | Cursor    | Audit #1 · **reporté** · cartographie faite · pas de gros refactor                                      |
| 2.6  | Monitoring erreurs (Sentry ou équivalent)             | M      | `todo` | —         | Edge + frontend                                                                                         |
| 2.7  | CGU + politique de confidentialité                    | M      | `todo` | —         | Comptes réels                                                                                           |
| 2.8  | Perf reco : timeouts UX, métriques `engineMeta`       | M      | `todo` | —         | `surprise-personalized`                                                                                 |
| 2.9  | Accessibilité mobile (safe areas, voix)               | M      | `todo` | —         | Complété par **2.11** (aria-labels)                                                                     |
| 2.10 | Découper `ResultScreen` + `TonightPickOverlay`        | L      | `todo` | Cursor    | Audit #9 · Cursor #5 · >1000 l. chacun · Sprint Tech 3                                                  |
| 2.11 | `aria-label` boutons icônes                           | M      | `todo` | Cursor    | Audit #5 · **priorité Cursor #2** · Sprint Tech 1                                                       |


---

## P3 — Plus tard / dette


| ID   | Tâche                                           | Statut | Notes                        |
| ---- | ----------------------------------------------- | ------ | ---------------------------- |
| 3.1  | Groupes Duo (au-delà du duo à 2)                | `todo` | UI « Bientôt » déjà présente |
| 3.2  | Découper `Profile.tsx`, `surprise-personalized` | `todo` | Complété par **2.10**        |
| 3.3  | Un seul lockfile (npm vs bun)                   | `todo` |                              |
| 3.4  | Choisir une licence                             | `todo` |                              |
| 3.5  | Internationalisation (au-delà du FR)            | `todo` |                              |
| 3.6  | Purge historique Git si passage en public       | `todo` | Si secrets ont été commités  |
| 3.7  | Réduire types `any` (lib + pick)                | `todo` | Audit backlog                |
| 3.8  | `React.memo` composants lourds                  | `todo` | Après **2.10**               |
| 3.9  | Skeleton loaders (reco, biblio, profil)         | `todo` | Audit backlog                |
| 3.10 | Regénérer types Supabase (`gen types`)          | `todo` | Audit backlog                |
| 3.11 | Preload batch affiches TMDB                     | `todo` | Mur d'affiches, carrousel    |


---

## Carte des fonctionnalités (référence rapide)


| Zone                   | Maturité      | Routes / fichiers clés                                                  |
| ---------------------- | ------------- | ----------------------------------------------------------------------- |
| Onboarding initiatique | Alpha avancée | `/onboarding`, `OnboardingFilmTrainer`, migrations `onboarding_films_*` |
| Reco personnalisée     | Alpha avancée | `/app`, `surprise-personalized`, `HomeScreen` · doc [RECOMMENDATION_PIPELINE.md](RECOMMENDATION_PIPELINE.md) |
| Profil & bibliothèque  | Beta          | `/app/profile`, `/app/my-cinema`, `taste-engine.ts`                     |
| Soirées                | Beta          | `/app/soirees`, `CreateEventPage`, `EventDetailPage`                    |
| Duo                    | Beta          | `/app/duo`, `duo-profiles.ts`                                           |
| Pick Together          | Alpha         | `/app/pick-together-group`                                              |
| Pick+                  | Coquille UI   | `use-pick-plus.ts`, `PickPlusPaywall`                                   |
| Admin                  | Interne       | `/admin`                                                                |
| Match photo/voix       | Beta          | `/app/match`, `identify-film`                                           |


---

## Journal des mises à jour


| Date       | Qui    | Changement                                                                                                                                              |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-24 | Cursor | `RECOMMENDATION_PIPELINE.md` · TNR pipeline 3 phases · **1.24** `done` · **1.23** métriques debug |
| 2026-06-24 | Cursor | Recap session Claude (#2 #3 #7 #8 #10 `done`) · file Cursor recalibrée (#4 → #5 → #1 reporté → #6 pair → #9) · colonne **Mode** · candidats hooks A/B/C · note « pas de gros refactor HomeScreen » |
| 2026-06-24 | —      | TNR : 60 tests unit OK · CI lockfile `f46ea156` · E2E `soirees` fix `3295ae55` · commits locaux à fusionner si diverge (lockfile, soirees, backlog `3268db9b` + travail Claude `87416704`–`e73e3e8e`) |
| 2026-06-24 | Claude | Session audit : **1.17** no-op prod · **1.18** `platforms.ts` · **1.21** `pys_greeting` · **1.4** toast pipeline · **1.22** N/A (déjà protégé)        |
| 2026-06-24 | —      | Intégration audit technique Claude Code : IDs **1.17–1.22**, **2.10–2.11**, **3.7–3.11** · sprints Tech 1–3 · section [Prochain sprint](#prochain-sprint--b-produit--tech-1-audit) |
| 2026-06-22 | —   | Audit TNR : 60 tests Vitest OK · CI documentée (1.9 `done`) · section [TNR & smoke](#tnr--smoke--état-et-lancement) · 1.10 scindé (onboarding / soirée) |
| 2026-06-22 | —   | Refonte onboarding initiatique poussée sur `main` (films, acteurs, pools élargis, migrations SQL)                                                       |
| 2026-06-22 | —   | Sprint A recentré : 0.3 → 0.2 → 1.11 · 0.1 hors scope alpha                                                                                             |
| 2026-06-22 | —   | Création backlog + audit fonctionnel                                                                                                                    |
| 2026-06-22 | —   | Correctifs sécurité P0 (TMDB proxy, edge functions, debugData, `.env`)                                                                                  |
| 2026-06-22 | —   | 0.4 `done` — `.env` retiré du suivi Git                                                                                                                 |
| 2026-06-22 | —   | Script `scripts/deploy-edge-functions.ps1` ajouté                                                                                                       |


---

## Prochaine action recommandée

### Immédiat — clôturer Sprint A

1. **TNR unit** — `npm run test:unit` (60 tests, ~10 s)
2. **Smoke auto** — `npx playwright install chromium` puis `npm run test:smoke`
3. **0.3 manuel** — checklist §3 ([SMOKE_TESTS.md](SMOKE_TESTS.md)), dont onboarding initiatique
4. **0.2** — Déployer edge functions + migrations onboarding si prod ≠ repo
5. **1.11** — README install + commandes dev/test

### Ensuite — Sprint B (produit)

1. **1.16** — Secret TMDB avant tout testeur externe
2. **1.6** — Seed compte E2E + soirées stables
3. **1.10** — E2E onboarding complet (films, acteurs, réalisateurs)

### File Cursor (priorité technique)

1. ~~**1.23** — Métriques debug pipeline (`S`) — quick win libellés `[PICK-DEBUG]`~~ **`done`**
2. **2.11** — `aria-label` boutons icon-only (`M`)
3. **2.5** — Hooks HomeScreen — **reporté** · candidats A/B/C cartographiés · petits diffs seulement
4. **1.20** — `TonightPickContext` — **pair humain** · PR par étapes
5. **2.10** — Split `ResultScreen` + `TonightPickOverlay` (`L`)

*Secret TMDB : **1.16**, uniquement avant beta testeurs.*  
*Refactor pipeline reco : **1.19** tests lib = `done` ✅ — hooks HomeScreen profonds débloqués.*  
*Sprint Tech 1 Claude : **1.17**, **1.18**, **1.21**, **1.4**, **1.22** = `done` ✅*
