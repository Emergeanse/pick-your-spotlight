-- Permet à l'organisateur d'un événement d'inviter d'autres utilisateurs enregistrés.
-- Sans cette politique, seul auth.uid() = user_id était autorisé (ep_insert_auth),
-- bloquant l'auto-invite du partenaire duo lors de la création de la soirée.

DROP POLICY IF EXISTS "ep_insert_organizer_invite" ON event_participants;
CREATE POLICY "ep_insert_organizer_invite" ON event_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_participants.event_id
        AND organizer_id = auth.uid()
    )
  );
