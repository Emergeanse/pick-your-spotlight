-- Type TMDB du film/série révélé (distinct de events.media_type = critères de la soirée)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS final_pick_media_type text CHECK (final_pick_media_type IN ('movie', 'tv'));
