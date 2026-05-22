-- ============================================================
-- DIAGNOSTIC PROFIL RÉEL : cbilleux@gmail.com
-- Simule exactement ce que surprise-personalized envoie au SQL.
-- Colle dans Supabase SQL Editor → Run. Lecture seule.
-- ============================================================

DO $$
DECLARE
  v_user_id        uuid;
  v_liked_genres   text[];
  v_min_rating     real;
  v_taste_vector   vector(32);
  v_exclude_ids    integer[];
  v_excluded_genres text[];
  v_liked_with_tv  text[];
  v_auto_excluded  text[];
  v_effective_excl text[];
  v_count_raw      bigint;
  v_count_filtered bigint;
  t_start          timestamptz;
  t_end            timestamptz;
BEGIN
  -- ── 1. Récupérer l'utilisateur ──
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cbilleux@gmail.com';
  RAISE NOTICE '=== USER: % ===', v_user_id;

  -- ── 2. Ses préférences de profil ──
  SELECT
    COALESCE(favorite_genres, '{}'),
    COALESCE(min_rating, 0)
  INTO v_liked_genres, v_min_rating
  FROM profiles WHERE id = v_user_id;
  RAISE NOTICE 'liked_genres (profil): %', v_liked_genres;
  RAISE NOTICE 'min_rating: %', v_min_rating;

  -- ── 3. Son vecteur de goût (stable) ──
  SELECT stable_taste_vector INTO v_taste_vector
  FROM user_taste_vectors WHERE user_id = v_user_id
  ORDER BY updated_at DESC LIMIT 1;
  RAISE NOTICE 'Taste vector: %', CASE WHEN v_taste_vector IS NOT NULL THEN 'OK (32 dims)' ELSE 'ABSENT — fallback only' END;

  -- ── 4. Films déjà interagis (exclus) ──
  SELECT ARRAY_AGG(DISTINCT ci.tmdb_id)
  INTO v_exclude_ids
  FROM user_item_feedback uif
  JOIN catalog_items ci ON ci.id = uif.item_id
  WHERE uif.user_id = v_user_id;
  v_exclude_ids := COALESCE(v_exclude_ids, '{}');
  RAISE NOTICE 'Films exclus (interagis): %', COALESCE(array_length(v_exclude_ids, 1), 0);

  -- ── 5. Expansion TV + auto-excluded (même logique que l'edge function) ──
  -- Liked avec équivalents TV
  v_liked_with_tv := v_liked_genres;
  IF 'Action'          = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['Action & Adventure']; END IF;
  IF 'Aventure'        = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['Action & Adventure']; END IF;
  IF 'Science-Fiction' = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['Science-Fiction & Fantastique','Sci-Fi & Fantasy']; END IF;
  IF 'Fantastique'     = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['Science-Fiction & Fantastique','Sci-Fi & Fantasy']; END IF;
  IF 'Animation'       = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['Kids']; END IF;
  IF 'Famille'         = ANY(v_liked_genres) OR 'Familial' = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['Kids','Famille','Familial']; END IF;
  IF 'Guerre'          = ANY(v_liked_genres) THEN v_liked_with_tv := v_liked_with_tv || ARRAY['War & Politics']; END IF;
  -- Déduplique
  SELECT ARRAY_AGG(DISTINCT g) INTO v_liked_with_tv FROM unnest(v_liked_with_tv) g;
  RAISE NOTICE 'liked_genres (avec TV): %', v_liked_with_tv;

  -- Auto-excluded = tout ce qui n'est pas dans liked_with_tv
  SELECT ARRAY_AGG(g) INTO v_auto_excluded
  FROM unnest(ARRAY[
    'Drame','Comédie','Action','Thriller','Animation','Crime','Aventure','Romance',
    'Mystère','Familial','Science-Fiction & Fantastique','Horreur','Action & Adventure',
    'Fantastique','Science-Fiction','Histoire','Guerre','Kids','Musique','Documentaire',
    'Western','Téléfilm','Reality','Soap','Sci-Fi & Fantasy','War & Politics','Famille',
    'Talk','News'
  ]) g
  WHERE NOT (g = ANY(v_liked_with_tv));
  RAISE NOTICE 'Auto-excluded genres (%): %', array_length(v_auto_excluded, 1), v_auto_excluded;

  v_effective_excl := v_auto_excluded;

  -- ── 6. Comptage sans vecteur (pour voir le pool dispo) ──
  SELECT COUNT(*) INTO v_count_raw
  FROM movie_embeddings
  WHERE NOT (tmdb_id = ANY(v_exclude_ids))
    AND (v_min_rating = 0 OR vote_average >= v_min_rating)
    AND NOT (genres && v_effective_excl)
    AND (array_length(v_liked_with_tv, 1) = 0 OR genres && v_liked_with_tv);
  RAISE NOTICE '=== Pool disponible (sans vecteur, tous filtres) : % films ===', v_count_raw;

  -- ── 7. Appel de la vraie fonction avec le vecteur ──
  IF v_taste_vector IS NOT NULL THEN
    t_start := clock_timestamp();
    SELECT COUNT(*) INTO v_count_filtered
    FROM match_movies_for_recommendation(
      query_vector    => v_taste_vector,
      match_count     => 100,
      exclude_ids     => v_exclude_ids,
      filter_media_type => NULL,
      min_rating      => v_min_rating,
      excluded_genres => v_effective_excl,
      liked_genres    => v_liked_with_tv
    );
    t_end := clock_timestamp();
    RAISE NOTICE 'match_movies_for_recommendation → % résultats en %ms',
      v_count_filtered,
      EXTRACT(MILLISECONDS FROM (t_end - t_start))::integer;
  END IF;

END $$;

-- ── 8. Les 50 films qui seraient sélectionnés (remplace les arrays manuellement si besoin) ──
-- Récupère le vecteur et les params directement depuis la DB pour afficher les vrais candidats
WITH params AS (
  SELECT
    u.id AS user_id,
    p.favorite_genres AS liked_genres,
    COALESCE(p.min_rating, 0) AS min_rating,
    utv.stable_taste_vector AS taste_vector,
    ARRAY(
      SELECT DISTINCT ci.tmdb_id
      FROM user_item_feedback uif
      JOIN catalog_items ci ON ci.id = uif.item_id
      WHERE uif.user_id = u.id
    ) AS exclude_ids
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  LEFT JOIN user_taste_vectors utv ON utv.user_id = u.id
  WHERE u.email = 'cbilleux@gmail.com'
  ORDER BY utv.updated_at DESC
  LIMIT 1
),
candidates AS (
  SELECT m.*
  FROM params,
  match_movies_for_recommendation(
    query_vector      => params.taste_vector,
    match_count       => 100,
    exclude_ids       => params.exclude_ids,
    filter_media_type => NULL,
    min_rating        => params.min_rating,
    -- Simplified: use liked_genres directly (TV expansion handled above in DO block)
    excluded_genres   => '{}',
    liked_genres      => params.liked_genres
  ) m
  WHERE params.taste_vector IS NOT NULL
  LIMIT 50
)
SELECT
  ROW_NUMBER() OVER (ORDER BY similarity DESC) AS rank,
  title,
  year,
  ROUND(vote_average::numeric, 1) AS note,
  ROUND((similarity * 100)::numeric, 1) AS similarite_pct,
  array_to_string(genres, ', ') AS genres,
  media_type
FROM candidates
ORDER BY similarity DESC;
