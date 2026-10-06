-- Notifications sur le téléphone (web push), étape 1.
--
-- Jusqu'ici, une notification (invitation à une soirée, film choisi, demande
-- d'ami…) n'était qu'une ligne dans `notifications`, visible seulement en
-- ouvrant Pick. Désormais, chaque nouvelle ligne déclenche l'envoi d'une vraie
-- notification aux téléphones que l'utilisateur a autorisés.

-- 1. Les téléphones autorisés : un abonnement push par appareil et navigateur.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Chacun ne voit, n'ajoute et ne retire que ses propres appareils. L'envoi
-- passe par la fonction serveur, qui lit avec la clé de service.
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Une notification n'est poussée qu'une fois : la fonction d'envoi pose
--    cette date en même temps qu'elle « réserve » la ligne.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- 3. Chaque nouvelle notification appelle la fonction `send-push`.
--
--    Seul l'identifiant part : la fonction relit la notification avec la clé de
--    service et n'envoie qu'une notification récente (10 min) jamais poussée.
--    L'appeler de l'extérieur ne permet donc ni d'inventer un message, ni d'en
--    renvoyer un : aucun secret partagé n'est nécessaire.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.push_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lrjhpflvkrebbngfnaif.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('notification_id', NEW.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un échec d'envoi ne doit jamais empêcher la notification d'exister :
  -- elle reste visible dans la cloche et sur l'accueil.
  RAISE WARNING 'push_on_notification_insert: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_notification_insert ON public.notifications;
CREATE TRIGGER trg_push_on_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_on_notification_insert();
