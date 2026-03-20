
-- 1. Add separate vectors to user_taste_vectors
ALTER TABLE public.user_taste_vectors
  ADD COLUMN IF NOT EXISTS recent_taste_vector text,
  ADD COLUMN IF NOT EXISTS avoidance_vector text,
  ADD COLUMN IF NOT EXISTS stable_confidence integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS novelty_tolerance real NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS fatigue_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rejected_clusters text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS top_clusters text[] NOT NULL DEFAULT '{}'::text[];

-- 2. Create recommendation_events table for tracking reco outcomes
CREATE TABLE IF NOT EXISTS public.recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text,
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'surprise',
  rank_position integer NOT NULL DEFAULT 1,
  score_breakdown jsonb,
  shown_at timestamptz NOT NULL DEFAULT now(),
  accepted boolean,
  skipped boolean,
  watched boolean,
  reaction text,
  reaction_at timestamptz,
  context jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for recommendation_events
CREATE POLICY "Users can view own reco events" ON public.recommendation_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reco events" ON public.recommendation_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reco events" ON public.recommendation_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reco_events_user_id ON public.recommendation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_reco_events_tmdb_id ON public.recommendation_events(user_id, tmdb_id);
