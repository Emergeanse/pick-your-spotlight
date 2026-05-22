-- Final SQL filter strategy:
-- 1. liked_genres uses && (overlap): movie must have AT LEAST ONE liked genre.
--    This is more permissive than <@ but works correctly for both movies and TV shows.
--    Non-liked genres are excluded via the excluded_genres parameter (computed in edge fn).
-- 2. min_rating excludes unrated movies (vote_average = 0) when a floor is set.
-- 3. probes=20 for better ANN coverage after filtering.
CREATE OR REPLACE FUNCTION public.match_movies_for_recommendation(
  query_vector vector(32),
  match_count integer DEFAULT 50,
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
    -- Exclude already-interacted movies
    NOT (me.tmdb_id = ANY(exclude_ids))
    -- Media type filter
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
    -- Minimum rating: when set, also exclude unrated movies (vote_average = 0)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    -- Explicitly excluded genres (includes non-liked genres computed by edge function)
    AND (cardinality(excluded_genres) = 0 OR NOT (me.genres && excluded_genres))
    -- At least one liked genre must be present
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
  ORDER BY me.embedding <=> query_vector
  LIMIT match_count;
END;
$$;
