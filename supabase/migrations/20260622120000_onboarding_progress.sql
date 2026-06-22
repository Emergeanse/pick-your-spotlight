-- Progression initiatique : reprise plus tard
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_paused boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.onboarding_step IS 'welcome | genres | platforms | films | actors | directors | modes | soirees';
COMMENT ON COLUMN public.profiles.onboarding_paused IS 'True si l''utilisateur a quitté l''initiation pour la reprendre plus tard';
