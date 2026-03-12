CREATE TABLE public.cinematic_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  personality_title text NOT NULL DEFAULT '',
  narrative text NOT NULL DEFAULT '',
  taste_traits text[] NOT NULL DEFAULT '{}',
  representative_films text[] NOT NULL DEFAULT '{}',
  evolution_note text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cinematic_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cinematic profile"
ON public.cinematic_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cinematic profile"
ON public.cinematic_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cinematic profile"
ON public.cinematic_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);