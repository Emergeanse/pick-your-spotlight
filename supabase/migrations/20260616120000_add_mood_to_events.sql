-- Stocke le contexte d'ambiance saisi lors de la création d'une soirée
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS mood text;
