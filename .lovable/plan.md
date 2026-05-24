# C5 — Refacto Index.tsx (920 lignes → ~250)

## Objectif

Réduire le risque de bugs d'état (19 useState, 8 overlays, 3 listeners `window`) sans casser le moindre comportement utilisateur. Pas de XState (overkill, dépendance lourde) — on reste sur React natif avec `useReducer` + hooks de domaine.

**Contrat strict : aucune modification visible côté UX.** Mêmes overlays, mêmes transitions, mêmes appels edge functions, même télémétrie.

## Architecture cible

```text
src/pages/Index.tsx                          (≈ 250 lignes — composition + JSX)
src/pages/index/
  ├── reducer.ts                             (state machine: home | result + flux)
  ├── use-profile-prefs.ts                   (chargement profil + onboarding redirect)
  ├── use-recommendation-engine.ts           (surprise, refine, showAnother, openBatch + session logging)
  ├── use-overlay-orchestrator.ts            (tour, activation, missions, chat, paywall)
  └── use-external-bridges.ts                (location.state, pick-chat-movie, pick-reset-home, home-reset)
```

## Étapes

### 1. Extraire le reducer (`reducer.ts`)
Regroupe les 12 useState liés au flux recommandation/chat en un seul state typé :
```ts
type IndexState = {
  step: "home" | "result";
  results: RecommendationMovieDetail[];
  currentResultIndex: number;
  resultIndexHistory: number[];
  resultSeenMovieIds: Set<number>;
  batchRejectedIds: Set<number>;
  resultOrigin: "home" | "external";
  resultSuggestionCount: number;
  searchTags: string[];
  showChat: boolean;
  chatInitialMessages?: ChatMessage[];
  chatSuggestedMovies: MovieDetail[] | null;
  chatSuggestedStartIndex: number;
  chatSuggestedSeenMovieIds: Set<number>;
}
```
Actions : `OPEN_BATCH`, `RESET_HOME`, `NEXT`, `PREV`, `GO_TO_INDEX`, `OPEN_CHAT`, `CLOSE_CHAT`, `CONSUME_CHAT_SUGGESTIONS`, `ADD_TAG`, `REMOVE_TAG`, `SET_SEARCH_TAGS`, `REPLACE_BATCH` (pour `handleShowAnother`/refine), `MARK_VISITED`, `MARK_REJECTED`.

### 2. `use-profile-prefs.ts`
Sort le `useEffect` profil (60+ lignes), retourne `{ profilePrefs, profileLoaded, showTour, showActivation, setShowTour, setShowActivation }`. Garde la redirection `/onboarding` et la logique `activation_completed >= 20 interactions`.

### 3. `use-recommendation-engine.ts`
Encapsule `invokeSurprisePersonalized`, `triggerSurpriseForMission`, `handleSurprise`, `handleMovieSelect`, `handleShowAnother`, `handleVoiceSearchIntent`, `handleMovieSuggested`, `handleRefineWithVoice`, plus la création/log/abandon de session. Reçoit `profilePrefs`, `dispatch`, `user`. Retourne les handlers + `{ loading, loadingMessage, dynamicAnecdotes }`.

### 4. `use-overlay-orchestrator.ts`
Sort la gestion des missions d'activation (`handleActivationMission`, `handleActivationComplete`, `handleTourComplete`), les guides watchlist/talk-to-pick, et expose `{ activeActivationMission, watchlistGuideStep, talkToPickGuideStep, openTrainerOnMount, ... }`.

### 5. `use-external-bridges.ts`
Centralise les 4 `window.addEventListener` + le parsing de `location.state` + `sessionStorage("pick-fab-movie")`. Évite la duplication entre `home-reset` (déjà ajouté) et `pick-reset-home` (legacy, qui fait presque la même chose — on garde les deux, mais dans un seul fichier).

### 6. Index.tsx final
Devient un composant de composition pure : appel des 4 hooks, branchement sur `<HomeScreen>` / `<ResultScreen>` / overlays. Plus aucune logique métier inline. JSX strictement identique à l'actuel.

## Garde-fous

- **Pas de changement de signature** côté `HomeScreen`, `ResultScreen`, `VoiceChat`, `ActivationFlow`, etc.
- **Pas de changement de timing** : on conserve les `setTimeout(..., 250/400)` des missions.
- **Pas de changement d'event names** : `home-reset`, `pick-reset-home`, `pick-activation-refresh`, `pick-chat-movie`, `cinema-reset` restent identiques.
- Tests manuels après refacto : surprise mission, voice search, refine with message, show another, watchlist guide, talk-to-pick guide, navigation deep-link `pick-fab-movie`.

## Hors scope (explicitement)

- Ne touche pas à `HomeScreen.tsx`, `ResultScreen.tsx`, `VoiceChat.tsx`.
- Ne fusionne pas `home-reset` et `pick-reset-home` (legacy code peut en dispatcher) — juste collocalisés.
- Ne remplace pas `sonner` par `useToast` (= I11, séparé).
- Pas de skeleton loaders (= I10, séparé).

## Effort estimé

3–4 h. Risque modéré : beaucoup de handlers interdépendants. Mitigation : commits logiques étape par étape, JSX inchangé en tout dernier.
