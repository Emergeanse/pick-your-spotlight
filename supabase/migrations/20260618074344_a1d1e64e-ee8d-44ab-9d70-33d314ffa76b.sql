
-- 1) Lock down subscriptions: only service role writes (Stripe webhooks)
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.subscriptions;
-- SELECT for own row remains. Inserts happen via SECURITY DEFINER trigger handle_new_user_subscription.

-- 2) Explicit deny on user_roles writes for normal users — only service role can mutate
CREATE POLICY "No client writes on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 3) Protect guest_email at column level — only service role / SECURITY DEFINER RPC can read
REVOKE SELECT (guest_email) ON public.event_participants FROM authenticated, anon;
-- Organizers retrieve guest emails via existing SECURITY DEFINER function get_event_guest_emails.
