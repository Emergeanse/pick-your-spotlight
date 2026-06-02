-- Synchronise les duos actifs existants vers la table friendships
-- Pour chaque duo actif (user1_id, user2_id), crée une amitié acceptée si elle n'existe pas déjà

INSERT INTO public.friendships (requester_id, addressee_id, status)
SELECT
  d.user1_id,
  d.user2_id,
  'accepted'
FROM public.duo_taste_profiles d
WHERE
  d.status = 'active'
  AND d.user2_id IS NOT NULL
  -- Ne pas créer si une amitié existe déjà dans les deux sens
  AND NOT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE
      (f.requester_id = d.user1_id AND f.addressee_id = d.user2_id)
      OR (f.requester_id = d.user2_id AND f.addressee_id = d.user1_id)
  );
