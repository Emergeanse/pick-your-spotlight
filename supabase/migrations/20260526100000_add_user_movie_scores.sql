-- ══════════════════════════════════════════════════════════════════════════
-- user_movie_scores
-- Couche de scoring normalisé : output de l'interprétation des événements.
-- Alimentée automatiquement par triggers sur liked_movies, watchlist,
-- user_interactions. Remplace la logique inline du taste-engine côté client.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.user_movie_scores (
  user_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id     integer NOT NULL,  -- TMDB ID
  score        float   NOT NULL DEFAULT 0,   -- normalisé [-1, +1]
  confidence   float   NOT NULL DEFAULT 0,   -- [0, 1] — sature à 5 signaux
  signals      jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- détail des contributions
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

CREATE INDEX idx_user_movie_scores_user  ON public.user_movie_scores(user_id);
CREATE INDEX idx_user_movie_scores_score ON public.user_movie_scores(user_id, score DESC);

ALTER TABLE public.user_movie_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores"
  ON public.user_movie_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── Fonction de scoring ────────────────────────────────────────────────────
--
-- Agrège tous les signaux connus pour (user, movie) depuis les trois
-- tables sources et upserte le résultat dans user_movie_scores.
-- Si aucun signal n'existe, supprime la ligne.
--
-- Poids par type d'action :
--   love                  : +2.0   (coup de cœur explicite)
--   like / liked_movies   : +1.0   (like standard)
--   watchlist             : +0.5   (intérêt sans engagement)
--   watched               : +0.3   (consommation neutre positive)
--   unsure                : -0.4   (doute)
--   skipped               : -0.3   (skip session)
--   rejected_not_tonight  : -0.4   (temporaire)
--   rejected_too_long     : -0.6   (durée, signal faible)
--   rejected_too_slow     : -0.8   (rythme)
--   rejected_too_intense  : -0.8   (contenu)
--   rejected_style        : -1.5   (rejet de style — signal fort)
--   dislike               : -1.5   (rejet explicite fort)
--   unliked               : -1.5   (like retiré)
--
-- Score final = CLAMP(raw_score / 2.0, -1, +1)
-- Confidence = MIN(1, signal_count / 5)

CREATE OR REPLACE FUNCTION public.recompute_user_movie_score(
  p_user_id uuid,
  p_movie_id integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_raw_score    float := 0;
  v_signal_count integer := 0;
  v_signals      jsonb := '[]'::jsonb;
  v_weight       float;
  v_rec          RECORD;
BEGIN

  -- ── Signaux depuis liked_movies ──
  FOR v_rec IN
    SELECT liked_at AS ts
    FROM public.liked_movies
    WHERE user_id = p_user_id AND tmdb_id = p_movie_id
  LOOP
    v_weight := 1.0;
    v_raw_score    := v_raw_score + v_weight;
    v_signal_count := v_signal_count + 1;
    v_signals := v_signals || jsonb_build_array(
      jsonb_build_object('type', 'like', 'weight', v_weight, 'date', v_rec.ts)
    );
  END LOOP;

  -- ── Signaux depuis watchlist ──
  FOR v_rec IN
    SELECT added_at AS ts
    FROM public.watchlist
    WHERE user_id = p_user_id AND tmdb_id = p_movie_id
  LOOP
    v_weight := 0.5;
    v_raw_score    := v_raw_score + v_weight;
    v_signal_count := v_signal_count + 1;
    v_signals := v_signals || jsonb_build_array(
      jsonb_build_object('type', 'watchlist', 'weight', v_weight, 'date', v_rec.ts)
    );
  END LOOP;

  -- ── Signaux depuis user_interactions ──
  FOR v_rec IN
    SELECT action_type, created_at AS ts
    FROM public.user_interactions
    WHERE user_id = p_user_id AND tmdb_id = p_movie_id
    ORDER BY created_at DESC
  LOOP
    v_weight := CASE v_rec.action_type
      WHEN 'love'                 THEN  2.0
      WHEN 'like'                 THEN  1.0
      WHEN 'watched'              THEN  0.3
      WHEN 'unsure'               THEN -0.4
      WHEN 'skipped'              THEN -0.3
      WHEN 'rejected_not_tonight' THEN -0.4
      WHEN 'rejected_too_long'    THEN -0.6
      WHEN 'rejected_too_slow'    THEN -0.8
      WHEN 'rejected_too_intense' THEN -0.8
      WHEN 'rejected_style'       THEN -1.5
      WHEN 'dislike'              THEN -1.5
      WHEN 'unliked'              THEN -1.5
      ELSE 0
    END;
    CONTINUE WHEN v_weight = 0;
    v_raw_score    := v_raw_score + v_weight;
    v_signal_count := v_signal_count + 1;
    v_signals := v_signals || jsonb_build_array(
      jsonb_build_object('type', v_rec.action_type, 'weight', v_weight, 'date', v_rec.ts)
    );
  END LOOP;

  -- ── Aucun signal → suppression ──
  IF v_signal_count = 0 THEN
    DELETE FROM public.user_movie_scores
    WHERE user_id = p_user_id AND movie_id = p_movie_id;
    RETURN;
  END IF;

  -- ── Normalisation et upsert ──
  INSERT INTO public.user_movie_scores
    (user_id, movie_id, score, confidence, signals, last_updated)
  VALUES (
    p_user_id,
    p_movie_id,
    GREATEST(-1.0, LEAST(1.0, v_raw_score / 2.0)),
    LEAST(1.0, v_signal_count::float / 5.0),
    v_signals,
    now()
  )
  ON CONFLICT (user_id, movie_id) DO UPDATE SET
    score        = EXCLUDED.score,
    confidence   = EXCLUDED.confidence,
    signals      = EXCLUDED.signals,
    last_updated = EXCLUDED.last_updated;

END;
$$;

-- ── Triggers ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._trg_recompute_on_interaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_movie_score(OLD.user_id, OLD.tmdb_id);
  ELSE
    PERFORM public.recompute_user_movie_score(NEW.user_id, NEW.tmdb_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_recompute_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_movie_score(OLD.user_id, OLD.tmdb_id);
  ELSE
    PERFORM public.recompute_user_movie_score(NEW.user_id, NEW.tmdb_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_recompute_on_watchlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_movie_score(OLD.user_id, OLD.tmdb_id);
  ELSE
    PERFORM public.recompute_user_movie_score(NEW.user_id, NEW.tmdb_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_user_interactions_score
  AFTER INSERT OR UPDATE OR DELETE ON public.user_interactions
  FOR EACH ROW EXECUTE FUNCTION public._trg_recompute_on_interaction();

CREATE TRIGGER trg_liked_movies_score
  AFTER INSERT OR UPDATE OR DELETE ON public.liked_movies
  FOR EACH ROW EXECUTE FUNCTION public._trg_recompute_on_like();

CREATE TRIGGER trg_watchlist_score
  AFTER INSERT OR UPDATE OR DELETE ON public.watchlist
  FOR EACH ROW EXECUTE FUNCTION public._trg_recompute_on_watchlist();

-- ── Backfill des données existantes ───────────────────────────────────────
-- Traite tous les (user_id, tmdb_id) distincts présents dans les 3 tables.

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN (
    SELECT DISTINCT user_id, tmdb_id AS movie_id FROM (
      SELECT user_id, tmdb_id FROM public.liked_movies
      UNION
      SELECT user_id, tmdb_id FROM public.watchlist
      UNION
      SELECT user_id, tmdb_id FROM public.user_interactions
      WHERE tmdb_id IS NOT NULL
    ) combined
  )
  LOOP
    PERFORM public.recompute_user_movie_score(v_rec.user_id, v_rec.movie_id);
  END LOOP;
END;
$$;
