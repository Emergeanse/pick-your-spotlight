ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_films_proposed_ids integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.onboarding_films_proposed_ids IS 'TMDB ids des films déjà proposés durant le parcours initiatique (likés ou non)';
