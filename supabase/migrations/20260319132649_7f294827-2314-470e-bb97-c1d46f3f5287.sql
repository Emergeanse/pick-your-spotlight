
-- Fix: Drop broken RLS policies and recreate them properly

-- group_session_members: drop the self-referencing broken policy
DROP POLICY IF EXISTS "Members can view session members" ON public.group_session_members;

-- group_sessions: drop the recursive policy
DROP POLICY IF EXISTS "Members can view group sessions" ON public.group_sessions;

-- Recreate: Members can view session members (use a security definer function to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_session_member(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_session_members
    WHERE user_id = _user_id AND session_id = _session_id
  )
$$;

-- Members can view session members (non-recursive via security definer)
CREATE POLICY "Members can view session members"
ON public.group_session_members
FOR SELECT
TO authenticated
USING (public.is_session_member(auth.uid(), session_id));

-- Members can view group sessions (non-recursive via security definer)
CREATE POLICY "Members can view group sessions"
ON public.group_sessions
FOR SELECT
TO authenticated
USING (public.is_session_member(auth.uid(), id));
