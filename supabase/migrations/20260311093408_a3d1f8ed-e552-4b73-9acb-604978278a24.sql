
-- Watchlist table (separate from liked_movies)
CREATE TABLE public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  poster_path text,
  media_type text NOT NULL DEFAULT 'movie',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tmdb_id)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add onboarding_completed to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Add preferred_platforms to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_platforms integer[] DEFAULT '{}';
