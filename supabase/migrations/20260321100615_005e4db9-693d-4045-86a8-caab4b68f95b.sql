
CREATE TABLE public.user_people_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_id integer NOT NULL,
  person_name text NOT NULL,
  person_type text NOT NULL DEFAULT 'actor',
  photo_url text,
  preference text NOT NULL DEFAULT 'liked',
  known_for text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, person_id)
);

ALTER TABLE public.user_people_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own people prefs"
  ON public.user_people_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own people prefs"
  ON public.user_people_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own people prefs"
  ON public.user_people_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own people prefs"
  ON public.user_people_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
