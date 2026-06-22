# Backlog Pick — suivi équipe

> **Référence unique** pour prioriser, assigner et suivre l'avancement alpha → beta.  
> Dernière mise à jour : **22 juin 2026**

---

## Comment utiliser ce fichier

1. **Prendre un sujet** : choisir la première tâche `todo` ou `blocked` du sprint en cours (voir [Sprint actif](#sprint-actif)).
2. **La réserver** : passer le statut à `in_progress`, renseigner **Owner** et la date dans [Journal](#journal-des-mises-à-jour).
3. **La terminer** : statut `done`, cocher la case, noter la PR ou le commit en **Notes**.
4. **Bloquer** : statut `blocked` + explication en Notes.

### Statuts

| Statut | Signification |
|--------|----------------|
| `todo` | Pas commencé |
| `in_progress` | Quelqu'un travaille dessus |
| `blocked` | En attente d'une dépendance externe |
| `done` | Terminé et vérifié |
| `cancelled` | Plus pertinent / reporté indéfiniment |

### Priorités

| Niveau | Quand s'en occuper |
|--------|-------------------|
| **P0** | Maintenant — bloquant technique |
| **P1** | Beta fermée (10–30 testeurs) |
| **P2** | Avant ouverture publique |
| **P3** | Dette / plus tard |

### Effort (indicatif)

`S` < 1 j · `M` 1–3 j · `L` 1–2 sem · `XL` > 2 sem

---

## Sprint actif — **A** (focus équipe)

**Sprint A — « Ça marche chez nous »** · alpha interne · semaine du 22 juin 2026

**Hors scope** : ~~0.1~~ secret TMDB → **1.16** (avant beta testeurs externes)

### Objectif

Valider que l'app alpha est utilisable de bout en bout : smoke tests OK, edge functions alignées avec le code si besoin, README install.

### File d'attente (dans l'ordre)

| # | ID | Tâche | Statut | Action |
|---|-----|--------|--------|--------|
| 1 | 0.4 | `.env` hors Git | `done` | — |
| 2 | 0.3 | Smoke tests | `in_progress` | `npm run test:smoke` + [SMOKE_TESTS.md](SMOKE_TESTS.md) |
| 3 | 0.2 | Déployer edge functions | `todo` | Seulement si prod ≠ code local · `deploy-edge-functions.ps1` |
| 4 | 1.11 | README projet | `todo` | Install, `.env`, commandes dev/test |

### Definition of done — Sprint A

- [ ] `npm run build` OK
- [ ] `npm run test:smoke` OK (ou documenté pourquoi skip E2E)
- [ ] Checklist manuelle 0.3 cochée (au moins une passe équipe)
- [ ] README à jour (1.11)

### Sprints suivants (pas maintenant)

| Sprint | Thème | Tâches |
|--------|-------|--------|
| B | Testeurs heureux | 1.3–1.6, 1.9, **1.16** |
| C | Social fiable | 1.7–1.8, 1.10, 1.12–1.13 |

> **En parallèle alpha** (hors clôture Sprint A) : **1.6** soirées, correctifs UX — déjà **1.14** / **1.15** faits.

---

## P0 — Sprint A (alpha)

| ID | Tâche | Effort | Statut | Owner | Notes |
|----|--------|--------|--------|-------|-------|
| 0.2 | Redéployer les edge functions modifiées | S | `todo` | — | `scripts/deploy-edge-functions.ps1` — si prod diverge du repo |
| 0.3 | Smoke test manuel + automatisé | S | `in_progress` | — | Guide : `docs/SMOKE_TESTS.md` · `npm run test:smoke` |
| 0.4 | `.env` hors Git + `.env.example` | S | `done` | — | `.env` retiré du suivi Git ; `.gitignore` + `.env.example` en place |

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
npx supabase login
npx supabase link --project-ref lrjhpflvkrebbngfnaif
.\scripts\deploy-edge-functions.ps1   # optionnel en alpha si prod déjà à jour
npm run test:smoke
npm run dev                           # puis checklist manuelle (SMOKE_TESTS.md)
```

> Secret `TMDB_API_KEY` : **pas requis en alpha** — traiter avant l'ouverture aux beta testeurs (**1.16**).

---

## P1 — Beta fermée confortable

### Produit & UX

| ID | Tâche | Effort | Statut | Owner | Notes |
|----|--------|--------|--------|-------|-------|
| 1.1 | Clarifier Pick+ dans l'UI (alpha = gratuit) | S | `done` | — | `isPremium = true` temporaire dans `use-pick-plus.ts` |
| 1.2 | Assouplir limites freemium en alpha | S | `done` | — | Idem — paywall « Bientôt » encore visible sur `/app/pick-plus` |
| 1.3 | Marquer explicitement « Bientôt » (groupes Duo, options soirée) | S | `todo` | — | `DuoPage`, `CreateEventPage`, `HomeScreenChoiceModal` |
| 1.4 | Messages d'erreur clairs si TMDB / edge function down | M | `todo` | — | `tmdb-proxy-client.ts`, écrans reco |
| 1.5 | Rappeler / forcer onboarding incomplet | M | `todo` | — | `profiles.onboarding_completed` |

### Soirées & social

| ID | Tâche | Effort | Statut | Owner | Notes |
|----|--------|--------|--------|-------|-------|
| 1.6 | Stabiliser soirées bout-en-bout (création → invite → révélation) | L | `in_progress` | — | Tests E2E : `soirees.spec.ts`, `reveal.spec.ts` |
| 1.14 | Révéler sans flash accueil (overlay instantané) | S | `done` | — | 22/06 — `TonightPickOverlay`, `Index`, `HomeScreen` |
| 1.15 | Intent soirée complet (genres, mood, mediaType → pipeline) | S | `done` | — | 22/06 — `RevealIntent`, `EventDetailPage`, `runRevealPipeline` |
| 1.7 | Documenter + tester flow Duo | M | `todo` | — | `/app/duo`, `/join-duo/:code` |
| 1.8 | Vérifier notifications (ami, soirée, duo) | M | `todo` | — | `lib/notifications.ts` |

### Qualité & docs

| ID | Tâche | Effort | Statut | Owner | Notes |
|----|--------|--------|--------|-------|-------|
| 1.16 | Secret `TMDB_API_KEY` Supabase + rotation clé projet | S | `todo` | — | **Avant beta testeurs externes** — `npx supabase secrets set TMDB_API_KEY=...` · lien **2.2** |
| 1.9 | CI GitHub Actions : lint + build + Vitest | M | `todo` | — | Pas de `.github/workflows` aujourd'hui |
| 1.10 | Étendre E2E Playwright (reco, onboarding) | M | `todo` | — | Voir matrice dans `docs/SMOKE_TESTS.md` |
| 1.11 | README projet (install, `.env`, secrets Supabase) | S | `todo` | — | Remplacer template Lovable |
| 1.12 | Retirer `ADMIN_EMAILS` du client → rôle serveur uniquement | S | `todo` | — | `hooks/use-admin.ts` |
| 1.13 | Restreindre `find-user-by-email` (amis + rate limit) | M | `todo` | — | Edge function |

### Tests connus (hors backlog actif)

- `movie-interactions.test.tsx` : **8 tests en échec** (juin 2026) — à traiter avant de fiabiliser la CI (1.9).

---

## P2 — Avant beta publique

| ID | Tâche | Effort | Statut | Owner | Notes |
|----|--------|--------|--------|-------|-------|
| 2.1 | Pick+ : Stripe **ou** gratuit prolongé explicite | L | `todo` | — | Gating codé, paiement absent |
| 2.2 | Rotation / compte TMDB « projet » | S | `todo` | — | Couplé à **1.16** — avant beta testeurs, pas en alpha |
| 2.3 | Attribution TMDB (logo + mention légale) | S | `todo` | — | Obligatoire TMDB en prod |
| 2.4 | Pick Together groupe : finaliser ou retirer de la nav | L | `todo` | — | `/app/pick-together` → redirect `/app` |
| 2.5 | Refactor `HomeScreen.tsx` (~2300 lignes) | XL | `todo` | — | Maintenabilité |
| 2.6 | Monitoring erreurs (Sentry ou équivalent) | M | `todo` | — | Edge + frontend |
| 2.7 | CGU + politique de confidentialité | M | `todo` | — | Comptes réels |
| 2.8 | Perf reco : timeouts UX, métriques `engineMeta` | M | `todo` | — | `surprise-personalized` |
| 2.9 | Accessibilité mobile (safe areas, voix) | M | `todo` | — | |

---

## P3 — Plus tard / dette

| ID | Tâche | Statut | Notes |
|----|--------|--------|-------|
| 3.1 | Groupes Duo (au-delà du duo à 2) | `todo` | UI « Bientôt » déjà présente |
| 3.2 | Découper `Profile.tsx`, `surprise-personalized` | `todo` | |
| 3.3 | Un seul lockfile (npm vs bun) | `todo` | |
| 3.4 | Choisir une licence | `todo` | |
| 3.5 | Internationalisation (au-delà du FR) | `todo` | |
| 3.6 | Purge historique Git si passage en public | `todo` | Si secrets ont été commités |

---

## Carte des fonctionnalités (référence rapide)

| Zone | Maturité | Routes / fichiers clés |
|------|----------|------------------------|
| Reco personnalisée | Alpha avancée | `/app`, `surprise-personalized`, `HomeScreen` |
| Profil & bibliothèque | Beta | `/app/profile`, `/app/my-cinema`, `taste-engine.ts` |
| Soirées | Beta | `/app/soirees`, `CreateEventPage`, `EventDetailPage` |
| Duo | Beta | `/app/duo`, `duo-profiles.ts` |
| Pick Together | Alpha | `/app/pick-together-group` |
| Pick+ | Coquille UI | `use-pick-plus.ts`, `PickPlusPaywall` |
| Admin | Interne | `/admin` |
| Match photo/voix | Beta | `/app/match`, `identify-film` |

---

## Journal des mises à jour

| Date | Qui | Changement |
|------|-----|------------|
| 2026-06-22 | — | Sprint A recentré : 0.3 → 0.2 → 1.11 · 0.1 hors scope alpha |
| 2026-06-22 | — | Création backlog + audit fonctionnel |
| 2026-06-22 | — | Correctifs sécurité P0 (TMDB proxy, edge functions, debugData, `.env`) |
| 2026-06-22 | — | 0.4 `done` — `.env` retiré du suivi Git |
| 2026-06-22 | — | Script `scripts/deploy-edge-functions.ps1` ajouté |

<!-- Ajouter une ligne en haut du tableau à chaque session de travail -->

---

## Prochaine action recommandée — Sprint A

1. **0.3** — Lancer `npm run test:smoke`, puis checklist manuelle ([SMOKE_TESTS.md](SMOKE_TESTS.md))
2. **0.2** — Déployer edge functions si besoin (comparer prod / repo)
3. **1.11** — README install + commandes dev/test

*Secret TMDB : **1.16**, uniquement avant beta testeurs.*
