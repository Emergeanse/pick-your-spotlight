-- Fonction SECURITY DEFINER pour mettre à jour original_language et year
-- depuis un script externe avec la clé anon (bypass RLS pour ce seul usage).
-- Utilisée par le script de backfill backfill-original-language.ps1.

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

-- Autorise la clé anon et les utilisateurs authentifiés à appeler cette fonction
GRANT EXECUTE ON FUNCTION public.update_movie_language(integer, text, integer) TO anon, authenticated;
