-- ══════════════════════════════════════════════════════════════
--  Events System
--  Soirées ciné : événements, participants, recommandations, votes
-- ══════════════════════════════════════════════════════════════

-- ── 1. Ajout colonnes sur profiles ──────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'full'
    CHECK (account_type IN ('full', 'light')),
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean DEFAULT false;

-- ── 2. Table events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id       uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title              text NOT NULL,
  event_date         date NOT NULL,
  event_time         time,
  location           text,                    -- texte libre (ou null si remote)
  is_remote          boolean DEFAULT false,
  context            text CHECK (context IN ('duo', 'famille', 'amis', 'solo')),
  reveal_mode        text DEFAULT 'surprise'
                       CHECK (reveal_mode IN ('surprise', 'vote')),
  status             text DEFAULT 'planning'
                       CHECK (status IN ('planning', 'confirmed', 'done', 'cancelled')),
  final_pick_id      uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  invite_link_token  uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ── 3. Table event_participants ──────────────────────────────
CREATE TABLE IF NOT EXISTS event_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  -- Compte enregistré (normal ou light)
  user_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Invité temporaire
  guest_token  uuid DEFAULT gen_random_uuid(),
  guest_name   text,
  guest_email  text,
  status       text DEFAULT 'invited'
                 CHECK (status IN ('invited', 'confirmed', 'declined')),
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT participant_has_identity
    CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);

-- ── 4. Table event_recommendations ──────────────────────────
CREATE TABLE IF NOT EXISTS event_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE CASCADE NOT NULL,
  position        int DEFAULT 1 CHECK (position BETWEEN 1 AND 3),
  created_at      timestamptz DEFAULT now()
);

-- ── 5. Table event_votes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_votes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  recommendation_id uuid REFERENCES event_recommendations(id) ON DELETE CASCADE NOT NULL,
  voter_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  guest_token       uuid,
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT voter_has_identity
    CHECK (voter_id IS NOT NULL OR guest_token IS NOT NULL)
);

-- Unicité : 1 vote par utilisateur enregistré par événement
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_votes_user_unique
  ON event_votes(event_id, voter_id)
  WHERE voter_id IS NOT NULL;

-- Unicité : 1 vote par invité temporaire par événement
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_votes_guest_unique
  ON event_votes(event_id, guest_token)
  WHERE guest_token IS NOT NULL;

-- ── 6. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_organizer      ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status         ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date           ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_invite_token   ON events(invite_link_token);

CREATE INDEX IF NOT EXISTS idx_ep_event              ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_ep_user               ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_ep_guest_token        ON event_participants(guest_token);

CREATE INDEX IF NOT EXISTS idx_er_event              ON event_recommendations(event_id);
CREATE INDEX IF NOT EXISTS idx_ev_event              ON event_votes(event_id);
CREATE INDEX IF NOT EXISTS idx_ev_recommendation     ON event_votes(recommendation_id);

-- ── 7. Trigger updated_at sur events ────────────────────────
CREATE OR REPLACE FUNCTION set_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_events_updated_at();

-- ══════════════════════════════════════════════════════════════
--  RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_votes         ENABLE ROW LEVEL SECURITY;

-- ── events ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update" ON events
  FOR UPDATE USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_delete" ON events
  FOR DELETE USING (auth.uid() = organizer_id);

-- ── event_participants ───────────────────────────────────────

DROP POLICY IF EXISTS "ep_select" ON event_participants;
CREATE POLICY "ep_select" ON event_participants
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM events
      WHERE id = event_participants.event_id
        AND organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_participants ep2
      WHERE ep2.event_id = event_participants.event_id
        AND ep2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ep_insert_auth" ON event_participants;
CREATE POLICY "ep_insert_auth" ON event_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "ep_insert_guest" ON event_participants;
CREATE POLICY "ep_insert_guest" ON event_participants
  FOR INSERT WITH CHECK (
    user_id IS NULL
    AND guest_name IS NOT NULL
    AND EXISTS (SELECT 1 FROM events WHERE id = event_participants.event_id)
  );

DROP POLICY IF EXISTS "ep_update" ON event_participants;
CREATE POLICY "ep_update" ON event_participants
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM events
      WHERE id = event_participants.event_id
        AND organizer_id = auth.uid()
    )
  );

-- ── event_recommendations ────────────────────────────────────

DROP POLICY IF EXISTS "er_select" ON event_recommendations;
CREATE POLICY "er_select" ON event_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_recommendations.event_id AND (
        e.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM event_participants ep
          WHERE ep.event_id = e.id AND ep.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "er_insert" ON event_recommendations;
CREATE POLICY "er_insert" ON event_recommendations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_recommendations.event_id
        AND organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "er_delete" ON event_recommendations;
CREATE POLICY "er_delete" ON event_recommendations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_recommendations.event_id
        AND organizer_id = auth.uid()
    )
  );

-- ── event_votes ──────────────────────────────────────────────

DROP POLICY IF EXISTS "ev_select" ON event_votes;
CREATE POLICY "ev_select" ON event_votes
  FOR SELECT USING (
    auth.uid() = voter_id
    OR EXISTS (
      SELECT 1 FROM events
      WHERE id = event_votes.event_id
        AND organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ev_insert_auth" ON event_votes;
CREATE POLICY "ev_insert_auth" ON event_votes
  FOR INSERT WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_id = event_votes.event_id
        AND user_id = auth.uid()
        AND status = 'confirmed'
    )
  );

DROP POLICY IF EXISTS "ev_delete_own" ON event_votes;
CREATE POLICY "ev_delete_own" ON event_votes
  FOR DELETE USING (auth.uid() = voter_id);

-- ── Realtime ─────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
