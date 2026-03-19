
ALTER TABLE public.cinematic_profiles
  ADD COLUMN IF NOT EXISTS dna_archetype text,
  ADD COLUMN IF NOT EXISTS taste_signatures jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specializations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distinctions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS global_level text NOT NULL DEFAULT 'Regard naissant',
  ADD COLUMN IF NOT EXISTS social_reputation jsonb NOT NULL DEFAULT '[]'::jsonb;
