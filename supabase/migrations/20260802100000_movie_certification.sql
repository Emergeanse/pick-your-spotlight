-- Certification d'âge des titres, pour filtrer une soirée selon son plus jeune
-- participant.
--
-- Pourquoi une colonne dédiée plutôt que les safety_tags existants : ces tags
-- sont produits en texte libre par l'IA d'indexation, sans vocabulaire imposé.
-- La base en contient 2 288 variantes distinctes ('violence_moderee',
-- 'violence_modérée', 'violence modérée', 'violence_mild'…), et la moitié du
-- catalogue n'en a aucune. Un filtre bâti dessus laisserait passer la moitié
-- des titres en les croyant inoffensifs.
--
-- La certification, elle, est une donnée factuelle de TMDB. On stocke le
-- niveau le plus restrictif entre les barèmes français et américain : la
-- France classe « tous publics » des films que les États-Unis interdisent aux
-- moins de 17 ans (Il faut sauver le soldat Ryan, Matrix, Whiplash), ce qui
-- est culturellement exact mais inutilisable pour protéger un enfant.
--
-- Échelle : 0 tous publics · 1 accompagnement conseillé · 2 dès 12 ans
--           3 dès 16 ans · 4 adultes.  NULL = inconnu, traité comme refusé
--           dès qu'une contrainte d'âge existe.

ALTER TABLE public.movie_embeddings
  ADD COLUMN IF NOT EXISTS certification_level   smallint,
  ADD COLUMN IF NOT EXISTS certification_source  text,
  ADD COLUMN IF NOT EXISTS certification_fr      text,
  ADD COLUMN IF NOT EXISTS certification_us      text,
  ADD COLUMN IF NOT EXISTS certification_checked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movie_embeddings_certification_level_check'
  ) THEN
    ALTER TABLE public.movie_embeddings
      ADD CONSTRAINT movie_embeddings_certification_level_check
      CHECK (certification_level IS NULL OR certification_level BETWEEN 0 AND 4);
  END IF;
END $$;

COMMENT ON COLUMN public.movie_embeddings.certification_level IS
  'Niveau 0-4, le plus restrictif entre France et États-Unis. NULL = inconnu.';
COMMENT ON COLUMN public.movie_embeddings.certification_source IS
  'fr, us ou fr+us — quel barème a déterminé le niveau retenu.';
COMMENT ON COLUMN public.movie_embeddings.certification_checked_at IS
  'Dernier passage de backfill-certification, y compris quand TMDB n''a rien renvoyé.';

-- Le filtre interroge « niveau <= plafond », en écartant les titres déjà vus.
CREATE INDEX IF NOT EXISTS idx_movie_embeddings_certification_level
  ON public.movie_embeddings (certification_level)
  WHERE certification_level IS NOT NULL;

-- Permet au backfill de reprendre là où il s'est arrêté sans retraiter.
CREATE INDEX IF NOT EXISTS idx_movie_embeddings_certification_checked
  ON public.movie_embeddings (certification_checked_at NULLS FIRST);
