DROP POLICY IF EXISTS "Authenticated users can create catalog items for feedback" ON public.catalog_items;

CREATE POLICY "Authenticated users can create valid catalog items for feedback"
ON public.catalog_items
FOR INSERT
TO authenticated
WITH CHECK (
  tmdb_id > 0
  AND length(btrim(title)) > 0
  AND media_type IN ('movie', 'tv', 'person')
);