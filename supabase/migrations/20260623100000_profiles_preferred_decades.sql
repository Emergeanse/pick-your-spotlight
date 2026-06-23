-- Préférences de décennies cinématographiques (ex: [1980, 1990, 2000])
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_decades integer[];
