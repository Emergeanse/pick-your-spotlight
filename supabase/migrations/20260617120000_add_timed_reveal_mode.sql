-- Ajoute 'timed' comme mode de révélation (surprise sur le moment = à l'heure de la soirée)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reveal_mode_check;
ALTER TABLE events ADD CONSTRAINT events_reveal_mode_check
  CHECK (reveal_mode IN ('surprise', 'vote', 'timed'));
