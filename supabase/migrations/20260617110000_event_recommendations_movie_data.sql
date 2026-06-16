-- Enrichit event_recommendations avec les données film pour l'affichage
-- Rend catalog_item_id nullable (un film peut ne pas être dans catalog_items)
ALTER TABLE event_recommendations
  ALTER COLUMN catalog_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tmdb_id integer,
  ADD COLUMN IF NOT EXISTS movie_title text,
  ADD COLUMN IF NOT EXISTS poster_path text;

-- Ajoute media_type + données du film révélé sur l'événement
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS final_pick_title text,
  ADD COLUMN IF NOT EXISTS final_pick_poster text,
  ADD COLUMN IF NOT EXISTS final_pick_tmdb_id integer;
