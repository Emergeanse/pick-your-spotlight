-- Phase 1: Pick V1 schema extension (non-destructive)

-- 1.1 recommendation_sessions
ALTER TABLE public.recommendation_sessions
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS decision_mode text NOT NULL DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS group_session_id uuid,
  ADD COLUMN IF NOT EXISTS prompt_text text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS selected_catalog_item_id uuid;

DO $$ BEGIN
  ALTER TABLE public.recommendation_sessions
    ADD CONSTRAINT recommendation_sessions_audience_type_check
    CHECK (audience_type IN ('solo','group'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.recommendation_sessions
    ADD CONSTRAINT recommendation_sessions_decision_mode_check
    CHECK (decision_mode IN ('instant','planned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.recommendation_sessions
    ADD CONSTRAINT recommendation_sessions_status_check
    CHECK (status IN ('active','completed','abandoned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_reco_sessions_user_status
  ON public.recommendation_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reco_sessions_group
  ON public.recommendation_sessions(group_session_id);

-- 1.2 group_sessions
ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS decision_mode text NOT NULL DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_catalog_item_id uuid;

DO $$ BEGIN
  ALTER TABLE public.group_sessions
    ADD CONSTRAINT group_sessions_decision_mode_check
    CHECK (decision_mode IN ('instant','planned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.group_sessions
    ADD CONSTRAINT group_sessions_status_check
    CHECK (status IN ('active','completed','abandoned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.3 group_session_members (guest support)
ALTER TABLE public.group_session_members
  ADD COLUMN IF NOT EXISTS guest_age_range text,
  ADD COLUMN IF NOT EXISTS guest_profile_text text,
  ADD COLUMN IF NOT EXISTS guest_preferences_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 1.4 user_item_feedback (canonical fields)
ALTER TABLE public.user_item_feedback
  ADD COLUMN IF NOT EXISTS feedback_type text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS context_type text,
  ADD COLUMN IF NOT EXISTS context_id uuid;

-- Backfill feedback_type from existing label/action
UPDATE public.user_item_feedback
SET feedback_type = COALESCE(feedback_type, label, action)
WHERE feedback_type IS NULL;

DO $$ BEGIN
  ALTER TABLE public.user_item_feedback
    ADD CONSTRAINT user_item_feedback_feedback_type_check
    CHECK (feedback_type IN ('like','love','seen','not_for_me','watchlist','skip','dislike','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_item_feedback
    ADD CONSTRAINT user_item_feedback_context_type_check
    CHECK (context_type IS NULL OR context_type IN ('solo_session','group_session','browse'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_item_feedback_unique
  ON public.user_item_feedback(user_id, item_id, feedback_type)
  WHERE feedback_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_item_feedback_user_type
  ON public.user_item_feedback(user_id, feedback_type);