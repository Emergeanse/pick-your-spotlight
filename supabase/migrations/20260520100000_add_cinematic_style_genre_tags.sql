-- Add cinematic style genre tags that don't map to a TMDB genre ID
-- but are understood semantically by the movie-match LLM.
INSERT INTO public.preference_tags (category, key, label, metadata) VALUES
  ('genre', 'cinema-francais',      'Cinéma français',      '{}'::jsonb),
  ('genre', 'cinema-asiatique',     'Cinéma asiatique',     '{}'::jsonb),
  ('genre', 'films-auteur',         'Films d''auteur',       '{}'::jsonb),
  ('genre', 'comedie-romantique',   'Comédie romantique',   '{}'::jsonb),
  ('genre', 'cinema-independant',   'Cinéma indépendant',   '{}'::jsonb),
  ('genre', 'film-noir',            'Film noir',            '{}'::jsonb)
ON CONFLICT DO NOTHING;
