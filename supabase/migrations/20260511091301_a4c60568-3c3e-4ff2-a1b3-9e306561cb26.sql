-- Pick V1 critical refactor — seed preference_tags dictionary
-- Categories: genre, platform, media_type, duration, rating_threshold

-- GENRES (FR labels match TMDB FR labels used in code)
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('genre', 'action', 'Action', '{}'::jsonb),
  ('genre', 'aventure', 'Aventure', '{}'::jsonb),
  ('genre', 'animation', 'Animation', '{}'::jsonb),
  ('genre', 'comedie', 'Comédie', '{}'::jsonb),
  ('genre', 'crime', 'Crime', '{}'::jsonb),
  ('genre', 'documentaire', 'Documentaire', '{}'::jsonb),
  ('genre', 'drame', 'Drame', '{}'::jsonb),
  ('genre', 'famille', 'Famille', '{}'::jsonb),
  ('genre', 'fantastique', 'Fantastique', '{}'::jsonb),
  ('genre', 'histoire', 'Histoire', '{}'::jsonb),
  ('genre', 'horreur', 'Horreur', '{}'::jsonb),
  ('genre', 'musique', 'Musique', '{}'::jsonb),
  ('genre', 'mystere', 'Mystère', '{}'::jsonb),
  ('genre', 'romance', 'Romance', '{}'::jsonb),
  ('genre', 'science-fiction', 'Science-Fiction', '{}'::jsonb),
  ('genre', 'thriller', 'Thriller', '{}'::jsonb),
  ('genre', 'guerre', 'Guerre', '{}'::jsonb),
  ('genre', 'western', 'Western', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- Make (category,key) unique to allow idempotent upserts in future
CREATE UNIQUE INDEX IF NOT EXISTS preference_tags_category_key_unique
  ON public.preference_tags (category, key);

-- PLATFORMS (TMDB provider_id stored in metadata.provider_id)
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('platform', 'netflix',       'Netflix',       jsonb_build_object('provider_id', 8)),
  ('platform', 'disney-plus',   'Disney+',       jsonb_build_object('provider_id', 337)),
  ('platform', 'amazon-prime',  'Amazon Prime',  jsonb_build_object('provider_id', 119)),
  ('platform', 'apple-tv-plus', 'Apple TV+',     jsonb_build_object('provider_id', 350)),
  ('platform', 'canal-plus',    'Canal+',        jsonb_build_object('provider_id', 381)),
  ('platform', 'paramount-plus','Paramount+',    jsonb_build_object('provider_id', 236)),
  ('platform', 'hbo',           'HBO',           jsonb_build_object('provider_id', 384)),
  ('platform', 'crunchyroll',   'Crunchyroll',   jsonb_build_object('provider_id', 283)),
  ('platform', 'rakuten-tv',    'Rakuten TV',    jsonb_build_object('provider_id', 35))
ON CONFLICT DO NOTHING;

-- MEDIA TYPE (preferences for movie/tv/both)
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('media_type', 'movie', 'Films', '{}'::jsonb),
  ('media_type', 'tv',    'Séries', '{}'::jsonb),
  ('media_type', 'both',  'Films et séries', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- DURATION buckets (max minutes stored in metadata.max_minutes)
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('duration', 'short',  'Court (≤90 min)',  jsonb_build_object('max_minutes', 90)),
  ('duration', 'medium', 'Moyen (≤120 min)', jsonb_build_object('max_minutes', 120)),
  ('duration', 'long',   'Long (≤180 min)',  jsonb_build_object('max_minutes', 180)),
  ('duration', 'any',    'Sans limite',      jsonb_build_object('max_minutes', null))
ON CONFLICT DO NOTHING;

-- RATING THRESHOLD (TMDB vote_average minimum)
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('rating_threshold', 'any',       'Toutes notes',     jsonb_build_object('min_rating', 0)),
  ('rating_threshold', 'good',      '≥ 6/10',           jsonb_build_object('min_rating', 6)),
  ('rating_threshold', 'great',     '≥ 7/10',           jsonb_build_object('min_rating', 7)),
  ('rating_threshold', 'excellent', '≥ 8/10',           jsonb_build_object('min_rating', 8))
ON CONFLICT DO NOTHING;

-- Allow authenticated users to UPSERT user_preferences cleanly:
-- Add (user_id, tag_id) unique to prevent duplicates and enable upserts.
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_tag_unique
  ON public.user_preferences (user_id, tag_id);
