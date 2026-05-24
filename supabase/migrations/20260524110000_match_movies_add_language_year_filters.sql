-- Move language and year filtering into SQL so the vector scan returns
-- only relevant candidates instead of filtering post-hoc (200 → 8).
--
-- New params:
--   p_original_language  text     exact language match for voice requests ("fr", "en", ...)
--   p_min_year           integer  lower bound for decade filter (e.g. 1980)
--   p_max_year           integer  upper bound for decade filter (e.g. 1989)
--   p_excluded_languages text[]   languages to hard-exclude (from user_preferences)

DROP FUNCTION IF EXISTS public.match_movies_for_recommendation(vector,integer,integer[],text,real,text[],text[],integer,uuid);

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
  p_excluded_languages text[] DEFAULT '{}'
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
  original_language text
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
    1 - (me.embedding <=> query_vector) AS similarity,
    me.original_language
  FROM public.movie_embeddings me
  WHERE
    NOT (me.tmdb_id = ANY(exclude_ids))
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    AND (cardinality(excluded_genres) = 0 OR NOT (me.genres && excluded_genres))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    AND (max_duration IS NULL OR me.media_type != 'movie' OR (me.runtime IS NOT NULL AND me.runtime <= max_duration))
    AND (p_original_language IS NULL OR me.original_language = p_original_language)
    AND (p_min_year IS NULL OR (me.year IS NOT NULL AND me.year >= p_min_year))
    AND (p_max_year IS NULL OR (me.year IS NOT NULL AND me.year <= p_max_year))
    AND (cardinality(p_excluded_languages) = 0 OR me.original_language IS NULL OR NOT (me.original_language = ANY(p_excluded_languages)))
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
