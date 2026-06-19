-- Restaure la capacité des utilisateurs authentifiés à créer des catalog_items
-- via setFeedback (like, watchlist, seen, etc.) pour les films/séries non encore indexés.
-- La migration 20260615084036 a trop restreint l'INSERT aux admins uniquement,
-- ce qui casse les likes sur les séries TV non encore présentes dans catalog_items.

DROP POLICY IF EXISTS "Admins can insert catalog items" ON public.catalog_items;

CREATE POLICY "Authenticated users can create catalog items for feedback"
  ON public.catalog_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tmdb_id > 0
    AND title IS NOT NULL
    AND length(title) > 0
    AND media_type IN ('movie', 'tv', 'person')
  );
