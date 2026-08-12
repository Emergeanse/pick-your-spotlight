-- events: scope policies to authenticated
DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS events_update ON public.events;
CREATE POLICY events_update ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS events_delete ON public.events;
CREATE POLICY events_delete ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = organizer_id);

-- event_film_feedback
DROP POLICY IF EXISTS "Users manage their own event feedback" ON public.event_film_feedback;
CREATE POLICY "Users manage their own event feedback" ON public.event_film_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- shared_recommendations
DROP POLICY IF EXISTS "receiver can select and update" ON public.shared_recommendations;
CREATE POLICY "receiver can select and update" ON public.shared_recommendations
  FOR SELECT TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

DROP POLICY IF EXISTS "receiver can mark seen" ON public.shared_recommendations;
CREATE POLICY "receiver can mark seen" ON public.shared_recommendations
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "sender can insert" ON public.shared_recommendations;
CREATE POLICY "sender can insert" ON public.shared_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- event_participants: ensure guest contact fields are never selectable by clients
REVOKE SELECT ON public.event_participants FROM authenticated, anon;
GRANT SELECT (id, event_id, user_id, guest_token, guest_name, status, created_at, guest_age_range, guest_genres)
  ON public.event_participants TO authenticated;
REVOKE SELECT (guest_email) ON public.event_participants FROM authenticated, anon;
