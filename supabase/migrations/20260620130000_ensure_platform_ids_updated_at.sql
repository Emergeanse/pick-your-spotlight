-- Rattrapage : s'assurer que la colonne platform_ids_updated_at existe
-- (migration 20260613 non appliquée en production)

ALTER TABLE public.movie_embeddings
  ADD COLUMN IF NOT EXISTS platform_ids_updated_at timestamptz;

UPDATE public.movie_embeddings
SET platform_ids_updated_at = NOW() - INTERVAL '31 days'
WHERE platform_ids IS NOT NULL
  AND array_length(platform_ids, 1) > 0
  AND platform_ids_updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_movie_embeddings_platform_stale
  ON public.movie_embeddings (platform_ids_updated_at NULLS FIRST, popularity DESC NULLS LAST);
