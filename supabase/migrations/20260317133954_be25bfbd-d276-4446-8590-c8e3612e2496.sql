
ALTER TABLE public.watchlist 
  ADD COLUMN IF NOT EXISTS genres text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS runtime integer DEFAULT NULL;
