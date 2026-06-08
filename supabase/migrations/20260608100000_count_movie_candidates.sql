-- Fonction de comptage des candidats par niveau de contrainte
-- Utilisée pour le diagnostic du pipeline SQL : voir combien de films
-- correspondent aux filtres avant d'appliquer la similarité vectorielle.
-- Retourne : total en base (sans exclure l'historique) + disponibles (après exclusions).
CREATE OR REPLACE FUNCTION public.count_movie_candidates(
  filter_media_type text DEFAULT NULL,
  min_rating real DEFAULT 0,
  excluded_genres text[] DEFAULT '{}',
  liked_genres text[] DEFAULT '{}',
  max_duration integer DEFAULT NULL,
  p_excluded_languages text[] DEFAULT '{}',
  p_min_popularity real DEFAULT NULL,
  p_platform_ids integer[] DEFAULT NULL,
  exclude_ids integer[] DEFAULT '{}'
)
RETURNS TABLE(total_in_db bigint, available_after_exclusions bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT (me.tmdb_id = ANY(exclude_ids)))
  FROM public.movie_embeddings me
  WHERE
    (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    AND (cardinality(excluded_genres) = 0 OR me.genres IS NULL OR cardinality(me.genres) = 0
         OR NOT (me.genres[1] = ANY(excluded_genres)))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    AND (max_duration IS NULL OR me.media_type != 'movie' OR me.runtime IS NULL OR me.runtime <= max_duration)
    AND (cardinality(p_excluded_languages) = 0 OR me.original_language IS NULL OR NOT (me.original_language = ANY(p_excluded_languages)))
    AND (p_min_popularity IS NULL OR me.popularity IS NULL OR me.popularity >= p_min_popularity)
    AND (p_platform_ids IS NULL OR cardinality(p_platform_ids) = 0 OR me.platform_ids && p_platform_ids);
END;
$$;
