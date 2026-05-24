-- Fonctions SECURITY DEFINER pour le backfill original_language depuis un script local.
-- Utilisées par scripts/backfill-original-language.ps1 avec la clé anon.

-- 1. Lecture : retourne le prochain batch de films sans original_language
CREATE OR REPLACE FUNCTION public.get_movies_needing_language(p_limit integer DEFAULT 150)
RETURNS TABLE(tmdb_id integer, media_type text, year integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tmdb_id, media_type, year
  FROM public.movie_embeddings
  WHERE original_language IS NULL
  ORDER BY tmdb_id ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_movies_needing_language(integer) TO anon, authenticated;

-- 2. Écriture : met à jour original_language (et year si absent)
CREATE OR REPLACE FUNCTION public.update_movie_language(
  p_tmdb_id integer,
  p_original_language text,
  p_year integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.movie_embeddings
  SET
    original_language = p_original_language,
    year = COALESCE(p_year, year)
  WHERE tmdb_id = p_tmdb_id
    AND original_language IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_movie_language(integer, text, integer) TO anon, authenticated;
