ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_films_liked_ids integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.onboarding_films_liked_ids IS 'TMDB ids des films aimés durant le parcours initiatique (max 10)';
