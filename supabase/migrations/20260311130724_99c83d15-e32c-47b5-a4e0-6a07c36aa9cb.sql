
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Movie embeddings cache table
CREATE TABLE public.movie_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer NOT NULL UNIQUE,
  title text NOT NULL,
  embedding vector(32) NOT NULL,
  taste_tags text[] NOT NULL DEFAULT '{}',
  genres text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast similarity search
CREATE INDEX movie_embeddings_embedding_idx ON public.movie_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for tmdb_id lookup
CREATE INDEX movie_embeddings_tmdb_id_idx ON public.movie_embeddings(tmdb_id);

-- RLS: public read (embeddings are not user-specific), authenticated write
ALTER TABLE public.movie_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read movie embeddings"
ON public.movie_embeddings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can insert movie embeddings"
ON public.movie_embeddings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can update movie embeddings"
ON public.movie_embeddings FOR UPDATE
TO authenticated
USING (true);

-- User taste vector: aggregated embedding per user
CREATE TABLE public.user_taste_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  taste_vector vector(32) NOT NULL,
  liked_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_taste_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own taste vector"
ON public.user_taste_vectors FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own taste vector"
ON public.user_taste_vectors FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own taste vector"
ON public.user_taste_vectors FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Function to compute cosine similarity between user and movie
CREATE OR REPLACE FUNCTION public.match_movies_by_taste(
  query_vector vector(32),
  match_count integer DEFAULT 20,
  exclude_ids integer[] DEFAULT '{}'
)
RETURNS TABLE(tmdb_id integer, title text, taste_tags text[], similarity float)
LANGUAGE sql
STABLE
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
