-- Add additional cinematic origin tags
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('genre', 'cinema-africain',        'Cinéma africain',          '{}'::jsonb),
  ('genre', 'cinema-amerique-du-sud', 'Cinéma Amérique du Sud',   '{}'::jsonb)
ON CONFLICT DO NOTHING;
