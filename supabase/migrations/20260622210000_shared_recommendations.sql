-- Recommandations de films entre amis (post-soirée ou autre)
CREATE TABLE IF NOT EXISTS shared_recommendations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id     integer NOT NULL,
  title       text NOT NULL,
  poster_path text,
  message     text,
  seen        boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_reco_receiver_idx ON shared_recommendations (receiver_id, seen, created_at DESC);

ALTER TABLE shared_recommendations ENABLE ROW LEVEL SECURITY;

-- L'expéditeur peut insérer
CREATE POLICY "sender can insert"
  ON shared_recommendations FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Le destinataire peut lire et marquer comme vu
CREATE POLICY "receiver can select and update"
  ON shared_recommendations FOR SELECT
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "receiver can mark seen"
  ON shared_recommendations FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);
