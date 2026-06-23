# Backlog Pick — suivi équipe

> **Référence unique** pour prioriser, assigner et suivre l'avancement alpha → beta.  
> Dernière mise à jour : **22 juin 2026** (audit TNR + refonte onboarding)

---

## TNR & smoke — état et lancement

> Guide détaillé : **[SMOKE_TESTS.md](SMOKE_TESTS.md)**

### Ce qui existe aujourd'hui


| Couche            | Outil                                | Fichiers                                                              | État local (22/06)                         |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------ |
| **TNR unitaires** | Vitest                               | `event-reveal`, `recommendation-non-regression`, `movie-interactions` | **32/32 OK**                               |
| **Smoke rapide**  | build + Vitest + Playwright (`auth`) | `npm run test:smoke`                                                  | build + unit OK · E2E si Chromium installé |
| **Smoke complet** | + 5 specs E2E                        | `npm run test:smoke:full`                                             | requiert `.env.test` + Playwright          |
| **CI GitHub**     | Actions sur `main` + PR              | `.github/workflows/ci.yml`                                            | unit + tsc sur PR · E2E sur push `main`    |


**E2E Playwright (32 scénarios)** : `auth`, `navigation`, `pipeline`, `reveal`, `cinema`, `soirees`, `onboarding` (smoke 3/3) — mocks edge functions pour pipeline/révéler.

**Non automatisé** : onboarding complet (films/acteurs/réalisateurs), duo/invite, TMDB proxy prod, création soirée bout-en-bout.

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

Inclut : `onboarding_step`, `onboarding_paused`, films (`progress`, `liked_ids`, `proposed_ids`), personnes (`actors_`*, `directors_*`).

---

## Comment utiliser ce fichier

1. **Prendre un sujet** : choisir la première tâche `todo` ou `blocked` du sprint en cours (voir [Sprint actif](#sprint-actif)).
2. **La réserver** : passer le statut à `in_progress`, renseigner **Owner** et la date dans [Journal](#journal-des-mises-à-jour).
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

---

## Sprint actif — **A** (focus équipe)

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

### Sprints suivants (pas maintenant)


| Sprint | Thème            | Tâches                             |
| ------ | ---------------- | ---------------------------------- |
| B      | Testeurs heureux | 1.3–1.6, **1.16**, seed compte E2E |
| C      | Social fiable    | 1.7–1.8, 1.10, 1.12–1.13           |


> **En parallèle alpha** (hors clôture Sprint A) : **1.6** soirées, correctifs UX — déjà **1.14** / **1.15** faits.

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

npm run test:unit                        # TNR rapides (32 tests)
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
| 1.4 | Messages d'erreur clairs si TMDB / edge function down           | M      | `todo`        | —     | `tmdb-proxy-client.ts`, écrans reco                                                   |
| 1.5 | Rappeler / forcer onboarding incomplet                          | M      | `in_progress` | —     | Parcours initiatique refondu (8 étapes) · redirect partiel depuis `/app` · E2E absent |


### Soirées & social


| ID   | Tâche                                                            | Effort | Statut        | Owner | Notes                                                                                 |
| ---- | ---------------------------------------------------------------- | ------ | ------------- | ----- | ------------------------------------------------------------------------------------- |
| 1.6  | Stabiliser soirées bout-en-bout (création → invite → révélation) | L      | `in_progress` | —     | E2E `soirees.spec.ts`, `reveal.spec.ts` · **seed soirée non révélée** sur compte test |
| 1.14 | Révéler sans flash accueil (overlay instantané)                  | S      | `done`        | —     | 22/06 — `TonightPickOverlay`, `Index`, `HomeScreen`                                   |
| 1.15 | Intent soirée complet (genres, mood, mediaType → pipeline)       | S      | `done`        | —     | 22/06 — `RevealIntent`, `EventDetailPage`, `runRevealPipeline`                        |
| 1.7  | Documenter + tester flow Duo                                     | M      | `todo`        | —     | `/app/duo`, `/join-duo/:code`                                                         |
| 1.8  | Vérifier notifications (ami, soirée, duo)                        | M      | `todo`        | —     | `lib/notifications.ts`                                                                |


### Qualité & docs


| ID    | Tâche                                                      | Effort | Statut | Owner | Notes                                                                                                   |
| ----- | ---------------------------------------------------------- | ------ | ------ | ----- | ------------------------------------------------------------------------------------------------------- |
| 1.16  | Secret `TMDB_API_KEY` Supabase + rotation clé projet       | S      | `todo` | —     | **Avant beta testeurs externes** — `npx supabase secrets set TMDB_API_KEY=...` · lien **2.2**           |
| 1.9   | CI GitHub Actions : Vitest + tsc + E2E Playwright          | M      | `done` | —     | `.github/workflows/ci.yml` · unit + lint sur PR · E2E sur push `main` · secrets `E2E_TEST_`* à vérifier |
| 1.10  | E2E Playwright — onboarding initiatique                    | M      | `in_progress` | —     | Smoke `onboarding.spec.ts` **3/3 OK** · reste films (10 likes), acteurs, réalisateurs |
| 1.10b | E2E Playwright — création soirée complète                  | M      | `todo` | —     | Wizard 3 étapes + invite · complète `soirees.spec.ts`                                                   |
| 1.11  | README projet (install, `.env`, secrets Supabase)          | S      | `todo` | —     | Remplacer template Lovable                                                                              |
| 1.12  | Retirer `ADMIN_EMAILS` du client → rôle serveur uniquement | S      | `todo` | —     | `hooks/use-admin.ts`                                                                                    |
| 1.13  | Restreindre `find-user-by-email` (amis + rate limit)       | M      | `todo` | —     | Edge function                                                                                           |


### Tests — état connu


| Suite                                   | Tests | Statut                      | Inclus smoke ?                     |
| --------------------------------------- | ----- | --------------------------- | ---------------------------------- |
| `event-reveal.test.ts`                  | 11    | ✅                           | Oui (`test:smoke`)                 |
| `recommendation-non-regression.test.ts` | 12    | ✅                           | Non (via `test:unit`)              |
| `movie-interactions.test.tsx`           | 9     | ✅                           | Non (via `test:unit`)              |
| E2E Playwright                          | 29    | ⚠️ credentials + Playwright | Partiel (`test:smoke` = 4 publics) |


**Dette** : `reveal.spec.ts` / `soirees.spec.ts` skip souvent si compte test sans soirée adaptée → tâche seed (1.6).

## P2 — Avant beta publique


| ID  | Tâche                                                 | Effort | Statut | Owner | Notes                                                 |
| --- | ----------------------------------------------------- | ------ | ------ | ----- | ----------------------------------------------------- |
| 2.1 | Pick+ : Stripe **ou** gratuit prolongé explicite      | L      | `todo` | —     | Gating codé, paiement absent                          |
| 2.2 | Rotation / compte TMDB « projet »                     | S      | `todo` | —     | Couplé à **1.16** — avant beta testeurs, pas en alpha |
| 2.3 | Attribution TMDB (logo + mention légale)              | S      | `todo` | —     | Obligatoire TMDB en prod                              |
| 2.4 | Pick Together groupe : finaliser ou retirer de la nav | L      | `todo` | —     | `/app/pick-together` → redirect `/app`                |
| 2.5 | Refactor `HomeScreen.tsx` (~2300 lignes)              | XL     | `todo` | —     | Maintenabilité                                        |
| 2.6 | Monitoring erreurs (Sentry ou équivalent)             | M      | `todo` | —     | Edge + frontend                                       |
| 2.7 | CGU + politique de confidentialité                    | M      | `todo` | —     | Comptes réels                                         |
| 2.8 | Perf reco : timeouts UX, métriques `engineMeta`       | M      | `todo` | —     | `surprise-personalized`                               |
| 2.9 | Accessibilité mobile (safe areas, voix)               | M      | `todo` | —     |                                                       |


---

## P3 — Plus tard / dette


| ID  | Tâche                                           | Statut | Notes                        |
| --- | ----------------------------------------------- | ------ | ---------------------------- |
| 3.1 | Groupes Duo (au-delà du duo à 2)                | `todo` | UI « Bientôt » déjà présente |
| 3.2 | Découper `Profile.tsx`, `surprise-personalized` | `todo` |                              |
| 3.3 | Un seul lockfile (npm vs bun)                   | `todo` |                              |
| 3.4 | Choisir une licence                             | `todo` |                              |
| 3.5 | Internationalisation (au-delà du FR)            | `todo` |                              |
| 3.6 | Purge historique Git si passage en public       | `todo` | Si secrets ont été commités  |


---

## Carte des fonctionnalités (référence rapide)


| Zone                   | Maturité      | Routes / fichiers clés                                                  |
| ---------------------- | ------------- | ----------------------------------------------------------------------- |
| Onboarding initiatique | Alpha avancée | `/onboarding`, `OnboardingFilmTrainer`, migrations `onboarding_films_`* |
| Reco personnalisée     | Alpha avancée | `/app`, `surprise-personalized`, `HomeScreen`                           |
| Profil & bibliothèque  | Beta          | `/app/profile`, `/app/my-cinema`, `taste-engine.ts`                     |
| Soirées                | Beta          | `/app/soirees`, `CreateEventPage`, `EventDetailPage`                    |
| Duo                    | Beta          | `/app/duo`, `duo-profiles.ts`                                           |
| Pick Together          | Alpha         | `/app/pick-together-group`                                              |
| Pick+                  | Coquille UI   | `use-pick-plus.ts`, `PickPlusPaywall`                                   |
| Admin                  | Interne       | `/admin`                                                                |
| Match photo/voix       | Beta          | `/app/match`, `identify-film`                                           |


---

## Journal des mises à jour


| Date       | Qui | Changement                                                                                                                                              |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-22 | —   | Audit TNR : 32 tests Vitest OK · CI documentée (1.9 `done`) · section [TNR & smoke](#tnr--smoke--état-et-lancement) · 1.10 scindé (onboarding / soirée) |
| 2026-06-22 | —   | Refonte onboarding initiatique poussée sur `main` (films, acteurs, pools élargis, migrations SQL)                                                       |
| 2026-06-22 | —   | Sprint A recentré : 0.3 → 0.2 → 1.11 · 0.1 hors scope alpha                                                                                             |
| 2026-06-22 | —   | Création backlog + audit fonctionnel                                                                                                                    |
| 2026-06-22 | —   | Correctifs sécurité P0 (TMDB proxy, edge functions, debugData, `.env`)                                                                                  |
| 2026-06-22 | —   | 0.4 `done` — `.env` retiré du suivi Git                                                                                                                 |
| 2026-06-22 | —   | Script `scripts/deploy-edge-functions.ps1` ajouté                                                                                                       |




---

## Prochaine action recommandée — Sprint A

1. **TNR unit** — `npm run test:unit` (32 tests, ~10 s)
2. **Smoke auto** — `npx playwright install chromium` puis `npm run test:smoke`
3. **0.3 manuel** — checklist §3 ([SMOKE_TESTS.md](SMOKE_TESTS.md)), dont onboarding initiatique
4. **0.2** — Déployer edge functions + migrations onboarding si prod ≠ repo
5. **1.11** — README install + commandes dev/test

*Secret TMDB : **1.16**, uniquement avant beta testeurs.*