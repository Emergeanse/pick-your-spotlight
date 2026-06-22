# Smoke tests Pick — guide équipe

> **Objectif** : valider en ~15–30 min que l'app est utilisable après un déploiement (edge functions, secrets, build).  
> Lié au backlog : tâche **0.3** · complète **1.9** / **1.10** (CI).

---

## Quand lancer les smoke tests ?

| Moment | Niveau recommandé |
|--------|-------------------|
| Après déploiement edge functions (0.2), si applicable | **Manuel complet** (section 3) |
| Avant merge sur `main` | **Automatisé** (`npm run test:smoke`) |
| Après correctif soirées / révélation | **Automatisé** + scénarios 3.5–3.6 |
| Avant ouverture beta testeurs externes | Manuel complet + **1.16** (secret TMDB) + E2E credentials |

---

## 1. Prérequis

### Infra (alpha)

- [ ] **0.4** `.env` local avec `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `npm run build` passe sans erreur
- [ ] Navigateurs Playwright installés : `npx playwright install chromium` (une fois par machine)
- [ ] **0.2** Edge functions déployées — seulement si le code local a divergé de la prod

> **Alpha** : pas de rotation secret TMDB (**0.1 annulé**). Clé / config actuelle conservée.  
> Avant beta testeurs externes → backlog **1.16** (`TMDB_API_KEY` dans Supabase + rotation **2.2**).

### Compte de test E2E (optionnel mais recommandé)

Copier `.env.test.example` → `.env.test` :

```powershell
cp .env.test.example .env.test
# Renseigner E2E_TEST_EMAIL et E2E_TEST_PASSWORD
```

**Profil idéal du compte test :**

| Besoin | Pourquoi |
|--------|----------|
| Onboarding terminé | Accès `/app` sans redirect |
| ≥ 2 films likés | Pipeline `surprise-personalized` actif |
| ≥ 1 film en watchlist | Scénario biblio |
| Organisateur d'1 soirée **non révélée** (mode surprise) | Bouton « Révéler » |
| Duo actif (optionnel) | Scénario duo |

---

## 2. Automatisé — commandes

```powershell
cd pick-your-spotlight

# Smoke rapide (sans credentials : garde de routes + build + unit)
npm run test:smoke

# Smoke E2E complet (nécessite .env.test ou variables exportées)
npm run test:smoke:full

# Script tout-en-un (build + unit + e2e)
.\scripts\smoke-test.ps1
```

### Ce que couvre `test:smoke`

| Couche | Fichiers | Credentials |
|--------|----------|-------------|
| Build | `vite build` | — |
| Unit | `event-reveal.test.ts` (file sessionStorage révélation) | — |
| E2E public | `auth.spec.ts` (garde `/app` → auth) | Non |
| E2E auth | `auth`, `navigation` (si `E2E_TEST_EMAIL`) | Oui |

### Ce que couvre `test:smoke:full`

Ajoute : `pipeline`, `cinema`, `soirees`, `reveal` (mocks edge functions — pas de facture IA).

---

## 3. Manuel post-déploiement (checklist 0.3)

Cocher dans `BACKLOG.md` ou ici après chaque session.

### 3.1 Connexion / onboarding

| # | Action | Résultat attendu | E2E |
|---|--------|------------------|-----|
| 1 | Ouvrir `/auth` déconnecté | Champs email + mot de passe visibles | `auth.spec` |
| 2 | Se connecter | Redirect `/app`, pas de boucle auth | `auth.spec` |
| 3 | Compte sans onboarding | Redirect onboarding ou bannière rappel | Manuel |
| 4 | Bottom tab bar | Accueil, Soirées, Biblio, Profil visibles | `navigation.spec` |

### 3.2 Reco depuis `/app`

| # | Action | Résultat attendu | E2E |
|---|--------|------------------|-----|
| 1 | Ouvrir modal « Ce soir » / FAB | Modal choix visible | `pipeline.spec` |
| 2 | « Laisse-moi te surprendre » | **Overlay noir immédiat** (< 500 ms), pas de flash accueil | `pipeline.spec` |
| 3 | Attendre fin reco | 1–3 films proposés, affiches TMDB | Manuel (prod) |
| 4 | Confirmer un film | `ResultScreen`, actions like/dislike | Manuel |

### 3.3 Fiche film (TMDB proxy)

| # | Action | Résultat attendu | E2E |
|---|--------|------------------|-----|
| 1 | Ouvrir détail depuis reco ou biblio | Poster + synopsis chargés | Manuel |
| 2 | Crédits / casting | Données TMDB (pas d'erreur 401 clé) | Manuel |
| 3 | Console navigateur | Pas d'appel direct `api.themoviedb.org` avec clé | Manuel |

### 3.4 Watchlist / Biblio

| # | Action | Résultat attendu | E2E |
|---|--------|------------------|-----|
| 1 | `/app/my-cinema` | Page charge, onglets À voir / Vu | `cinema.spec` |
| 2 | Ajouter un film à voir depuis une fiche | Film apparaît dans À voir | Manuel |
| 3 | Marquer vu | Film dans onglet Vu | Manuel |

### 3.5 Soirée — création & invitation

| # | Action | Résultat attendu | E2E |
|---|--------|------------------|-----|
| 1 | `/app/soiree/nouvelle` | Wizard 3 étapes | `soirees.spec` (goto) |
| 2 | Créer soirée duo + date + mode surprise | Event en liste `/app/soirees` | Manuel |
| 3 | Copier lien invitation | URL `/invite/:token` valide | Manuel |
| 4 | Ouvrir lien (autre compte ou navigation privée) | Page invite, rejoindre | Manuel |

### 3.6 Soirée — Révéler (régression 1.14 / 1.15)

| # | Action | Résultat attendu | E2E |
|---|--------|------------------|-----|
| 1 | Détail soirée → « Révéler » | Navigation `/app`, **pas de flash accueil** | `reveal.spec` |
| 2 | Pendant chargement | Mur d'affiches / messages, fond noir opaque | Manuel |
| 3 | Résultat | Films proposés ; mood/genres/media de la soirée pris en compte | Manuel |
| 4 | Confirmer | `final_pick_*` mis à jour sur la soirée | Manuel |
| 5 | Mode `timed` avant l'heure | Compte à rebours, bouton Révéler masqué | Manuel |
| 6 | Mode `timed` après l'heure | Bouton « L'heure est venue ! » | Manuel |

### 3.7 Edge functions critiques (prod)

Appeler depuis l'app connectée — vérifier pas de 500 :

| Function | Déclencheur |
|----------|-------------|
| `tmdb-proxy` | Ouvrir une fiche film |
| `surprise-personalized` | Reco / Révéler |
| `movie-match` | Affichage score match |

---

## 4. Matrice couverture

```
                    │ Unit │ E2E mock │ E2E prod │ Manuel │
────────────────────┼──────┼──────────┼──────────┼────────┤
Auth / routes       │  —   │    ✅    │    ✅    │   ✅   │
Navigation tabs     │  —   │    ✅    │    ✅    │   ✅   │
Pipeline surprise   │  —   │    ✅    │    ⚠️    │   ✅   │
Révéler soirée      │  ✅  │    ✅    │    ⚠️    │   ✅   │
Biblio              │  —   │    ✅    │    ✅    │   ✅   │
Liste soirées       │  —   │    ✅    │    ✅    │   ✅   │
TMDB proxy          │  —   │    —     │    —     │   ✅   │
Onboarding          │  —   │    —     │    —     │   ✅   │
Duo / invite ami    │  —   │    —     │    —     │   ✅   │
```

✅ = couvert · ⚠️ = partiel (mocks réseau) · — = non automatisé

---

## 5. Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| E2E skip « E2E_TEST_EMAIL non défini » | Pas de `.env.test` | Copier `.env.test.example` |
| Login Supabase échoué (401) | Mauvais mot de passe compte test | Réinitialiser mot de passe |
| Révéler → flash accueil | Régression 1.14 | Vérifier `TonightPickOverlay` instantCover |
| Fiche film vide | TMDB / proxy down | Vérifier prod ; en alpha pas de changement secret (**1.16** si beta) |
| `surprise-personalized` 500 | Functions pas déployées (0.2) | `deploy-edge-functions.ps1` |
| Navigateurs Playwright absents | Première install | `npx playwright install chromium` |
| Tests `movie-interactions` en échec | Dette connue | Hors smoke — traiter avant CI 1.9 |

---

## 6. Prochaines étapes (backlog)

| ID | Amélioration |
|----|--------------|
| 0.3 | Exécuter checklist manuelle |
| 1.9 | CI : `test:smoke` sur chaque PR |
| 1.10 | E2E onboarding + création soirée complète |
| 1.16 | Secret TMDB avant beta testeurs externes |
| 1.6 | Stabiliser données test (seed soirée dédiée) |

---

## Journal smoke

| Date | Env | Qui | Résultat | Notes |
|------|-----|-----|----------|-------|
| — | — | — | — | Ajouter une ligne après chaque campagne |
