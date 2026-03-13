ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS excluded_genres text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS excluded_platforms integer[] DEFAULT '{}'::integer[];