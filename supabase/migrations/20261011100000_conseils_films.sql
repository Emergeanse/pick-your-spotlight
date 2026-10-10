-- Conseils de film gardés une fois pour toutes.
--
-- La note d'adhésion et le texte « Pourquoi c'est pour toi » d'un film se
-- calculaient à chaque ouverture de sa fiche (appel à movie-match, plusieurs
-- secondes) et pouvaient changer d'un jour à l'autre. Le premier conseil reçu
-- pour un film est désormais enregistré ici et réaffiché tel quel : un conseil
-- reste le même.
--
-- Le téléphone en garde aussi une copie (affichage instantané) ; cette table
-- évite de le perdre en vidant le cache ou en changeant de téléphone.

CREATE TABLE IF NOT EXISTS public.conseils_films (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id     integer NOT NULL,
  media       text NOT NULL DEFAULT 'movie' CHECK (media IN ('movie', 'tv')),
  -- Note (matchScore) et textes du conseil, au format de movie-match.
  conseil     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tmdb_id, media)
);

ALTER TABLE public.conseils_films ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseils_films_select_own" ON public.conseils_films;
CREATE POLICY "conseils_films_select_own" ON public.conseils_films
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "conseils_films_insert_own" ON public.conseils_films;
CREATE POLICY "conseils_films_insert_own" ON public.conseils_films
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Mise à jour : seulement pour compléter un conseil arrivé sans ses textes
-- (le score d'une recommandation précède parfois son explication).
DROP POLICY IF EXISTS "conseils_films_update_own" ON public.conseils_films;
CREATE POLICY "conseils_films_update_own" ON public.conseils_films
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
