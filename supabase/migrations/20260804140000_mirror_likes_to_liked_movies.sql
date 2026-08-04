-- Réveille la recommandation vectorielle en reliant deux maillons cassés.
--
-- Constat
-- -------
-- L'application enregistre les « j'aime » dans user_interactions avec
-- action_type = 'liked'. Le moteur de goût, lui, construit le vecteur stable
-- depuis liked_movies et watchlist — deux tables que RIEN n'écrit dans tout le
-- projet. Le vecteur est donc nul pour tout le monde, et
-- surprise-personalized saute purement et simplement la recherche vectorielle :
--
--     vecteur de goût : ❌ NULL — SQL vectoriel sera sauté
--
-- Mesuré sur un compte réel : 196 interactions « liked » portant sur 101 films
-- distincts, dont 98 disposent déjà d'un embedding. Le signal existe, il n'est
-- simplement relié à rien.
--
-- Choix de conception
-- -------------------
-- On ne touche pas au moteur. On remplit la table qu'il lit déjà, plutôt que de
-- changer l'endroit où il regarde. Deux raisons :
--   - le pipeline de recommandation reste gelé ;
--   - le solo et les soirées de groupe lisent la même source, donc aucune
--     divergence possible entre les deux.
--
-- Le titre et les genres sont pris dans le contexte de l'interaction, que
-- l'application remplit déjà :
--     {"title":"Pacific Rim","genres":["Action","Science-Fiction"],...}
-- À défaut, on les cherche dans movie_embeddings puis dans catalog_items.
--
-- Note sur le score : insérer dans liked_movies déclenche trg_liked_movies_score,
-- qui recalcule user_movie_scores en comptant ce like au poids 1.0. Il existe
-- par ailleurs une faute dans _recompute_movie_score — le CASE teste 'like' au
-- singulier alors que l'application écrit 'liked' — mais il ne faut PAS la
-- corriger : le signal positif arrive désormais par liked_movies, et corriger le
-- CASE le compterait une seconde fois.

-- ── 1. Miroir : un « j'aime » alimente liked_movies ──────────────────────
CREATE OR REPLACE FUNCTION public._mirror_like_to_liked_movies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  text;
  v_genres text[];
BEGIN
  IF NEW.action_type = 'liked' THEN
    v_title := NULLIF(NEW.context->>'title', '');

    IF jsonb_typeof(NEW.context->'genres') = 'array' THEN
      v_genres := ARRAY(SELECT jsonb_array_elements_text(NEW.context->'genres'));
    ELSE
      v_genres := '{}'::text[];
    END IF;

    -- Contexte incomplet (les likes du parcours initiatique n'ont qu'une
    -- source) : on retrouve le titre dans le catalogue.
    IF v_title IS NULL THEN
      SELECT me.title, COALESCE(me.genres, '{}'::text[])
        INTO v_title, v_genres
        FROM public.movie_embeddings me
       WHERE me.tmdb_id = NEW.tmdb_id
       LIMIT 1;
    END IF;

    IF v_title IS NULL THEN
      SELECT ci.title INTO v_title
        FROM public.catalog_items ci
       WHERE ci.tmdb_id = NEW.tmdb_id
       LIMIT 1;
    END IF;

    -- Sans titre, la ligne serait invalide (colonne NOT NULL). On préfère
    -- ignorer ce like plutôt que d'inventer un intitulé.
    IF v_title IS NOT NULL THEN
      INSERT INTO public.liked_movies (user_id, tmdb_id, title, genres, liked_at)
      VALUES (NEW.user_id, NEW.tmdb_id, v_title, COALESCE(v_genres, '{}'::text[]), NEW.created_at)
      ON CONFLICT (user_id, tmdb_id) DO NOTHING;
    END IF;

  ELSIF NEW.action_type = 'unliked' THEN
    -- Un like retiré doit disparaître du vecteur, pas seulement peser négatif.
    DELETE FROM public.liked_movies
     WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_like_to_liked_movies ON public.user_interactions;

CREATE TRIGGER trg_mirror_like_to_liked_movies
  AFTER INSERT ON public.user_interactions
  FOR EACH ROW
  WHEN (NEW.action_type IN ('liked', 'unliked'))
  EXECUTE FUNCTION public._mirror_like_to_liked_movies();

COMMENT ON FUNCTION public._mirror_like_to_liked_movies() IS
  'Recopie les « j''aime » de user_interactions vers liked_movies, seule table lue par le moteur de goût.';

-- ── 2. Reprise de l'existant ─────────────────────────────────────────────
-- Volontairement limitée à l'appelant : chacun rattrape son propre historique.
-- Pour une reprise globale, exécuter la même requête sans le filtre user_id
-- depuis l'éditeur SQL — voir le commentaire en fin de fichier.
CREATE OR REPLACE FUNCTION public.backfill_liked_movies_from_interactions()
RETURNS TABLE(inseres bigint, sans_titre bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_inseres bigint := 0;
  v_sans bigint := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentification requise';
  END IF;

  WITH likes AS (
    -- Un film aimé plusieurs fois ne compte qu'une : on garde la date la plus
    -- ancienne, celle où le goût s'est exprimé.
    SELECT DISTINCT ON (ui.tmdb_id)
           ui.tmdb_id,
           ui.created_at,
           NULLIF(ui.context->>'title', '') AS ctx_title,
           CASE WHEN jsonb_typeof(ui.context->'genres') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(ui.context->'genres'))
                ELSE NULL END AS ctx_genres
      FROM public.user_interactions ui
     WHERE ui.user_id = v_user
       AND ui.action_type = 'liked'
       -- Un like ultérieurement retiré ne doit pas être ressuscité.
       AND NOT EXISTS (
         SELECT 1 FROM public.user_interactions u2
          WHERE u2.user_id = ui.user_id
            AND u2.tmdb_id = ui.tmdb_id
            AND u2.action_type = 'unliked'
            AND u2.created_at > ui.created_at
       )
     ORDER BY ui.tmdb_id, ui.created_at ASC
  ),
  resolus AS (
    SELECT l.tmdb_id,
           l.created_at,
           COALESCE(l.ctx_title, me.title, ci.title) AS title,
           COALESCE(l.ctx_genres, me.genres, '{}'::text[]) AS genres
      FROM likes l
      LEFT JOIN public.movie_embeddings me ON me.tmdb_id = l.tmdb_id
      LEFT JOIN public.catalog_items ci ON ci.tmdb_id = l.tmdb_id
  ),
  insertion AS (
    INSERT INTO public.liked_movies (user_id, tmdb_id, title, genres, liked_at)
    SELECT v_user, r.tmdb_id, r.title, r.genres, r.created_at
      FROM resolus r
     WHERE r.title IS NOT NULL
    ON CONFLICT (user_id, tmdb_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM insertion),
         (SELECT count(*) FROM resolus WHERE title IS NULL)
    INTO v_inseres, v_sans;

  RETURN QUERY SELECT v_inseres, v_sans;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_liked_movies_from_interactions() TO authenticated;

COMMENT ON FUNCTION public.backfill_liked_movies_from_interactions() IS
  'Rattrape l''historique de « j''aime » de l''appelant vers liked_movies. Idempotente.';

-- ── Reprise globale, à exécuter manuellement quand la qualité est validée ──
--
-- INSERT INTO public.liked_movies (user_id, tmdb_id, title, genres, liked_at)
-- SELECT DISTINCT ON (ui.user_id, ui.tmdb_id)
--        ui.user_id, ui.tmdb_id,
--        COALESCE(NULLIF(ui.context->>'title',''), me.title, ci.title),
--        COALESCE(me.genres, '{}'::text[]),
--        ui.created_at
--   FROM public.user_interactions ui
--   LEFT JOIN public.movie_embeddings me ON me.tmdb_id = ui.tmdb_id
--   LEFT JOIN public.catalog_items   ci ON ci.tmdb_id = ui.tmdb_id
--  WHERE ui.action_type = 'liked'
--    AND COALESCE(NULLIF(ui.context->>'title',''), me.title, ci.title) IS NOT NULL
--  ORDER BY ui.user_id, ui.tmdb_id, ui.created_at ASC
-- ON CONFLICT (user_id, tmdb_id) DO NOTHING;
