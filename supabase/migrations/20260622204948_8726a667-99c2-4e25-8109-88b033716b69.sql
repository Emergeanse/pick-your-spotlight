
-- Restrict policies to authenticated role only (prevent anonymous access)
DROP POLICY IF EXISTS ep_select ON public.event_participants;
CREATE POLICY ep_select ON public.event_participants FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id)
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = event_participants.event_id AND events.organizer_id = auth.uid())
  OR public.auth_uid_is_event_member(event_id)
);

DROP POLICY IF EXISTS ep_update ON public.event_participants;
CREATE POLICY ep_update ON public.event_participants FOR UPDATE TO authenticated
USING (
  (auth.uid() = user_id)
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = event_participants.event_id AND events.organizer_id = auth.uid())
);

DROP POLICY IF EXISTS er_select ON public.event_recommendations;
CREATE POLICY er_select ON public.event_recommendations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_recommendations.event_id
      AND (e.organizer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = e.id AND ep.user_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS er_insert ON public.event_recommendations;
CREATE POLICY er_insert ON public.event_recommendations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = event_recommendations.event_id AND events.organizer_id = auth.uid())
);

DROP POLICY IF EXISTS er_delete ON public.event_recommendations;
CREATE POLICY er_delete ON public.event_recommendations FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = event_recommendations.event_id AND events.organizer_id = auth.uid())
);

DROP POLICY IF EXISTS ev_select ON public.event_votes;
CREATE POLICY ev_select ON public.event_votes FOR SELECT TO authenticated
USING (
  (auth.uid() = voter_id)
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = event_votes.event_id AND events.organizer_id = auth.uid())
);

DROP POLICY IF EXISTS ev_insert_auth ON public.event_votes;
CREATE POLICY ev_insert_auth ON public.event_votes FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = voter_id)
  AND EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_participants.event_id = event_votes.event_id
      AND event_participants.user_id = auth.uid()
      AND event_participants.status = 'confirmed'
  )
);

DROP POLICY IF EXISTS ev_delete_own ON public.event_votes;
CREATE POLICY ev_delete_own ON public.event_votes FOR DELETE TO authenticated
USING (auth.uid() = voter_id);
