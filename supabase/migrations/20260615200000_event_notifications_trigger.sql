-- ══════════════════════════════════════════════════════════════
--  Notifications automatiques pour les soirées
--  Trigger sur event_participants → INSERT et UPDATE status
-- ══════════════════════════════════════════════════════════════

-- ── 1. Notif au participant invité (INSERT avec status = 'invited') ──

CREATE OR REPLACE FUNCTION notify_event_participant_invited()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event    events%ROWTYPE;
  v_organizer_name text;
BEGIN
  -- Uniquement pour les invitations (pas les confirmations directes)
  IF NEW.status <> 'invited' THEN
    RETURN NEW;
  END IF;
  -- Uniquement pour les comptes enregistrés (pas les invités temporaires)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Ne pas notifier l'organisateur qui s'ajoute lui-même
  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  IF NEW.user_id = v_event.organizer_id THEN
    RETURN NEW;
  END IF;

  -- Récupère le nom de l'organisateur
  SELECT COALESCE(display_name, 'Quelqu''un')
    INTO v_organizer_name
    FROM profiles
   WHERE id = v_event.organizer_id;

  -- Insère la notification pour le participant invité
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    'event_invite',
    '🎬 Tu es invité·e !',
    v_organizer_name || ' t''invite à « ' || v_event.title || ' »',
    jsonb_build_object(
      'event_id',    v_event.id,
      'event_title', v_event.title,
      'event_date',  v_event.event_date::text,
      'organizer',   v_organizer_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_invited ON event_participants;
CREATE TRIGGER trg_notify_event_invited
  AFTER INSERT ON event_participants
  FOR EACH ROW EXECUTE FUNCTION notify_event_participant_invited();

-- ── 2. Notif à l'organisateur quand un participant confirme ──

CREATE OR REPLACE FUNCTION notify_event_participant_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event        events%ROWTYPE;
  v_participant_name text;
BEGIN
  -- Uniquement sur passage à 'confirmed'
  IF NEW.status <> 'confirmed' OR OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;
  -- Uniquement comptes enregistrés
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;

  -- Ne pas notifier si c'est l'organisateur lui-même
  IF NEW.user_id = v_event.organizer_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Quelqu''un')
    INTO v_participant_name
    FROM profiles
   WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_event.organizer_id,
    'event_confirmed',
    '✅ ' || v_participant_name || ' participe !',
    v_participant_name || ' a confirmé sa présence à « ' || v_event.title || ' »',
    jsonb_build_object(
      'event_id',          v_event.id,
      'event_title',       v_event.title,
      'participant_name',  v_participant_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_confirmed ON event_participants;
CREATE TRIGGER trg_notify_event_confirmed
  AFTER UPDATE OF status ON event_participants
  FOR EACH ROW EXECUTE FUNCTION notify_event_participant_confirmed();
