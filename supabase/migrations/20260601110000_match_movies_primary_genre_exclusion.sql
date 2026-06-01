-- Filtre excluded_genres : exclure uniquement si le genre interdit est le genre PRINCIPAL (genres[1])
-- Avant : NOT (me.genres && excluded_genres) → excluait tout film ayant le genre, même en secondaire
-- Après : NOT (me.genres[1] = ANY(excluded_genres)) → garde les films où le genre exclu est secondaire
-- Exemple : "Drame, Comédie" passe si Comédie est exclu ; "Comédie, Drame" est exclu.

DROP FUNCTION IF EXISTS public.match_movies_for_recommendation(vector,integer,integer[],text,real,text[],text[],integer,uuid,text,integer,integer,text[],text[],real,integer[]);

CREATE OR REPLACE FUNCTION public.match_movies_for_recommendation(
  query_vector vector(32),
  match_count integer DEFAULT 50,
  exclude_ids integer[] DEFAULT '{}',
  filter_media_type text DEFAULT NULL,
  min_rating real DEFAULT 0,
  excluded_genres text[] DEFAULT '{}',
  liked_genres text[] DEFAULT '{}',
  max_duration integer DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_original_language text DEFAULT NULL,
  p_min_year integer DEFAULT NULL,
  p_max_year integer DEFAULT NULL,
  p_excluded_languages text[] DEFAULT '{}',
  p_excluded_clusters text[] DEFAULT '{}',
  p_min_popularity real DEFAULT NULL,
  p_platform_ids integer[] DEFAULT NULL
)
RETURNS TABLE(
  tmdb_id integer,
  title text,
  genres text[],
  taste_tags text[],
  cluster_labels text[],
  vote_average real,
  year text,
  media_type text,
  popularity real,
  similarity float,
  original_language text,
  platform_ids integer[]
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  SET LOCAL ivfflat.probes = 60;

  RETURN QUERY
  SELECT
    me.tmdb_id,
    me.title,
    me.genres,
    me.taste_tags,
    me.cluster_labels,
    me.vote_average::real,
    me.year::text,
    me.media_type,
    me.popularity::real,
    1 - (me.embedding <=> query_vector) AS similarity,
    me.original_language,
    me.platform_ids
  FROM public.movie_embeddings me
  WHERE
    NOT (me.tmdb_id = ANY(exclude_ids))
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    -- Exclusion sur le genre PRINCIPAL uniquement (genres[1]) — les genres secondaires sont tolérés
    AND (cardinality(excluded_genres) = 0 OR me.genres IS NULL OR cardinality(me.genres) = 0
         OR NOT (me.genres[1] = ANY(excluded_genres)))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    -- runtime IS NULL means unknown → optimistic pass; only exclude films with known runtime > max
    AND (max_duration IS NULL OR me.media_type != 'movie' OR me.runtime IS NULL OR me.runtime <= max_duration)
    AND (p_original_language IS NULL OR me.original_language = p_original_language)
    AND (p_min_year IS NULL OR (me.year IS NOT NULL AND me.year >= p_min_year))
    AND (p_max_year IS NULL OR (me.year IS NOT NULL AND me.year <= p_max_year))
    AND (cardinality(p_excluded_languages) = 0 OR me.original_language IS NULL OR NOT (me.original_language = ANY(p_excluded_languages)))
    AND (cardinality(p_excluded_clusters) = 0 OR me.cluster_labels IS NULL OR NOT (me.cluster_labels && p_excluded_clusters))
    AND (p_min_popularity IS NULL OR me.popularity IS NULL OR me.popularity >= p_min_popularity)
    AND (p_platform_ids IS NULL OR cardinality(p_platform_ids) = 0 OR me.platform_ids && p_platform_ids)
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_item_feedback uif
      JOIN public.catalog_items ci ON ci.id = uif.item_id
      WHERE uif.user_id = p_user_id
        AND ci.tmdb_id = me.tmdb_id
    ))
  ORDER BY me.embedding <=> query_vector
  LIMIT match_count;
END;
$$;
