ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_films_progress integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.onboarding_films_progress IS 'Nombre de films notés durant le parcours initiatique (0-10)';
