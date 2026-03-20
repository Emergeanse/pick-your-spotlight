
-- 1. Engine performance metrics table (aggregated daily)
CREATE TABLE public.engine_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  metric_type text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_date, metric_type)
);

ALTER TABLE public.engine_metrics ENABLE ROW LEVEL SECURITY;

-- Only readable by admins
CREATE POLICY "Admins can view engine metrics"
  ON public.engine_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert engine metrics"
  ON public.engine_metrics FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Enrich movie_embeddings with semantic axes, metadata
ALTER TABLE public.movie_embeddings
  ADD COLUMN IF NOT EXISTS semantic_axes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS suitability_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS runtime integer,
  ADD COLUMN IF NOT EXISTS popularity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vote_average numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'movie',
  ADD COLUMN IF NOT EXISTS platform_ids integer[] NOT NULL DEFAULT '{}'::integer[],
  ADD COLUMN IF NOT EXISTS cluster_labels text[] NOT NULL DEFAULT '{}'::text[];
