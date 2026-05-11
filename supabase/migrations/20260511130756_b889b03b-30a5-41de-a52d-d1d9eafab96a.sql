DROP POLICY IF EXISTS "Service can insert catalog items" ON public.catalog_items;

CREATE POLICY "Authenticated users can create catalog items for feedback"
ON public.catalog_items
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_tmdb_media_unique
ON public.catalog_items (tmdb_id, media_type);