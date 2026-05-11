## Pick Together — flux "groupe maintenant" en langage naturel

### 1. Nouveau parcours UX (mobile-first)

Remplace les étapes Who → Media → Mood par un flux conversationnel court qui réutilise l'univers visuel actuel (BrandHeader, dark theme, neon purple, composants `together/*`).

```
Landing → Prompt (langage naturel + invités rapides) → [Clarify si bloquant] → Reformulation → Loading → Results → Décision groupe
```

Étapes:
- **PromptStep** (nouveau) : grand textarea "Décris ta soirée…" + chip "Ajouter quelqu'un" (prénom + 1-2 chips genres optionnels). Friends sélectionnables en bas si déjà liés.
- **ReformulationStep** (nouveau) : Pick reformule en 2-3 lignes avec deux blocs visuels distincts :
  - "Envie du moment" (envie de session — non persistée)
  - "Goûts pris en compte" (préférences participants — persistées pour les inscrits)
  - Bouton "C'est bon" / "Préciser"
- **ClarifyStep** (nouveau, conditionnel) : affichée uniquement si `parse-pick-prompt` renvoie un blocage (aucun genre commun viable, durée incompatible, etc.). Une question max.
- **ResultsStep** (refactor) : 3-5 cartes avec :
  - Raison principale typée (`session_wish` / `taste_match` / `constraint_ok` / `tonight_fit`)
  - Badges statut user (`useMovieInteractions` déjà unifié — déjà vu / pas pour moi / aimé / watchlist restent visibles)
  - Réactions rapides 👍 / 👎 / "On garde"
- **DecisionStep** (nouveau) : écran final "Ce soir on regarde" + récap participants + CTA "Lancer sur la plateforme".

### 2. Séparation préférences participant ↔ envie de session

Règle stricte:
| Source | Destination | Persistance |
|---|---|---|
| Prompt envie commune ("film historique pour ce soir") | `recommendation_sessions.prompt_text` + `group_sessions.context_json.session_wish` | Session uniquement |
| Préférence participant inscrit ("Elisa aime comédies 80s") | `user_preferences` (tags) si Elisa est inscrite ET a opt-in | Permanent |
| Préférence participant invité | `group_session_members.guest_preferences_json` | Session uniquement |
| Réactions hero/alternatives | `user_item_feedback` via `useMovieInteractions` | Permanent |

Garde-fou : pour un membre inscrit, `parse-pick-prompt` extrait des préférences candidates mais on **ne les écrit jamais en `user_preferences`** sans confirmation explicite (toggle "Mémoriser pour Elisa" plus tard). Pour cette V1, **0 écriture sur `user_preferences` depuis Pick Together**.

### 3. Statuts métier

- `group_sessions.status` : `draft` → `collecting_preferences` → `ready` → `completed` / `cancelled`. (`scheduled` reste pour PlanSession.)
- `recommendation_sessions.status` : `active` → `completed` / `abandoned` (déjà en place, on garde simple).

Migration: aucune contrainte CHECK ajoutée (cf. règle "validation triggers, pas check"). Les nouveaux statuts sont utilisés en code uniquement, valeurs libres en base.

### 4. Edge function `group-recommend`

Refactor du payload et de la sortie:
- Input enrichi : `sessionWish` (string), `parsedIntent` (sortie de `parse-pick-prompt`), `members` (id + display_name), `guests`, `mediaType`, `audience: "group_now"`.
- Pour chaque film retourné, ajoute `reasonType` ∈ {`session_wish`, `taste_match`, `constraint_ok`, `tonight_fit`} + `reasonText` court.
- Lecture `user_preferences` (tags) + `user_item_feedback` (exclusions déjà-vu sauf si demandé) pour les inscrits ; `guest_preferences_json` pour les invités. Plus aucune lecture de `liked_movies` / `watchlist` comme source de vérité goût.

### 5. Nettoyage dette

- `PickTogether.tsx` : retire `likeMovie` import (non utilisé après refactor).
- `group-sessions.ts` : ajoute helpers `setSessionWish(sessionId, wish)` et `updateGroupSessionStatus(sessionId, status)`.
- `parse-pick-prompt` : la fonction edge existe déjà. Vérifier qu'elle renvoie bien la séparation `sessionWish` vs `participantHints[]`. Sinon ajuster le prompt système.
- Compatibilité legacy `liked_movies` : laissée en place pour `MyCinema` mais **interdite** dans le flux Together.

### 6. Tests de non-régression

Étendre `src/test/movie-interactions.test.tsx` avec un cas : un film retourné par `group-recommend` qui réapparaît après un swipe conserve son badge (`liked` / `seen` / `watchlist`).

### Fichiers touchés

**Nouveaux**
- `src/components/pick/together/PromptStep.tsx`
- `src/components/pick/together/ReformulationStep.tsx`
- `src/components/pick/together/ClarifyStep.tsx`
- `src/components/pick/together/DecisionStep.tsx`

**Modifiés**
- `src/pages/PickTogether.tsx` (machine d'états refondue)
- `src/components/pick/together/ResultsStep.tsx` (raison typée + 5 cartes)
- `src/lib/group-sessions.ts` (helpers statut + session_wish)
- `src/lib/parse-prompt.ts` (typage `sessionWish` / `participantHints`)
- `supabase/functions/parse-pick-prompt/index.ts` (prompt système ajusté)
- `supabase/functions/group-recommend/index.ts` (raison typée, sources de vérité, pas de legacy)
- `src/test/movie-interactions.test.tsx` (cas group)

**Conservés tels quels**
- `WhoStep`, `MediaStep`, `MoodStep`, `LoadingStep`, `LandingStep` (réutilisés ou retirés du flux principal mais gardés pour `PlanSession` programmé).

### Hors scope (à faire dans une itération suivante)
- Toggle "mémoriser pour ce membre" qui écrirait dans `user_preferences`.
- Vote multi-membres asynchrone (decision_mode `vote`) — on reste sur `instant` pour le "groupe maintenant".
