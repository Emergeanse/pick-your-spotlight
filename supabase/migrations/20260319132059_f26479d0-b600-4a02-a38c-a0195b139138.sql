
-- Function to generate session invite codes
CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := 'SOIR-' || upper(substr(md5(random()::text), 1, 4));
    SELECT EXISTS(SELECT 1 FROM public.group_sessions WHERE invite_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Add invite_code column to group_sessions
ALTER TABLE public.group_sessions ADD COLUMN IF NOT EXISTS invite_code text UNIQUE DEFAULT generate_session_code();

-- Enable realtime on group_session_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_session_members;

-- RLS: allow anyone (anon) to SELECT group_sessions by invite_code (for join page)
CREATE POLICY "Anyone can lookup session by invite_code"
ON public.group_sessions
FOR SELECT
TO anon
USING (invite_code IS NOT NULL);

-- Also allow authenticated users to look up sessions by invite_code
CREATE POLICY "Authenticated can lookup session by invite_code"
ON public.group_sessions
FOR SELECT
TO authenticated
USING (invite_code IS NOT NULL);

-- Allow authenticated users to insert themselves as session members
CREATE POLICY "Users can join sessions"
ON public.group_session_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
