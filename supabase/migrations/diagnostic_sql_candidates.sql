-- ============================================================
-- DIAGNOSTIC : Qualité des candidats SQL pour cbilleux@gmail.com
-- Colle ce script dans Supabase SQL Editor et exécute-le.
-- Il ne modifie rien — lecture seule.
-- ============================================================

-- ÉTAPE 0 : Récupère l'user_id et les préférences
DO $$
DECLARE
  v_user_id uuid;
  v_liked_genres text[];
  v_min_rating real;
  v_total_movies bigint;
  v_with_overlap bigint;
  v_strict_contained bigint;
  v_strict_with_rating bigint;
  v_excluded_ids_count bigint;
BEGIN
  -- Trouve l'utilisateur
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cbilleux@gmail.com';
  RAISE NOTICE 'user_id: %', v_user_id;

  -- Ses genres aimés (depuis profiles.favorite_genres)
  SELECT favorite_genres, min_rating
  INTO v_liked_genres, v_min_rating
  FROM profiles WHERE id = v_user_id;
  RAISE NOTICE 'liked_genres: %', v_liked_genres;
  RAISE NOTICE 'min_rating: %', v_min_rating;

  -- Nombre de films exclus (déjà interagis)
  SELECT COUNT(DISTINCT ci.tmdb_id) INTO v_excluded_ids_count
  FROM user_item_feedback uif
  JOIN catalog_items ci ON ci.id = uif.item_id
  WHERE uif.user_id = v_user_id;
  RAISE NOTICE 'Films déjà interagis (exclus): %', v_excluded_ids_count;

  -- Total films dans movie_embeddings
  SELECT COUNT(*) INTO v_total_movies FROM movie_embeddings;
  RAISE NOTICE '--- movie_embeddings total: % films ---', v_total_movies;

  -- Filtre 1 : au moins 1 genre aimé (&&)
  SELECT COUNT(*) INTO v_with_overlap
  FROM movie_embeddings
  WHERE genres && v_liked_genres;
  RAISE NOTICE 'Filtre && (au moins 1 genre aimé): %', v_with_overlap;

  -- Filtre 2 : TOUS les genres dans liked (<@)
  SELECT COUNT(*) INTO v_strict_contained
  FROM movie_embeddings
  WHERE genres <@ v_liked_genres;
  RAISE NOTICE 'Filtre <@ (strictement genres aimés): %', v_strict_contained;

  -- Filtre 3 : strict + note min
  SELECT COUNT(*) INTO v_strict_with_rating
  FROM movie_embeddings
  WHERE genres <@ v_liked_genres
    AND (v_min_rating = 0 OR vote_average >= v_min_rating);
  RAISE NOTICE 'Filtre strict + note >= %: % films', v_min_rating, v_strict_with_rating;

END $$;

-- ÉTAPE 1 : Distribution des genres dans movie_embeddings
SELECT
  unnest(genres) AS genre,
  COUNT(*) AS nb_films
FROM movie_embeddings
GROUP BY genre
ORDER BY nb_films DESC;
