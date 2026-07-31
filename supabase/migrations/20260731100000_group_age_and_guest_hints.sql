-- Indices de goût pour les participants sans compte, et tranche d'âge de profil.
--
-- Objectif : une soirée famille doit pouvoir tenir compte des personnes
-- présentes qui n'ont pas de compte Pick — typiquement les enfants et les
-- grands-parents. Sans cette information, la recommandation ne connaît que
-- l'organisateur.
--
-- Les indices restent attachés à la soirée : ils ne créent aucun profil de
-- goût durable et ne sont jamais écrits dans user_preferences.

-- ── 1. Tranche d'âge sur le profil ───────────────────────────────────────
-- Sert aussi bien à contraindre une soirée qu'à préparer d'éventuels comptes
-- adolescents. Référence des valeurs : src/lib/age-ranges.ts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_range text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_age_range_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_range_check
      CHECK (age_range IS NULL OR age_range IN ('enfant', 'pre_ado', 'ado', 'adulte'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.age_range IS
  'Tranche d''âge déclarée. Contraint le contenu proposé, en solo comme en groupe.';

-- ── 2. Indices des invités sans compte ───────────────────────────────────
ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS guest_age_range text,
  ADD COLUMN IF NOT EXISTS guest_genres    text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_guest_age_range_check'
  ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_guest_age_range_check
      CHECK (guest_age_range IS NULL OR guest_age_range IN ('enfant', 'pre_ado', 'ado', 'adulte'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_participants.guest_age_range IS
  'Tranche d''âge déclarée par un invité sans compte, valable pour cette soirée seulement.';
COMMENT ON COLUMN public.event_participants.guest_genres IS
  'Genres aimés déclarés par un invité sans compte. Jamais persistés comme goût durable.';

-- ── 3. join_event_as_guest : accepte les indices ─────────────────────────
-- On supprime l'ancienne signature avant de recréer : ajouter des paramètres
-- par défaut créerait une surcharge, et un appel à trois arguments deviendrait
-- ambigu entre les deux versions.
DROP FUNCTION IF EXISTS public.join_event_as_guest(uuid, text, text);

CREATE OR REPLACE FUNCTION public.join_event_as_guest(
  _token       uuid,
  _guest_name  text,
  _guest_email text   DEFAULT NULL,
  _age_range   text   DEFAULT NULL,
  _genres      text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_id       uuid;
BEGIN
  IF _guest_name IS NULL OR length(trim(_guest_name)) = 0 THEN
    RAISE EXCEPTION 'guest_name required';
  END IF;

  IF _age_range IS NOT NULL AND _age_range NOT IN ('enfant', 'pre_ado', 'ado', 'adulte') THEN
    RAISE EXCEPTION 'invalid age_range';
  END IF;

  SELECT id INTO v_event_id FROM public.events
    WHERE invite_link_token = _token AND status <> 'cancelled' LIMIT 1;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'invalid invite token'; END IF;

  INSERT INTO public.event_participants (
    event_id, user_id, guest_name, guest_email, guest_age_range, guest_genres, status
  )
  VALUES (
    v_event_id, NULL, _guest_name, _guest_email, _age_range,
    COALESCE(_genres, '{}'::text[]), 'confirmed'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_event_as_guest(uuid, text, text, text, text[]) TO anon, authenticated;

-- ── 4. Correctif : event_participants était illisible ────────────────────
-- La policy ep_select (migration 20260622204948) autorise la lecture aux
-- participants et à l'organisateur, mais le GRANT correspondant n'a jamais été
-- posé : seuls INSERT, UPDATE et DELETE l'ont été (migration 20260616073556).
-- Or une policy ne s'applique qu'APRÈS les privilèges de table — toute lecture
-- échouait donc en 42501, y compris pour l'organisateur.
--
-- Conséquence concrète : la liste des participants d'une soirée restait vide,
-- et la révélation transmettait un tableau participantIds systématiquement
-- vide au pipeline. Sans ce correctif, aucune soirée de groupe ne peut
-- fonctionner.
GRANT SELECT ON public.event_participants TO authenticated;
