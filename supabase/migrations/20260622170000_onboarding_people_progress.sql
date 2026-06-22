ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_actors_selected_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_actors_proposed_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_directors_selected_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_directors_proposed_ids integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.onboarding_actors_selected_ids IS 'TMDB person ids sélectionnés durant l''étape acteurs (max 5)';
COMMENT ON COLUMN public.profiles.onboarding_actors_proposed_ids IS 'TMDB person ids déjà proposés durant l''étape acteurs';
COMMENT ON COLUMN public.profiles.onboarding_directors_selected_ids IS 'TMDB person ids sélectionnés durant l''étape réalisateurs (max 5)';
COMMENT ON COLUMN public.profiles.onboarding_directors_proposed_ids IS 'TMDB person ids déjà proposés durant l''étape réalisateurs';
