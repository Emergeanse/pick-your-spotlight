-- Backfill feedback_type depuis label pour les lignes legacy
-- Certains likes anciens ont été insérés avant que feedback_type existe,
-- avec seulement label = 'like' et feedback_type = NULL.
-- Ces lignes échappent à listFeedbackByType("like") qui filtre sur .eq("feedback_type","like"),
-- donc leurs tmdb_ids ne rejoignent jamais la liste d'exclusion.

UPDATE public.user_item_feedback
SET feedback_type = label
WHERE feedback_type IS NULL
  AND label IS NOT NULL;
