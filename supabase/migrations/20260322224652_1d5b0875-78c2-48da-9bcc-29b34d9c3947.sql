ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS match_threshold smallint NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS default_media_type text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS default_max_duration integer DEFAULT NULL;