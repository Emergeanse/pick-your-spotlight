
CREATE OR REPLACE FUNCTION public.match_movies_by_taste(
  query_vector vector(32),
  match_count integer DEFAULT 20,
  exclude_ids integer[] DEFAULT '{}'
)
RETURNS TABLE(tmdb_id integer, title text, taste_tags text[], similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    me.tmdb_id,
    me.title,
    me.taste_tags,
    1 - (me.embedding <=> query_vector) as similarity
  FROM public.movie_embeddings me
  WHERE NOT (me.tmdb_id = ANY(exclude_ids))
  ORDER BY me.embedding <=> query_vector
  LIMIT match_count;
$$;
