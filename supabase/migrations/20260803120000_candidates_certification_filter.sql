-- Filtre d'âge en amont de la sélection des candidats.
--
-- On filtre AVANT le tri par similarité plutôt qu'après : écarter les titres
-- interdits une fois les candidats remontés gaspillerait une partie du vivier
-- et pourrait rendre moins de films que demandé.
--
-- Le paramètre est ajouté EN DERNIER et vaut NULL par défaut : sans contrainte
-- d'âge — soirée solo, duo, ou groupe sans enfant déclaré — le comportement
-- est strictement inchangé.
--
-- Règle prudente, alignée sur _shared/certification.ts : quand une contrainte
-- existe, un titre SANS certification connue est écarté. 18 % du catalogue est
-- dans ce cas ; rien ne dit que ces titres sont inoffensifs. Le vivier reste
-- confortable — 3 815 titres accessibles à un enfant, 7 604 à un pré-ado.
--
-- Les deux fonctions sont modifiées ensemble : count_movie_candidates sert à
-- décider des paliers de la cascade, ses comptages doivent porter sur le même
-- ensemble que match_movies_for_recommendation, sinon la cascade raisonnerait
-- sur un vivier qui n'existe pas.
--
-- DROP avant CREATE : ajouter un paramètre à valeur par défaut créerait une
-- surcharge, et tout appel existant deviendrait ambigu entre les deux versions.

-- ── 1. Sélection des candidats ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.match_movies_for_recommendation(
  vector,integer,integer[],text,real,text[],text[],integer,uuid,text,integer,integer,text[],text[],real,integer[],uuid
);

CREATE OR REPLACE FUNCTION public.match_movies_for_recommendation(
  query_vector vector(32),
  match_count integer DEFAULT 50,
  exclude_ids integer[] DEFAULT '{}',
  filter_media_type text DEFAULT NULL,
  min_rating real DEFAULT 0,
  excluded_genres text[] DEFAULT '{}',
  liked_genres text[] DEFAULT '{}',
  max_duration integer DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_original_language text DEFAULT NULL,
  p_min_year integer DEFAULT NULL,
  p_max_year integer DEFAULT NULL,
  p_excluded_languages text[] DEFAULT '{}',
  p_excluded_clusters text[] DEFAULT '{}',
  p_min_popularity real DEFAULT NULL,
  p_platform_ids integer[] DEFAULT NULL,
  p_user_id2 uuid DEFAULT NULL,
  p_max_certification_level smallint DEFAULT NULL
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
  similarity float,
  original_language text,
  platform_ids integer[]
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  SET LOCAL ivfflat.probes = 60;

  RETURN QUERY
  SELECT
    me.tmdb_id,
    me.title,
    me.genres,
    me.taste_tags,
    me.cluster_labels,
    me.vote_average::real,
    me.year::text,
    me.media_type,
    me.popularity::real,
    1 - (me.embedding <=> query_vector) AS similarity,
    me.original_language,
    me.platform_ids
  FROM public.movie_embeddings me
  WHERE
    NOT (me.tmdb_id = ANY(exclude_ids))
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    AND (cardinality(excluded_genres) = 0 OR me.genres IS NULL OR cardinality(me.genres) = 0
         OR NOT (me.genres[1] = ANY(excluded_genres)))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    AND (max_duration IS NULL OR me.media_type != 'movie' OR me.runtime IS NULL OR me.runtime <= max_duration)
    AND (p_original_language IS NULL OR me.original_language = p_original_language)
    AND (p_min_year IS NULL OR (me.year IS NOT NULL AND me.year >= p_min_year))
    AND (p_max_year IS NULL OR (me.year IS NOT NULL AND me.year <= p_max_year))
    AND (cardinality(p_excluded_languages) = 0 OR me.original_language IS NULL OR NOT (me.original_language = ANY(p_excluded_languages)))
    AND (cardinality(p_excluded_clusters) = 0 OR me.cluster_labels IS NULL OR NOT (me.cluster_labels && p_excluded_clusters))
    AND (p_min_popularity IS NULL OR me.popularity IS NULL OR me.popularity >= p_min_popularity)
    AND (p_platform_ids IS NULL OR cardinality(p_platform_ids) = 0 OR me.platform_ids && p_platform_ids)
    -- Contrainte d'âge : sans plafond on ne filtre rien ; avec plafond, un
    -- titre sans certification connue est écarté.
    AND (p_max_certification_level IS NULL
         OR (me.certification_level IS NOT NULL
             AND me.certification_level <= p_max_certification_level))
    -- Exclure uniquement les films explicitement rejetés (rouge) — pas les vus/likés/skippés
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_item_feedback uif
      JOIN public.catalog_items ci ON ci.id = uif.item_id
      WHERE uif.user_id = p_user_id
        AND ci.tmdb_id = me.tmdb_id
        AND (uif.action IN ('not_for_me', 'dislike', 'seen') OR uif.feedback_type IN ('not_for_me', 'dislike', 'seen'))
    ))
    -- Exclure les films rejetés par le partenaire du duo (p_user_id2)
    AND (p_user_id2 IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_item_feedback uif2
      JOIN public.catalog_items ci2 ON ci2.id = uif2.item_id
      WHERE uif2.user_id = p_user_id2
        AND ci2.tmdb_id = me.tmdb_id
        AND (uif2.action IN ('not_for_me', 'dislike') OR uif2.feedback_type IN ('not_for_me', 'dislike'))
    ))
  ORDER BY me.embedding <=> query_vector
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_movies_for_recommendation(
  vector,integer,integer[],text,real,text[],text[],integer,uuid,text,integer,integer,text[],text[],real,integer[],uuid,smallint
) TO anon, authenticated, service_role;

-- ── 2. Comptage des candidats (paliers de la cascade) ────────────────────
DROP FUNCTION IF EXISTS public.count_movie_candidates(
  text,real,text[],text[],integer,text[],real,integer[],integer[],uuid,uuid
);

CREATE OR REPLACE FUNCTION public.count_movie_candidates(
  filter_media_type text DEFAULT NULL,
  min_rating real DEFAULT 0,
  excluded_genres text[] DEFAULT '{}',
  liked_genres text[] DEFAULT '{}',
  max_duration integer DEFAULT NULL,
  p_excluded_languages text[] DEFAULT '{}',
  p_min_popularity real DEFAULT NULL,
  p_platform_ids integer[] DEFAULT NULL,
  exclude_ids integer[] DEFAULT '{}',
  p_user_id uuid DEFAULT NULL,
  p_user_id2 uuid DEFAULT NULL,
  p_max_certification_level smallint DEFAULT NULL
)
RETURNS TABLE(total_in_db bigint, available_after_exclusions bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE
        NOT (me.tmdb_id = ANY(exclude_ids))
        AND (p_user_id IS NULL OR NOT EXISTS (
          SELECT 1
          FROM public.user_item_feedback uif
          JOIN public.catalog_items ci ON ci.id = uif.item_id
          WHERE uif.user_id = p_user_id
            AND ci.tmdb_id = me.tmdb_id
            AND (uif.action IN ('not_for_me', 'dislike', 'seen') OR uif.feedback_type IN ('not_for_me', 'dislike', 'seen'))
        ))
        AND (p_user_id2 IS NULL OR NOT EXISTS (
          SELECT 1
          FROM public.user_item_feedback uif2
          JOIN public.catalog_items ci2 ON ci2.id = uif2.item_id
          WHERE uif2.user_id = p_user_id2
            AND ci2.tmdb_id = me.tmdb_id
            AND (uif2.action IN ('not_for_me', 'dislike', 'seen') OR uif2.feedback_type IN ('not_for_me', 'dislike', 'seen'))
        ))
    )
  FROM public.movie_embeddings me
  WHERE
    (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    AND (cardinality(excluded_genres) = 0 OR NOT (me.genres && excluded_genres))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    AND (max_duration IS NULL OR me.media_type != 'movie' OR me.runtime IS NULL OR me.runtime <= max_duration)
    AND (cardinality(p_excluded_languages) = 0 OR me.original_language IS NULL OR NOT (me.original_language = ANY(p_excluded_languages)))
    AND (p_min_popularity IS NULL OR me.popularity IS NULL OR me.popularity >= p_min_popularity)
    AND (p_platform_ids IS NULL OR cardinality(p_platform_ids) = 0 OR me.platform_ids && p_platform_ids)
    AND (p_max_certification_level IS NULL
         OR (me.certification_level IS NOT NULL
             AND me.certification_level <= p_max_certification_level));
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_movie_candidates(
  text,real,text[],text[],integer,text[],real,integer[],integer[],uuid,uuid,smallint
) TO anon, authenticated, service_role;
