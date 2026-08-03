-- Conserve les `suitability_tags` d'origine avant normalisation.
--
-- Le champ a longtemps été écrit en texte libre par l'IA d'indexation :
-- 320 valeurs distinctes pour sept notions, avec des fautes de frappe
-- (« adolecents »), de l'anglais et de l'espagnol (« friends », « amigos »,
-- « pareja ») et des compositions (« famille_pere_fils_ados »).
--
-- backfill-suitability réécrit `suitability_tags` sur le vocabulaire fermé
-- (solo, couple, amis, famille, enfants, adolescents, adultes) et dépose ici
-- la valeur d'origine. La normalisation reste ainsi rejouable si le
-- vocabulaire évolue, et rien n'est perdu si une correspondance se révèle
-- mauvaise.
--
-- La colonne sert aussi de marqueur d'avancement : NULL = pas encore traité.

ALTER TABLE public.movie_embeddings
  ADD COLUMN IF NOT EXISTS suitability_tags_raw text[];

COMMENT ON COLUMN public.movie_embeddings.suitability_tags_raw IS
  'Valeur d''origine de suitability_tags avant normalisation. NULL = titre pas encore traité.';

CREATE INDEX IF NOT EXISTS idx_movie_embeddings_suitability_raw_pending
  ON public.movie_embeddings (tmdb_id)
  WHERE suitability_tags_raw IS NULL;
