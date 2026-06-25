-- Décennies à exclure des recommandations (ex: [1970, 1980])
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS excluded_decades integer[];
