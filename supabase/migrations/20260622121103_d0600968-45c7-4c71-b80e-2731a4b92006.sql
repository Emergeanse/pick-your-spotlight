
-- 1. Restrict guest_email visibility on event_participants to organizer-only path (via existing get_event_guest_emails RPC)
REVOKE SELECT (guest_email) ON public.event_participants FROM authenticated;
REVOKE SELECT (guest_email) ON public.event_participants FROM anon;
-- service_role retains full access

-- 2. Lock subscriptions writes to service_role only via RESTRICTIVE policies
CREATE POLICY "Block client inserts on subscriptions"
ON public.subscriptions AS RESTRICTIVE
FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client updates on subscriptions"
ON public.subscriptions AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

CREATE POLICY "Block client deletes on subscriptions"
ON public.subscriptions AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);
