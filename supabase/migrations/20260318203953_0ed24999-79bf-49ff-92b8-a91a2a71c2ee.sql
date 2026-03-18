
-- Add friend_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_code text UNIQUE;

-- Generate friend codes for existing profiles
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := 'PICK-' || upper(substr(md5(random()::text), 1, 4));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE friend_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-generate friend_code on profile insert
CREATE OR REPLACE FUNCTION public.set_friend_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.friend_code IS NULL THEN
    NEW.friend_code := generate_friend_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_friend_code_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_friend_code();

-- Backfill existing profiles
UPDATE public.profiles SET friend_code = generate_friend_code() WHERE friend_code IS NULL;

-- Make friend_code NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN friend_code SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN friend_code SET DEFAULT public.generate_friend_code();

-- Create friendships table
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can insert friendships as requester" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they received" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);

CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Create group_sessions table
CREATE TABLE public.group_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Soirée ciné',
  mood text,
  context text,
  time_available text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;

-- Create group_session_members table
CREATE TABLE public.group_session_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

ALTER TABLE public.group_session_members ENABLE ROW LEVEL SECURITY;

-- RLS for group_sessions: creator and members can see
CREATE POLICY "Creator can manage group sessions" ON public.group_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Members can view group sessions" ON public.group_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_session_members WHERE session_id = id AND user_id = auth.uid()));

-- RLS for group_session_members
CREATE POLICY "Session creator can manage members" ON public.group_session_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_sessions WHERE id = session_id AND creator_id = auth.uid()));

CREATE POLICY "Members can view session members" ON public.group_session_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_session_members gsm WHERE gsm.session_id = session_id AND gsm.user_id = auth.uid()));

-- Allow reading friend's display_name and friend_code (needed for friend search)
CREATE POLICY "Users can search profiles by friend_code" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
