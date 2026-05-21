-- Performance improvements for the retrieve→rerank pipeline.
--
-- 1. Rebuild IVFFlat index with more lists (dataset now ~14K+ rows, growing to 50K+).
--    Rule of thumb: lists ≈ sqrt(rows). 100→150 improves recall and speed.
--    When rows exceed 50K, consider rebuilding with lists=250 or switching to HNSW.
--
-- 2. Add media_type index to speed up filtered queries (movie vs tv).
--
-- 3. Update match_movies_for_recommendation to set ivfflat.probes=10 (10% of lists)
--    so the ANN search scans enough clusters for good recall.

-- Rebuild IVFFlat with more lists (drop + recreate is required to change lists)
DROP INDEX IF EXISTS public.movie_embeddings_embedding_idx;

CREATE INDEX movie_embeddings_embedding_idx ON public.movie_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 150);

-- Fast filter on media_type (used in every retrieve→rerank query)
CREATE INDEX IF NOT EXISTS movie_embeddings_media_type_idx
ON public.movie_embeddings (media_type);

-- Compound index: media_type + vote_average for future filtered queries
CREATE INDEX IF NOT EXISTS movie_embeddings_media_rating_idx
ON public.movie_embeddings (media_type, vote_average DESC);

-- Update the RPC function to use probes=10 for better ANN recall
CREATE OR REPLACE FUNCTION public.match_movies_for_recommendation(
  query_vector vector(32),
  match_count integer DEFAULT 30,
  exclude_ids integer[] DEFAULT '{}',
  filter_media_type text DEFAULT NULL
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
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Scan 10% of IVFFlat lists for good recall/speed balance.
  -- Increase to 20 if result quality degrades as dataset grows.
  SET LOCAL ivfflat.probes = 10;

  RETURN QUERY
  SELECT
    me.tmdb_id,
    me.title,
    me.genres,
    me.taste_tags,
    me.cluster_labels,
    me.vote_average::real,
    me.year,
    me.media_type,
    me.popularity::real,
    1 - (me.embedding <=> query_vector) AS similarity
  FROM public.movie_embeddings me
  WHERE
    NOT (me.tmdb_id = ANY(exclude_ids))
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
  ORDER BY me.embedding <=> query_vector
  LIMIT match_count;
END;
$$;
