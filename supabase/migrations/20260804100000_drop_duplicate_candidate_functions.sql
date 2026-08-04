-- Supprime les anciennes signatures restées en place après 20260803120000.
--
-- Le DROP de cette migration visait une signature écrite à la main, reprise du
-- dépôt. La fonction réellement présente en base devait différer — un paramètre
-- de plus, un type différent — si bien que le DROP n'a rien trouvé et que le
-- CREATE a produit une SURCHARGE au lieu d'un remplacement.
--
-- Conséquence observée en production : tout appel qui ne passe pas
-- p_max_certification_level devient ambigu entre les deux versions et échoue
-- avec « PGRST203 Could not choose the best candidate function ».
--
-- On ne peut donc pas se fier à une signature écrite d'avance. Ici on énumère
-- ce qui existe réellement dans pg_proc et on supprime tout sauf la version
-- attendue, identifiée par son nombre d'arguments.

DO $$
DECLARE
  r record;
  gardees int := 0;
  supprimees int := 0;
BEGIN
  -- match_movies_for_recommendation : la bonne version a 18 arguments
  FOR r IN
    SELECT p.oid::regprocedure AS signature, p.pronargs
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'match_movies_for_recommendation'
  LOOP
    IF r.pronargs = 18 THEN
      gardees := gardees + 1;
    ELSE
      EXECUTE format('DROP FUNCTION %s', r.signature);
      supprimees := supprimees + 1;
      RAISE NOTICE 'Supprimée : %', r.signature;
    END IF;
  END LOOP;

  -- count_movie_candidates : la bonne version a 12 arguments
  FOR r IN
    SELECT p.oid::regprocedure AS signature, p.pronargs
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'count_movie_candidates'
  LOOP
    IF r.pronargs = 12 THEN
      gardees := gardees + 1;
    ELSE
      EXECUTE format('DROP FUNCTION %s', r.signature);
      supprimees := supprimees + 1;
      RAISE NOTICE 'Supprimée : %', r.signature;
    END IF;
  END LOOP;

  RAISE NOTICE 'Bilan : % version(s) conservée(s), % supprimée(s)', gardees, supprimees;

  IF gardees <> 2 THEN
    RAISE EXCEPTION
      'Attendu 1 version de chaque fonction (18 et 12 arguments), % trouvée(s). '
      'Vérifier l''état de pg_proc avant de continuer.', gardees;
  END IF;
END $$;

-- Les GRANT sont reposés : un DROP sur une surcharge n'affecte pas la version
-- conservée, mais on s'assure ici que les droits sont bien en place.
GRANT EXECUTE ON FUNCTION public.match_movies_for_recommendation(
  vector,integer,integer[],text,real,text[],text[],integer,uuid,text,integer,integer,text[],text[],real,integer[],uuid,smallint
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.count_movie_candidates(
  text,real,text[],text[],integer,text[],real,integer[],integer[],uuid,uuid,smallint
) TO anon, authenticated, service_role;
