-- match_movies_explicit : fallback SQL sans vecteur
-- Appelée quand la recherche vectorielle ne trouve pas assez de candidats.
-- Trie par note + popularité (pas de cosinus). Même signature de retour que
-- match_movies_for_recommendation pour être transparente dans le pipeline.

CREATE OR REPLACE FUNCTION public.match_movies_explicit(
  match_count          integer     DEFAULT 50,
  exclude_ids          integer[]   DEFAULT '{}',
  filter_media_type    text        DEFAULT NULL,
  min_rating           real        DEFAULT 0,
  excluded_genres      text[]      DEFAULT '{}',
  liked_genres         text[]      DEFAULT '{}',
  max_duration         integer     DEFAULT NULL,
  p_user_id            uuid        DEFAULT NULL,
  p_excluded_languages text[]      DEFAULT '{}',
  p_platform_ids       integer[]   DEFAULT NULL,
  p_user_id2           uuid        DEFAULT NULL
)
RETURNS TABLE(
  tmdb_id          integer,
  title            text,
  genres           text[],
  taste_tags       text[],
  cluster_labels   text[],
  vote_average     real,
  year             text,
  media_type       text,
  popularity       real,
  similarity       float,   -- score qualité normalisé (remplace cosinus)
  original_language text,
  platform_ids     integer[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
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
    -- Score normalisé 0..1 : 70% note, 30% popularité (plafonnée à 500)
    ((COALESCE(me.vote_average, 0) / 10.0) * 0.7
     + LEAST(COALESCE(me.popularity, 0), 500.0) / 500.0 * 0.3)::float AS similarity,
    me.original_language,
    me.platform_ids
  FROM public.movie_embeddings me
  WHERE
    NOT (me.tmdb_id = ANY(exclude_ids))
    AND (filter_media_type IS NULL OR me.media_type = filter_media_type)
    AND (min_rating = 0 OR me.vote_average >= min_rating)
    -- excluded_genres : on vérifie genres[1] comme match_movies_for_recommendation
    AND (cardinality(excluded_genres) = 0
         OR me.genres IS NULL OR cardinality(me.genres) = 0
         OR NOT (me.genres[1] = ANY(excluded_genres)))
    AND (cardinality(liked_genres) = 0 OR me.genres && liked_genres)
    AND (max_duration IS NULL
         OR me.media_type != 'movie'
         OR me.runtime IS NULL
         OR me.runtime <= max_duration)
    AND (cardinality(p_excluded_languages) = 0
         OR me.original_language IS NULL
         OR NOT (me.original_language = ANY(p_excluded_languages)))
    -- plateforme toujours vérifiée
    AND (p_platform_ids IS NULL
         OR cardinality(p_platform_ids) = 0
         OR me.platform_ids && p_platform_ids)
    -- exclusion DB utilisateur principal (not_for_me / dislike / seen)
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_item_feedback uif
      JOIN public.catalog_items ci ON ci.id = uif.item_id
      WHERE uif.user_id = p_user_id
        AND ci.tmdb_id = me.tmdb_id
        AND (uif.action      IN ('not_for_me', 'dislike', 'seen')
          OR uif.feedback_type IN ('not_for_me', 'dislike', 'seen'))
    ))
    -- exclusion DB partenaire duo (not_for_me / dislike uniquement)
    AND (p_user_id2 IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_item_feedback uif2
      JOIN public.catalog_items ci2 ON ci2.id = uif2.item_id
      WHERE uif2.user_id = p_user_id2
        AND ci2.tmdb_id = me.tmdb_id
        AND (uif2.action      IN ('not_for_me', 'dislike')
          OR uif2.feedback_type IN ('not_for_me', 'dislike'))
    ))
  ORDER BY me.vote_average DESC, me.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;
