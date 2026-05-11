# Refactor Pick V1 — Plan structuré

Refactor majeur autour du schéma cible V1. Pour limiter le risque (12 utilisateurs actifs, 15+ edge functions, code client massif), je propose un découpage en **5 phases livrables indépendamment**, chacune testable. Tu valides phase par phase.

---

## Phase 1 — Schéma DB cible (migration non destructive)

Aligner les tables existantes sur les besoins V1, **sans supprimer le legacy** (rollback safe).

### 1.1 Étendre `recommendation_sessions`
Ajouter colonnes :
- `audience_type` text CHECK (`solo`|`group`) DEFAULT `solo`
- `decision_mode` text CHECK (`instant`|`planned`) DEFAULT `instant`
- `group_session_id` uuid (nullable)
- `prompt_text` text
- `scheduled_for` timestamptz
- `status` text CHECK (`active`|`completed`|`abandoned`) DEFAULT `active`
- `selected_catalog_item_id` uuid

### 1.2 Étendre `group_sessions`
Renommer/aligner :
- `creator_id` → garder, ajouter alias logique `created_by_user_id` (vue ou usage code)
- Ajouter : `title` text, `decision_mode`, `status`, `scheduled_for`, `context_json` jsonb, `selected_catalog_item_id` uuid

### 1.3 Étendre `group_session_members` (invités légers)
Ajouter :
- `guest_age_range` text
- `guest_profile_text` text
- `guest_preferences_json` jsonb DEFAULT `{}`

### 1.4 Étendre `user_item_feedback`
Ajouter :
- `feedback_type` text CHECK (`like`|`love`|`seen`|`not_for_me`|`watchlist`|`skip`|`dislike`) — colonne canonique (mappe `label` actuel)
- `source` text DEFAULT `manual`
- `context_type` text (`solo_session`|`group_session`|`browse`)
- `context_id` uuid
- Index unique `(user_id, item_id, feedback_type)` pour idempotence

### 1.5 Foreign keys (ajout prudent)
Ajouter FK manquantes vers `auth.users` et `catalog_items` sur les tables cœur V1. Nettoyage des orphelins avant.

**⚠️ Ne touche pas** : `liked_movies`, `watchlist`, colonnes preferences de `profiles` (Phase 5).

---

## Phase 2 — Couche d'accès unifiée (libs TS)

Créer/refactorer les modules `src/lib/` pour exposer une API V1 propre. **Le code legacy continue de fonctionner via wrappers.**

- `src/lib/feedback.ts` (refactor) → utilise `feedback_type`, `context_type/id`, batch
- `src/lib/wishlist.ts` (nouveau) → wrapper sur `user_item_feedback` avec `feedback_type='watchlist'`. Remplace progressivement `watchlist.ts`
- `src/lib/preferences.ts` (nouveau) → CRUD `user_preferences` + `preference_tags`, lecture pondérée
- `src/lib/sessions.ts` (nouveau) → créer/lire/clore `recommendation_sessions` (solo + group), logguer `recommendation_events`
- `src/lib/group-sessions.ts` (nouveau) → créer session groupe, ajouter membres inscrits/invités, sélectionner film final
- `src/lib/catalog.ts` (nouveau) → `getOrCreateCatalogItem(tmdbId, meta)` centralisé (déduplique la logique éparpillée)

Wrappers de compat : `addToWatchlist()` legacy continue d'écrire dans `watchlist` ET `user_item_feedback` pendant la transition.

---

## Phase 3 — Refactor parcours solo

- `HomeScreen.tsx` : entrée NL + 2 CTA clairs (`Maintenant` / `Planifier`)
- `ResultScreen.tsx` : crée une `recommendation_session` (audience=solo, mode=instant), logue chaque film via `recommendation_events`, enregistre `selected_catalog_item_id` au choix final
- `MovieActionBar.tsx` : utilise nouveau `feedback.ts` avec `context_type='solo_session'`
- Nouveau `PlanSessionScreen.tsx` : choix date/heure → `decision_mode='planned'`

---

## Phase 4 — Refactor parcours groupe + invités

- `PickTogether.tsx` + `together/*` : refactor sur `group_sessions` + `recommendation_sessions` liées
- Nouveau composant `AddGuestForm.tsx` : prénom + âge + texte libre + tags (UI minimaliste, pas de formulaire lourd)
- `WhoStep.tsx` : permet d'ajouter inscrits **et** invités dans la même liste
- `ResultsStep.tsx` : agrège prefs (registered via `user_preferences`, guests via `guest_preferences_json`), enregistre film final
- Mode planifié : `scheduled_for` + notification simple via `notifications`

---

## Phase 5 — Nettoyage legacy (différé, après QA des phases 1-4)

- Migration de données : `liked_movies` + `watchlist` → `user_item_feedback`
- Migration : colonnes `favorite_genres`, `excluded_genres`, `preferred_platforms` de `profiles` → `user_preferences` (avec `preference_tags`)
- Edge functions : remplacer toutes les lectures `profiles.favorite_genres` etc. par `user_preferences`
- Drop des colonnes/tables legacy
- Suppression des wrappers de compat

---

## Détails techniques

**RLS** : toutes nouvelles colonnes héritent des policies existantes. Pour `group_session_members` invités (user_id NULL), policies déjà OK (`is_session_member` + creator).

**Edge functions impactées** (à mettre à jour Phase 3-4) : `group-recommend`, `surprise-personalized`, `movie-match`, `pick-chat`, `companion-chat`, `cinematic-profile`.

**Compat ascendante** : pendant phases 2-4, code legacy continue de tourner. Aucun downtime.

**Tests** : à chaque phase, smoke test manuel des parcours clés (solo instant, solo planned, group instant, group planned avec invité).

---

## Question avant de démarrer

Ce refactor est lourd (~30-50 fichiers touchés, 5 migrations, refactor edge functions). Pour avancer proprement :

**Veux-tu que je démarre par la Phase 1 (migration DB cible non destructive) seule**, qu'on valide le schéma en preview, puis qu'on enchaîne phase par phase ?

Ou préfères-tu **Phase 1 + Phase 2 (libs)** en un seul lot, pour avoir tout de suite l'infra de code prête sans encore toucher l'UI ?

Je te recommande **Phase 1 seule en premier** : 1 migration validée = base saine pour tout le reste, et tu peux relire le SQL avant exécution.