DROP POLICY IF EXISTS "ep_insert_auth" ON public.event_participants;
DROP POLICY IF EXISTS "ep_insert_organizer_invite" ON public.event_participants;

CREATE POLICY "ep_insert_auth" ON public.event_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ep_insert_organizer_invite" ON public.event_participants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));