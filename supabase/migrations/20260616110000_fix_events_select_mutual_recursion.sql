-- Fix: récursion mutuelle entre events_select et ep_select
--
-- La migration 20260616073556 a changé events_select pour lire event_participants.
-- Or ep_select lit events → boucle infinie : events ↔ event_participants.
--
-- Solution : events_select revient à USING (true).
-- La visibilité est contrôlée par l'app (UUID non-devinables + invite token).

DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS events_select ON public.events;

CREATE POLICY "events_select" ON public.events
  FOR SELECT
  USING (true);
