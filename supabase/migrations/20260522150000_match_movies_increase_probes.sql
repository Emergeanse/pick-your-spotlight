-- Increase IVFFlat probes from 10 to 20 so the ANN scan covers more candidates
-- before the liked_genres / excluded_genres / min_rating WHERE filters are applied.
-- At probes=10 with lists=150, roughly 6.7% of vectors are scanned; at probes=20 ~13%.
-- This ensures genre-filtered queries consistently return the requested match_count.
CREATE OR REPLACE FUNCTION public.match_movies_for_recommendation(
  query_vector vector(32),
  match_count integer DEFAULT 30,
  exclude_ids integer[] DEFAULT '{}',
  filter_media_type text DEFAULT NULL,
  min_rating real DEFAULT 0,
  excluded_genres text[] DEFAULT '{}',
  liked_genres text[] DEFAULT '{}'
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
    AND (min_rating = 0 OR me.vote_average = 0 OR me.vote_average >= min_rating)
    AND (cardinality(excluded_genres) = 0 OR NOT (me.genres && excluded_genres))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
  ORDER BY me.embedding <=> query_vector
  LIMIT match_count;
END;
$$;
