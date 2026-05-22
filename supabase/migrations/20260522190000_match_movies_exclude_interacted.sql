-- Exclude movies the user has already interacted with (feedback in user_item_feedback).
-- Adds p_user_id parameter; when NULL, the filter is skipped (anonymous / fallback).
CREATE OR REPLACE FUNCTION public.match_movies_for_recommendation(
  query_vector vector(32),
  match_count integer DEFAULT 50,
  exclude_ids integer[] DEFAULT '{}',
  filter_media_type text DEFAULT NULL,
  min_rating real DEFAULT 0,
  excluded_genres text[] DEFAULT '{}',
  liked_genres text[] DEFAULT '{}',
  max_duration integer DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
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
  similarity float
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  SET LOCAL ivfflat.probes = 20;

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
    1 - (me.embedding <=> query_vector) AS similarity
  FROM public.movie_embeddings me
  WHERE
    NOT (me.tmdb_id = ANY(exclude_ids))
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    AND (cardinality(excluded_genres) = 0 OR NOT (me.genres && excluded_genres))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    AND (max_duration IS NULL OR me.media_type != 'movie' OR (me.runtime IS NOT NULL AND me.runtime <= max_duration))
    -- Exclude movies the user has already interacted with (any feedback type)
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
