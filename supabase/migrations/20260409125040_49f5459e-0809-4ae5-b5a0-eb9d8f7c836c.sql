
-- ══════════════════════════════════════════
-- Phase 1A: preference_tags
-- ══════════════════════════════════════════
CREATE TABLE public.preference_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, key)
);

ALTER TABLE public.preference_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read preference tags"
  ON public.preference_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage preference tags"
  ON public.preference_tags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ══════════════════════════════════════════
-- Phase 1B: user_preferences
-- ══════════════════════════════════════════
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.preference_tags(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN -100 AND 100),
  source text NOT NULL DEFAULT 'explicit' CHECK (source IN ('explicit','inferred','onboarding')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag_id)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════
-- Phase 1C: catalog_items
-- ══════════════════════════════════════════
CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer NOT NULL,
  media_type text NOT NULL DEFAULT 'movie' CHECK (media_type IN ('movie','tv','person')),
  title text NOT NULL,
  poster_path text,
  vote_average numeric,
  popularity numeric,
  runtime integer,
  year integer,
  overview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tmdb_id, media_type)
);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read catalog items"
  ON public.catalog_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert catalog items"
  ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update catalog items"
  ON public.catalog_items FOR UPDATE TO authenticated
  USING (true);

-- ══════════════════════════════════════════
-- Phase 1D: catalog_item_tags
-- ══════════════════════════════════════════
CREATE TABLE public.catalog_item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.preference_tags(id) ON DELETE CASCADE,
  weight numeric DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, tag_id)
);

ALTER TABLE public.catalog_item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read catalog item tags"
  ON public.catalog_item_tags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert catalog item tags"
  ON public.catalog_item_tags FOR INSERT TO authenticated
  WITH CHECK (true);

-- ══════════════════════════════════════════
-- Phase 1E: user_item_feedback
-- ══════════════════════════════════════════
CREATE TABLE public.user_item_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('liked','disliked','watched','skipped','saved','unsaved','rejected')),
  score numeric CHECK (score IS NULL OR (score BETWEEN -100 AND 100)),
  label text,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id, action)
);

ALTER TABLE public.user_item_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON public.user_item_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON public.user_item_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON public.user_item_feedback FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON public.user_item_feedback FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════
-- Phase 1F: recommendation_sessions
-- ══════════════════════════════════════════
CREATE TABLE public.recommendation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'surprise',
  taste_snapshot jsonb DEFAULT '{}'::jsonb,
  filters_snapshot jsonb DEFAULT '{}'::jsonb,
  results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.recommendation_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.recommendation_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.recommendation_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════
-- Phase 1G: recommendation_session_overrides
-- ══════════════════════════════════════════
CREATE TABLE public.recommendation_session_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.recommendation_sessions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.preference_tags(id) ON DELETE CASCADE,
  override_weight numeric NOT NULL CHECK (override_weight BETWEEN -100 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, tag_id)
);

ALTER TABLE public.recommendation_session_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session overrides"
  ON public.recommendation_session_overrides FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recommendation_sessions rs
    WHERE rs.id = recommendation_session_overrides.session_id
    AND rs.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own session overrides"
  ON public.recommendation_session_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recommendation_sessions rs
    WHERE rs.id = recommendation_session_overrides.session_id
    AND rs.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own session overrides"
  ON public.recommendation_session_overrides FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recommendation_sessions rs
    WHERE rs.id = recommendation_session_overrides.session_id
    AND rs.user_id = auth.uid()
  ));

-- ══════════════════════════════════════════
-- Indexes
-- ══════════════════════════════════════════
CREATE INDEX idx_user_preferences_user ON public.user_preferences(user_id);
CREATE INDEX idx_user_preferences_tag ON public.user_preferences(tag_id);
CREATE INDEX idx_catalog_items_tmdb ON public.catalog_items(tmdb_id, media_type);
CREATE INDEX idx_user_item_feedback_user ON public.user_item_feedback(user_id);
CREATE INDEX idx_user_item_feedback_item ON public.user_item_feedback(item_id);
CREATE INDEX idx_reco_sessions_user ON public.recommendation_sessions(user_id);
CREATE INDEX idx_catalog_item_tags_item ON public.catalog_item_tags(item_id);
CREATE INDEX idx_reco_session_overrides_session ON public.recommendation_session_overrides(session_id);
