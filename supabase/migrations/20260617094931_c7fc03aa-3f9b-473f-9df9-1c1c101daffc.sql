
-- 1. Restrict events SELECT to organizer or participants (auth only).
--    Anonymous invite access goes through get_event_by_invite_token (SECURITY DEFINER).
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = organizer_id
    OR public.auth_uid_is_event_member(id)
  );

-- 2. Allow users to delete their own subscription rows.
CREATE POLICY "Users can delete own subscription"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Add fixed search_path to auth_uid_is_event_member.
CREATE OR REPLACE FUNCTION public.auth_uid_is_event_member(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
  );
$function$;

-- 4. Fix mutable search_path on set_events_updated_at trigger function.
CREATE OR REPLACE FUNCTION public.set_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
