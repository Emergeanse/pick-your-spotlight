-- Notifications automatiques pour les demandes d'ami
-- Trigger sur friendships → INSERT pending, UPDATE accepted, DELETE declined

ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;

CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_name text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Quelqu''un')
    INTO v_requester_name
    FROM profiles
   WHERE id = NEW.requester_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.addressee_id,
    'friend_request',
    v_requester_name || ' veut être ton ami !',
    'Accepte sa demande pour regarder des films ensemble.',
    jsonb_build_object(
      'friendship_id', NEW.id,
      'requester_id', NEW.requester_id,
      'requester_name', v_requester_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON public.friendships;
CREATE TRIGGER trg_notify_friend_request
  AFTER INSERT ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friend_request();

CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addressee_name text;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Quelqu''un')
    INTO v_addressee_name
    FROM profiles
   WHERE id = NEW.addressee_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.requester_id,
    'friend_accepted',
    v_addressee_name || ' a accepté ta demande !',
    'Vous pouvez maintenant regarder des films ensemble.',
    jsonb_build_object(
      'friendship_id', NEW.id,
      'friend_id', NEW.addressee_id,
      'friend_name', v_addressee_name
    )
  );

  UPDATE notifications
     SET read = true
   WHERE user_id = NEW.addressee_id
     AND type = 'friend_request'
     AND data->>'friendship_id' = NEW.id::text;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON public.friendships;
CREATE TRIGGER trg_notify_friend_accepted
  AFTER UPDATE OF status ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friend_accepted();

CREATE OR REPLACE FUNCTION public.cleanup_friend_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
   WHERE type = 'friend_request'
     AND data->>'friendship_id' = OLD.id::text;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_friend_request_notification ON public.friendships;
CREATE TRIGGER trg_cleanup_friend_request_notification
  AFTER DELETE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_friend_request_notification();
