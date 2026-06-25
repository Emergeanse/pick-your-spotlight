-- Notification quand le film d'une soirée est choisi
-- Trigger sur events → UPDATE final_pick_title (surprise, vote, timed)

CREATE OR REPLACE FUNCTION public.notify_event_film_chosen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant record;
BEGIN
  IF NEW.final_pick_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Évite les doublons si le film est déjà enregistré
  IF OLD.final_pick_title IS NOT NULL
     AND OLD.final_pick_title = NEW.final_pick_title THEN
    RETURN NEW;
  END IF;

  FOR v_participant IN
    SELECT user_id
      FROM event_participants
     WHERE event_id = NEW.id
       AND user_id IS NOT NULL
       AND status <> 'declined'
       AND user_id <> NEW.organizer_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_participant.user_id,
      'event_film_chosen',
      'Le film de la soirée a été choisi !',
      NEW.final_pick_title,
      jsonb_build_object(
        'event_id',        NEW.id,
        'event_title',     NEW.title,
        'film_title',      NEW.final_pick_title,
        'film_poster',     NEW.final_pick_poster,
        'film_tmdb_id',    NEW.final_pick_tmdb_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_film_chosen ON public.events;
CREATE TRIGGER trg_notify_event_film_chosen
  AFTER UPDATE OF final_pick_title, final_pick_tmdb_id, status ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_event_film_chosen();
