-- 1. catalog_items: replace open insert with validated SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Authenticated users can create catalog items for feedback" ON public.catalog_items;

CREATE POLICY "Admins can create catalog items"
ON public.catalog_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_or_create_catalog_item(
  p_tmdb_id integer,
  p_media_type text DEFAULT 'movie',
  p_title text DEFAULT NULL,
  p_poster_path text DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_overview text DEFAULT NULL,
  p_vote_average numeric DEFAULT NULL,
  p_popularity numeric DEFAULT NULL,
  p_runtime integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_media_type text;
  v_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_tmdb_id IS NULL OR p_tmdb_id <= 0 OR p_tmdb_id > 100000000 THEN
    RAISE EXCEPTION 'invalid tmdb_id';
  END IF;

  v_media_type := COALESCE(p_media_type, 'movie');
  IF v_media_type NOT IN ('movie', 'tv', 'person') THEN
    RAISE EXCEPTION 'invalid media_type';
  END IF;

  SELECT id INTO v_id FROM public.catalog_items
   WHERE tmdb_id = p_tmdb_id AND media_type = v_media_type
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_title := left(btrim(COALESCE(p_title, '')), 300);
  IF length(v_title) = 0 THEN
    RAISE EXCEPTION 'title required';
  END IF;

  INSERT INTO public.catalog_items (
    tmdb_id, media_type, title, poster_path, year, overview, vote_average, popularity, runtime
  ) VALUES (
    p_tmdb_id, v_media_type, v_title,
    left(p_poster_path, 300),
    CASE WHEN p_year BETWEEN 1800 AND 2200 THEN p_year ELSE NULL END,
    left(p_overview, 5000),
    CASE WHEN p_vote_average BETWEEN 0 AND 10 THEN p_vote_average ELSE NULL END,
    CASE WHEN p_popularity >= 0 THEN p_popularity ELSE NULL END,
    CASE WHEN p_runtime BETWEEN 0 AND 100000 THEN p_runtime ELSE NULL END
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.catalog_items
     WHERE tmdb_id = p_tmdb_id AND media_type = v_media_type
     LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_catalog_item(integer, text, text, text, integer, text, numeric, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_catalog_item(integer, text, text, text, integer, text, numeric, numeric, integer) TO authenticated, service_role;

-- 2. event_participants: hide guest_email from client roles (column-level grants)
REVOKE SELECT ON public.event_participants FROM authenticated, anon;
GRANT SELECT (id, event_id, user_id, guest_token, guest_name, status, created_at, guest_age_range, guest_genres)
  ON public.event_participants TO authenticated;
GRANT ALL ON public.event_participants TO service_role;

-- 3. recommendation_events: allow users to delete their own history
CREATE POLICY "Users can delete own reco events"
ON public.recommendation_events FOR DELETE TO authenticated
USING (auth.uid() = user_id);