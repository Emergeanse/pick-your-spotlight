-- Feedback post-soirée : appréciation soirée + film + phrase
CREATE TABLE IF NOT EXISTS event_film_feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soiree_rating text CHECK (soiree_rating IN ('memorable', 'good', 'meh')),
  film_rating   text CHECK (film_rating   IN ('love', 'like', 'not_for_me')),
  film_phrase   text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_film_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own event feedback"
  ON event_film_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
