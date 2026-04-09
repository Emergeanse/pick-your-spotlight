

# Audit du modèle de données Pick — Rapport & Plan de migration

## ⚠️ Note importante

Votre prompt contient des **placeholders vides** pour le schéma cible (`[PASTE EXACT profiles TABLE SPEC HERE]`, etc.). Il n'y a donc pas de spec concrète à comparer. L'audit ci-dessous est basé sur les **principes architecturaux** que vous avez énoncés.

---

## 1. Rapport d'audit — Violations des principes

### 🔴 Violation critique : Préférences stockées dans `profiles`

La table `profiles` contient **12+ colonnes de préférences** directement :
- `favorite_genres`, `excluded_genres` (text[])
- `preferred_platforms`, `excluded_platforms` (int[])
- `media_preference`, `default_media_type`, `default_max_duration`
- `min_rating`, `match_threshold`
- `ritual_enabled`, `ritual_time`

**Principe violé** : "NEVER store preferences as boolean columns" / "strict separation of concerns" / "tag-based extensible system"

**Problème** : Chaque nouvelle préférence = `ALTER TABLE profiles`. Pas extensible, pas pondérable.

### 🔴 Aucune foreign key dans tout le schéma

**0 foreign keys** détectées. Toutes les relations (`user_id`, `session_id`, `tmdb_id`) sont des colonnes sans contraintes référentielles. Cela permet :
- Des orphelins (interactions sans user, membres sans session)
- Aucune cascade de suppression automatique
- Incohérence de données garantie

### 🟡 `user_interactions` — feedback non structuré

- `action_type` est un `text` libre sans CHECK constraint
- Pas de score numérique (juste des labels comme "liked", "skipped")
- Le `context` JSONB est un fourre-tout non validé

**Principe violé** : "ALL scoring signals must be numeric"

### 🟡 Pas de table de catalogue unifiée

Les films sont référencés par `tmdb_id` dans 5 tables différentes (`liked_movies`, `watchlist`, `user_interactions`, `recommendation_events`, `movie_embeddings`) sans table pivot. Les métadonnées (titre, genres, poster) sont **dupliquées** dans `liked_movies` et `watchlist`.

### 🟡 Pas de sessions de recommandation

Aucune table `recommendation_sessions` ni `session_overrides`. Les overrides (filtres rapides) sont purement client-side et ne sont pas persistés ni snapshot-és.

### 🟢 Points conformes
- `user_roles` séparée (correct)
- `user_taste_vectors` séparée (correct)
- `movie_embeddings` avec index IVFFlat (correct)
- Timestamps sur toutes les tables (correct)
- RLS activé partout (correct)

---

## 2. Plan de migration proposé

### Phase 1 — Tables structurelles (non-destructif)

**A. Créer `preference_tags`** — catalogue extensible de tags de préférence
```sql
CREATE TABLE preference_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'genre', 'platform', 'mood', 'duration', 'rating_threshold'
  key text NOT NULL,       -- 'action', 'netflix', 'short', etc.
  label text NOT NULL,     -- Libellé FR affiché
  metadata jsonb DEFAULT '{}',
  UNIQUE(category, key)
);
```

**B. Créer `user_preferences`** — préférences pondérées par tag
```sql
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES preference_tags(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN -100 AND 100),
  source text NOT NULL DEFAULT 'explicit', -- 'explicit', 'inferred', 'onboarding'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tag_id)
);
```

**C. Créer `catalog_items`** — table pivot unifiée films/séries/personnes
```sql
CREATE TABLE catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer NOT NULL,
  media_type text NOT NULL DEFAULT 'movie' CHECK (media_type IN ('movie','tv','person')),
  title text NOT NULL,
  poster_path text,
  vote_average numeric,
  popularity numeric,
  runtime integer,
  year integer,
  overview text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tmdb_id, media_type)
);
```

**D. Créer `catalog_item_tags`** — métadonnées extensibles par item
```sql
CREATE TABLE catalog_item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES preference_tags(id) ON DELETE CASCADE,
  weight numeric DEFAULT 1.0,
  UNIQUE(item_id, tag_id)
);
```

**E. Créer `user_item_feedback`** — feedback structuré et scoré
```sql
CREATE TABLE user_item_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('liked','disliked','watched','skipped','saved','unsaved','rejected')),
  score numeric CHECK (score BETWEEN -100 AND 100),
  label text,                    -- ex: 'rejected_too_long', 'post_watch_loved'
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id, action)
);
```

**F. Créer `recommendation_sessions`** — snapshot de chaque recherche
```sql
CREATE TABLE recommendation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'surprise',
  taste_snapshot jsonb DEFAULT '{}',    -- copie du profil au moment T
  filters_snapshot jsonb DEFAULT '{}',  -- filtres appliqués
  results jsonb DEFAULT '[]',           -- les 5 films retournés + scores
  created_at timestamptz DEFAULT now()
);
```

**G. Créer `recommendation_session_overrides`** — surcharges par session
```sql
CREATE TABLE recommendation_session_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES preference_tags(id) ON DELETE CASCADE,
  override_weight numeric NOT NULL CHECK (override_weight BETWEEN -100 AND 100),
  UNIQUE(session_id, tag_id)
);
```

### Phase 2 — Migration de données

- Backfill `catalog_items` depuis `movie_embeddings` + `liked_movies` + `watchlist`
- Backfill `user_preferences` depuis les colonnes de `profiles` (`favorite_genres` → tags genre avec weight +80, `excluded_genres` → weight -100, etc.)
- Backfill `user_item_feedback` depuis `user_interactions` + `liked_movies` + `watchlist`

### Phase 3 — Foreign keys sur tables existantes

Ajouter des FK sur les tables existantes qui n'en ont pas (approche prudente) :
- `liked_movies.user_id` → `auth.users(id) ON DELETE CASCADE`
- `watchlist.user_id` → `auth.users(id) ON DELETE CASCADE`
- `user_interactions.user_id` → `auth.users(id) ON DELETE CASCADE`
- `cinematic_profiles.user_id` → `auth.users(id) ON DELETE CASCADE`
- etc.

### Phase 4 — Nettoyage (différé, après migration du code)

- Supprimer les colonnes de préférences de `profiles` (une fois le code migré)
- Déprécier `liked_movies` et `watchlist` au profit de `user_item_feedback`

---

## 3. Risques et recommandations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| 15+ edge functions + code client lisent `profiles.favorite_genres` etc. | Cassure immédiate si on supprime les colonnes | Phase 4 différée, garder les colonnes en lecture seule pendant la transition |
| 1490 interactions à backfiller | Temps de migration | Script batch, pas de downtime |
| Pas de FK = orphelins existants possibles | Échec d'ajout de FK | Nettoyer les orphelins avant d'ajouter les FK |
| Code client utilise `tmdb_id` partout, pas `catalog_items.id` | Refactoring massif | Garder `tmdb_id` comme clé de lookup, utiliser `catalog_items` comme jointure |

---

## 4. Indexes recommandés

```sql
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_tag ON user_preferences(tag_id);
CREATE INDEX idx_catalog_items_tmdb ON catalog_items(tmdb_id, media_type);
CREATE INDEX idx_user_item_feedback_user ON user_item_feedback(user_id);
CREATE INDEX idx_user_item_feedback_item ON user_item_feedback(item_id);
CREATE INDEX idx_reco_sessions_user ON recommendation_sessions(user_id);
CREATE INDEX idx_catalog_item_tags_item ON catalog_item_tags(item_id);
```

---

## 5. Décision requise

Ce refactoring est **majeur** (7 nouvelles tables, migration de données, refactoring de tout le code client et des edge functions). Avant de lancer les migrations :

1. **Voulez-vous procéder en une seule phase** (tout d'un coup) ou **itérativement** (nouvelles tables d'abord, puis migration progressive du code) ?
2. **Voulez-vous fournir le schéma cible complet** (les sections `[PASTE ...]`) pour que je puisse faire un diff exact plutôt qu'une interprétation des principes ?
3. **Priorité** : Commencer par le catalogue unifié ? Les préférences tag-based ? Les sessions de recommandation ?

La migration itérative (Phase 1 → tester → Phase 2 → etc.) est fortement recommandée pour un projet en production avec 12 utilisateurs actifs.

