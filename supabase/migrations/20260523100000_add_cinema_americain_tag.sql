-- Add "Cinéma américain" origin tag (companion to cinema-francais / cinema-asiatique)
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('genre', 'cinema-americain', 'Cinéma américain', '{}'::jsonb)
ON CONFLICT DO NOTHING;
