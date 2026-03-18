

## Plan: Inclure la watchlist dans le calcul du vecteur de gout

### Probleme
Actuellement, `computeUserTasteVector` ne prend en compte que les films "likes" (`liked_movies`). Les films mis en watchlist representent aussi un signal d'interet et devraient influencer le vecteur de gout — avec un poids plus faible que les likes.

### Changement

**Fichier unique: `src/lib/taste-engine.ts`**

Dans `computeUserTasteVector`:

1. **Recuperer la watchlist** en plus des liked_movies (requete sur `watchlist` filtree par `user_id`)
2. **Recuperer les embeddings** pour les tmdb_ids des deux sources (liked + watchlist, dedupliques)
3. **Ponderation differenciee**:
   - Liked movies: poids de base 1.0 (avec decroissance par recence comme aujourd'hui)
   - Watchlist items: poids de base **0.4** (signal d'interet plus faible qu'un like)
   - Si un film est dans les deux, seul le poids "liked" est utilise (pas de double comptage)
4. **Invalidation du cache**: comparer `liked_count + watchlist_count` au lieu de `liked_count` seul pour detecter les changements — renommer le champ conceptuellement (ou stocker la somme)

### Impact sur le groupe
L'edge function `group-recommend` (a venir) appellera `match_movies_by_taste` avec le vecteur utilisateur qui inclura deja ce signal watchlist — aucune modification supplementaire necessaire cote groupe.

### Details techniques
- Pas de migration DB necessaire — le champ `liked_count` dans `user_taste_vectors` stockera simplement `liked + watchlist count` pour invalider le cache
- La watchlist a deja les colonnes `tmdb_id`, `title`, `genres`, `user_id` necessaires
- Deduplication: construire un Set des tmdb_ids likes pour exclure les doublons de la watchlist

