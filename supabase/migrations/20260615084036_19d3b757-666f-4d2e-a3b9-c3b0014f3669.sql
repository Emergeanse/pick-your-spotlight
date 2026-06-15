
-- 1. Pending duo: drop overbroad policy, add secure RPC for invite-code lookup
DROP POLICY IF EXISTS "Any authenticated user can view pending duo by invite code" ON public.duo_taste_profiles;

CREATE OR REPLACE FUNCTION public.get_pending_duo_by_invite_code(_code text)
RETURNS TABLE(
  id uuid,
  duo_name text,
  created_by uuid,
  user1_id uuid,
  status text,
  user1_display_name text,
  user1_genres text[],
  invite_code text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.duo_name, d.created_by, d.user1_id, d.status,
         d.user1_display_name, d.user1_genres, d.invite_code, d.created_at
  FROM public.duo_taste_profiles d
  WHERE d.invite_code = _code AND d.status = 'pending'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_pending_duo_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_duo_by_invite_code(text) TO authenticated;

-- 2. group_session_members: forbid inserting NULL user_id and require auth.uid() match
DROP POLICY IF EXISTS "Users can join sessions" ON public.group_session_members;
CREATE POLICY "Users can join sessions"
  ON public.group_session_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- 3. catalog_items: admin-only INSERT (catalog should be populated by trusted code)
DROP POLICY IF EXISTS "Authenticated users can create valid catalog items for feedback" ON public.catalog_items;
CREATE POLICY "Admins can insert catalog items"
  ON public.catalog_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Internal trigger functions: set search_path and revoke from public
ALTER FUNCTION public._trg_recompute_on_watchlist() SET search_path = public;
ALTER FUNCTION public._trg_recompute_on_like() SET search_path = public;
ALTER FUNCTION public._trg_recompute_on_interaction() SET search_path = public;
ALTER FUNCTION public.recompute_user_movie_score(uuid, integer) SET search_path = public;

REVOKE ALL ON FUNCTION public._trg_recompute_on_watchlist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._trg_recompute_on_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._trg_recompute_on_interaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_user_movie_score(uuid, integer) FROM PUBLIC, anon;
