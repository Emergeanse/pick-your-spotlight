-- Index GIN sur les colonnes array pour le filtre && (AND ANY / overlap)
-- Ces index sont essentiels pour les filtres genres, cluster_labels et platform_ids
CREATE INDEX IF NOT EXISTS movie_embeddings_genres_gin_idx
  ON public.movie_embeddings USING GIN (genres);

CREATE INDEX IF NOT EXISTS movie_embeddings_cluster_labels_gin_idx
  ON public.movie_embeddings USING GIN (cluster_labels);

CREATE INDEX IF NOT EXISTS movie_embeddings_platform_ids_gin_idx
  ON public.movie_embeddings USING GIN (platform_ids);

-- Index B-tree sur year pour les filtres de plage (>= / <=)
CREATE INDEX IF NOT EXISTS movie_embeddings_year_idx
  ON public.movie_embeddings (year);

-- Index B-tree sur popularity pour le filtre >= p_min_popularity
CREATE INDEX IF NOT EXISTS movie_embeddings_popularity_idx
  ON public.movie_embeddings (popularity DESC NULLS LAST);

-- Index partiel sur runtime uniquement pour les films (media_type = 'movie')
-- Réduit la taille de l'index et accélère le filtre max_duration
CREATE INDEX IF NOT EXISTS movie_embeddings_runtime_movie_idx
  ON public.movie_embeddings (runtime)
  WHERE media_type = 'movie';

-- Index composite (media_type, year) pour les requêtes combinant les deux filtres
CREATE INDEX IF NOT EXISTS movie_embeddings_media_year_idx
  ON public.movie_embeddings (media_type, year);
