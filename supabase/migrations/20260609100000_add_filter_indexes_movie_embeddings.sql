-- Index manquants pour optimiser les filtres WHERE de match_movies_for_recommendation
-- et count_movie_candidates.
--
-- Déjà existants : GIN(genres), GIN(platform_ids), GIN(cluster_labels),
--                  B-tree(year), B-tree(popularity), B-tree(media_type, year),
--                  partial(runtime) WHERE media_type='movie'
--
-- Nouveaux :

-- 1. original_language : filtres d'exclusion de langue (NOT ANY) et de langue préférée
--    Très sélectif — ~20 valeurs distinctes sur toute la table
CREATE INDEX IF NOT EXISTS movie_embeddings_original_language_idx
  ON public.movie_embeddings (original_language);

-- 2. vote_average : filtre min_rating (>= 6 par défaut)
--    Élimine rapidement les films mal notés sans scanner toute la table
CREATE INDEX IF NOT EXISTS movie_embeddings_vote_average_idx
  ON public.movie_embeddings (vote_average DESC NULLS LAST);

-- 3. genres[1] (premier genre) : filtre d'exclusion principal
--    NOT (me.genres[1] = ANY(excluded_genres)) — le GIN(genres) ne couvre pas
--    les lookups sur un élément précis du tableau
CREATE INDEX IF NOT EXISTS movie_embeddings_primary_genre_idx
  ON public.movie_embeddings ((genres[1]));

-- 4. (media_type, vote_average) composite : combinaison la plus fréquente
--    filter_media_type = 'movie' AND vote_average >= 6
CREATE INDEX IF NOT EXISTS movie_embeddings_media_vote_idx
  ON public.movie_embeddings (media_type, vote_average DESC NULLS LAST);

-- 5. (original_language, vote_average) composite : couverture des requêtes
--    qui filtrent à la fois sur la langue et la note (levels 0 et 1)
CREATE INDEX IF NOT EXISTS movie_embeddings_lang_vote_idx
  ON public.movie_embeddings (original_language, vote_average DESC NULLS LAST);
