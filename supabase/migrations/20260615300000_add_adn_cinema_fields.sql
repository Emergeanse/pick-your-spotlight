-- Champs pour la page ADN Cinéma
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS podium_film_ids integer[];
