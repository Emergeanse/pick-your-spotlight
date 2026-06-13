-- Colonne de traçabilité pour le drift-refresh des platform_ids
-- Permet de cibler en priorité les films dont les plateformes n'ont pas été
-- vérifiées depuis plus de 30 jours (ou jamais).

ALTER TABLE public.movie_embeddings
  ADD COLUMN IF NOT EXISTS platform_ids_updated_at timestamptz;

-- Marquer tous les films qui ont déjà des platform_ids comme "initialisés"
-- (date arbitraire dans le passé pour qu'ils soient éligibles au refresh).
UPDATE public.movie_embeddings
SET platform_ids_updated_at = NOW() - INTERVAL '31 days'
WHERE platform_ids IS NOT NULL AND array_length(platform_ids, 1) > 0;

-- Index pour requêter efficacement les films les plus stales en priorité
CREATE INDEX IF NOT EXISTS idx_movie_embeddings_platform_stale
  ON public.movie_embeddings (platform_ids_updated_at NULLS FIRST, popularity DESC NULLS LAST);
