-- Ajout p_user_id + p_user_id2 à count_movie_candidates
-- Avant : le count ne tenait pas compte du JOIN DB sur user_item_feedback (p_user_id).
-- Après : available_after_exclusions reflète fidèlement ce que la cascade SQL trouvera.

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
  p_user_id2 uuid DEFAULT NULL
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
    AND (p_platform_ids IS NULL OR cardinality(p_platform_ids) = 0 OR me.platform_ids && p_platform_ids);
END;
$$;
