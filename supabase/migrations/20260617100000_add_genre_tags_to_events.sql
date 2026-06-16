-- Stocke les genres/thèmes choisis lors de la création d'une soirée
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS genre_tags text[];
