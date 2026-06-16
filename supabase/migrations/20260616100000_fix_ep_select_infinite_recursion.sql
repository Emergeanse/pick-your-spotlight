-- Fix: infinite recursion in ep_select policy
-- La 3e condition de ep_select faisait un SELECT sur event_participants depuis
-- l'intérieur d'une policy de event_participants → boucle infinie PostgreSQL.
-- Solution : fonction SECURITY DEFINER qui bypass RLS pour ce seul check.

CREATE OR REPLACE FUNCTION auth_uid_is_event_member(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
  );
$$;

-- Recrée la policy sans auto-référence directe
DROP POLICY IF EXISTS "ep_select" ON event_participants;
CREATE POLICY "ep_select" ON event_participants
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM events
      WHERE id = event_participants.event_id
        AND organizer_id = auth.uid()
    )
    OR auth_uid_is_event_member(event_participants.event_id)
  );
