
ALTER TABLE public.group_session_members
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_name text;

-- Update the is_session_member function to handle nullable user_id
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
