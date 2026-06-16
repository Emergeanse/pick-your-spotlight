
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (
    auth.uid() = organizer_id
    OR EXISTS (SELECT 1 FROM public.event_participants ep
               WHERE ep.event_id = events.id AND ep.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_event_by_invite_token(_token uuid)
RETURNS TABLE (
  id uuid, title text, event_date date, event_time time without time zone,
  location text, is_remote boolean, context text, reveal_mode text,
  status text, organizer_id uuid, organizer_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, e.event_date, e.event_time, e.location, e.is_remote,
         e.context, e.reveal_mode, e.status, e.organizer_id,
         COALESCE(p.display_name, 'Quelqu''un')
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.organizer_id
  WHERE e.invite_link_token = _token AND e.status <> 'cancelled'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_event_by_invite_token(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS ep_insert_guest ON public.event_participants;

CREATE OR REPLACE FUNCTION public.join_event_as_guest(
  _token uuid, _guest_name text, _guest_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_id uuid;
BEGIN
  IF _guest_name IS NULL OR length(trim(_guest_name)) = 0 THEN
    RAISE EXCEPTION 'guest_name required';
  END IF;
  SELECT id INTO v_event_id FROM public.events
    WHERE invite_link_token = _token AND status <> 'cancelled' LIMIT 1;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'invalid invite token'; END IF;
  INSERT INTO public.event_participants (event_id, user_id, guest_name, guest_email, status)
  VALUES (v_event_id, NULL, _guest_name, _guest_email, 'confirmed')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_event_as_guest(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_event_as_user(_token uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO v_event_id FROM public.events
    WHERE invite_link_token = _token AND status <> 'cancelled' LIMIT 1;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'invalid invite token'; END IF;
  INSERT INTO public.event_participants (event_id, user_id, status)
  VALUES (v_event_id, auth.uid(), 'confirmed')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_event_as_user(uuid) TO authenticated;

REVOKE SELECT ON public.event_participants FROM authenticated, anon;
GRANT SELECT (id, event_id, user_id, guest_token, guest_name, status, created_at)
  ON public.event_participants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_participants TO authenticated;
GRANT ALL ON public.event_participants TO service_role;

CREATE OR REPLACE FUNCTION public.get_event_guest_emails(_event_id uuid)
RETURNS TABLE (participant_id uuid, guest_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ep.id, ep.guest_email
  FROM public.event_participants ep
  JOIN public.events e ON e.id = ep.event_id
  WHERE ep.event_id = _event_id
    AND e.organizer_id = auth.uid()
    AND ep.guest_email IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_event_guest_emails(uuid) TO authenticated;

DROP POLICY IF EXISTS "Duo members can view" ON public.duo_taste_profiles;
CREATE POLICY "Duo members can view" ON public.duo_taste_profiles
  FOR SELECT TO authenticated
  USING (
    status <> 'pending'
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.set_events_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.notify_event_participant_invited()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event events%ROWTYPE;
  v_organizer_name text;
BEGIN
  IF NEW.status <> 'invited' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  IF NEW.user_id = v_event.organizer_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, 'Quelqu''un') INTO v_organizer_name
    FROM profiles WHERE id = v_event.organizer_id;
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (NEW.user_id, 'event_invite', '🎬 Tu es invité·e !',
    v_organizer_name || ' t''invite à « ' || v_event.title || ' »',
    jsonb_build_object('event_id', v_event.id, 'event_title', v_event.title,
      'event_date', v_event.event_date::text, 'organizer', v_organizer_name));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_event_participant_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event events%ROWTYPE;
  v_participant_name text;
BEGIN
  IF NEW.status <> 'confirmed' OR OLD.status = 'confirmed' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  IF NEW.user_id = v_event.organizer_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, 'Quelqu''un') INTO v_participant_name
    FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (v_event.organizer_id, 'event_confirmed',
    '✅ ' || v_participant_name || ' participe !',
    v_participant_name || ' a confirmé sa présence à « ' || v_event.title || ' »',
    jsonb_build_object('event_id', v_event.id, 'event_title', v_event.title,
      'participant_name', v_participant_name));
  RETURN NEW;
END; $$;
