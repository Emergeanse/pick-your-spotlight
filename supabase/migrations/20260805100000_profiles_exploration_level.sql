-- Curseur de découverte : à quel point rester dans ses goûts.
--
-- explorationLevel existait déjà, transmis de bout en bout au moteur — mais
-- figé à 5 dans le code, sans aucune interface, et sans effet réel : il
-- n'ajoutait qu'une phrase à la consigne du modèle, parmi des candidats que la
-- recherche vectorielle avait déjà tous jugés proches. Le curseur ne faisait
-- donc jamais sortir des sentiers battus.
--
-- Il pilote désormais la PROFONDEUR dans le classement vectoriel : plus il est
-- haut, plus on saute de candidats proches pour aller chercher plus loin.
--
-- Ce qu'il ne touche pas : la note minimale. Elle reste un filtre appliqué
-- avant le tri, donc la qualité est préservée quelle que soit la profondeur.
-- Mesuré sur un profil réel avec note minimale 7 :
--     rangs 1-50    → note moyenne 7,91
--     rangs 250-350 → note moyenne 7,59
--     rangs 600-700 → note moyenne 7,51
-- Les genres s'élargissent en revanche nettement : western et histoire
-- apparaissent en profondeur, absents des cent premiers.
--
-- 5 par défaut, valeur déjà codée en dur jusqu'ici : personne ne voit son
-- comportement changer tant qu'il ne touche pas au curseur.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exploration_level smallint NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_exploration_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_exploration_level_check
      CHECK (exploration_level BETWEEN 0 AND 10);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.exploration_level IS
  'De 0 (pile dans mes goûts) à 10 (surprends-moi). Pilote la profondeur dans le classement vectoriel, jamais la note minimale.';
