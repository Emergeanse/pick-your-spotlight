ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activation_step text NOT NULL DEFAULT 'train_20',
  ADD COLUMN IF NOT EXISTS activation_completed boolean NOT NULL DEFAULT false;