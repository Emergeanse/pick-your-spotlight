
-- ============ PROFILES ============
DROP POLICY IF EXISTS "Users can search profiles by friend_code" ON public.profiles;

-- Allow viewing accepted friends' profiles
CREATE POLICY "Users can view accepted friends profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = profiles.id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = profiles.id)
      )
  )
);

-- Allow viewing minimal info of pending friendship counterpart so requests show names
CREATE POLICY "Users can view pending friendship counterpart"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'pending'
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = profiles.id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = profiles.id)
      )
  )
);

-- Security-definer RPC to find a profile by friend code (returns minimal fields only)
CREATE OR REPLACE FUNCTION public.find_profile_by_friend_code(_code text)
RETURNS TABLE (id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.friend_code = upper(_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_profile_by_friend_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_by_friend_code(text) TO authenticated;

-- ============ GROUP SESSIONS ============
DROP POLICY IF EXISTS "Anyone can lookup session by invite_code" ON public.group_sessions;
DROP POLICY IF EXISTS "Authenticated can lookup session by invite_code" ON public.group_sessions;
-- Members/creators still have access via existing policies. Anonymous lookups happen via edge function (service role).

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============ ENGINE METRICS ============
DROP POLICY IF EXISTS "Service can insert engine metrics" ON public.engine_metrics;
CREATE POLICY "Admins can insert engine metrics"
ON public.engine_metrics
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ MOVIE EMBEDDINGS ============
DROP POLICY IF EXISTS "Service role can insert movie embeddings" ON public.movie_embeddings;
DROP POLICY IF EXISTS "Service role can update movie embeddings" ON public.movie_embeddings;
CREATE POLICY "Admins can insert movie embeddings"
ON public.movie_embeddings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update movie embeddings"
ON public.movie_embeddings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ AVATARS STORAGE: restrict listing to owner folder ============
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
-- Allow public READ of individual files (downloads via public URL still work) but no listing
CREATE POLICY "Public can read avatar files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
-- Note: bucket remains public for direct file URLs; listing requires auth and folder match

-- ============ REVOKE EXECUTE on internal trigger/helper functions ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_friend_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_friend_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_session_code() FROM PUBLIC, anon, authenticated;
