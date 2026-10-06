-- Conseiller un film à un ami, depuis n'importe quelle fiche film.
--
-- La table `shared_recommendations` existait (juin), mais ne servait qu'en fin
-- de soirée, ne prévenait pas le destinataire, et laissait n'importe quel
-- compte écrire à n'importe quel autre.

-- 1. Film ou série : un identifiant TMDB seul est ambigu.
ALTER TABLE public.shared_recommendations
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'movie';

ALTER TABLE public.shared_recommendations
  DROP CONSTRAINT IF EXISTS shared_recommendations_media_type_check;
ALTER TABLE public.shared_recommendations
  ADD CONSTRAINT shared_recommendations_media_type_check CHECK (media_type IN ('movie', 'tv'));

-- 2. Un conseil reçu reste dans « À voir » jusqu'à ce qu'on l'écarte.
--    `seen` garde son sens d'origine : affiché une fois sur l'accueil.
ALTER TABLE public.shared_recommendations
  ADD COLUMN IF NOT EXISTS dismissed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS shared_reco_receiver_dismissed_idx
  ON public.shared_recommendations (receiver_id, dismissed, created_at DESC);

-- 3. On ne conseille qu'à ses amis (amitié acceptée, dans un sens ou l'autre),
--    et un petit mot ne dépasse pas 140 caractères.
DROP POLICY IF EXISTS "sender can insert" ON public.shared_recommendations;
CREATE POLICY "sender can insert" ON public.shared_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> receiver_id
    AND (message IS NULL OR char_length(message) <= 140)
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = sender_id AND f.addressee_id = receiver_id)
          OR (f.requester_id = receiver_id AND f.addressee_id = sender_id)
        )
    )
  );

-- 4. Le destinataire est prévenu : « Léa te conseille Parasite ». La
--    notification part aussi sur son téléphone s'il les a activées
--    (déclencheur push_on_notification_insert). Le prénom vient du profil de
--    l'expéditeur, côté serveur : on ne fait pas confiance au client pour ça.
CREATE OR REPLACE FUNCTION public.notify_film_recommended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nom text;
BEGIN
  SELECT NULLIF(trim(display_name), '') INTO nom FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'film_recommended',
    COALESCE(nom, 'Un ami') || ' te conseille ' || NEW.title,
    COALESCE(NULLIF(trim(NEW.message), ''), 'Touche pour découvrir le film.'),
    jsonb_build_object(
      'share_id', NEW.id,
      'tmdb_id', NEW.tmdb_id,
      'media_type', NEW.media_type,
      'sender_id', NEW.sender_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_film_recommended ON public.shared_recommendations;
CREATE TRIGGER trg_notify_film_recommended
  AFTER INSERT ON public.shared_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.notify_film_recommended();
