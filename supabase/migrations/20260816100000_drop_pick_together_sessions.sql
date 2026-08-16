-- Retrait du système Pick Together (`group_sessions`).
--
-- Deux systèmes de groupe cohabitaient :
--
--   Soirées         `events` / `event_participants`  — développé tout l'été :
--                   contextes famille et entre amis, contrainte d'âge du plus
--                   jeune, fusion des profils de goût, invitations par jeton.
--
--   Pick Together   `group_sessions` / `group_session_members` — antérieur,
--                   sessions à code d'invitation.
--
-- Le second n'était plus atteignable : aucun lien d'interface vers
-- `/app/pick-together-group`, `/app/plan` accessible depuis une page elle-même
-- non routée, et `/join` seulement par un ancien lien. Deux modèles de données
-- à sécuriser en parallèle pour un seul usage réel — c'est ce qui a fait durcir
-- `join-session` le 12 août sans que les soirées en profitent.
--
-- L'application étant en test, les anciens liens d'invitation ne sont pas
-- préservés : décision de Chris du 16 août.

-- ── La visibilité des profils ne s'appuie plus sur ces tables ──────────────
-- Le niveau « croisé » couvrait les co-participants d'une session de groupe.
-- Il ne reste que les co-participants d'une soirée et les demandes d'ami.

CREATE OR REPLACE FUNCTION public.get_visible_profiles(p_ids uuid[])
RETURNS TABLE (
  id              uuid,
  display_name    text,
  avatar_url      text,
  bio             text,
  podium_film_ids integer[],
  friend_code     text,
  favorite_genres text[],
  excluded_genres text[],
  relation        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH moi AS (SELECT auth.uid() AS uid),
  lien AS (
    SELECT
      p.id,
      CASE
        WHEN p.id = (SELECT uid FROM moi) THEN 'moi'

        WHEN EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = (SELECT uid FROM moi) AND f.addressee_id = p.id)
              OR (f.addressee_id = (SELECT uid FROM moi) AND f.requester_id = p.id))
        ) THEN 'proche'

        WHEN EXISTS (
          SELECT 1 FROM public.duo_taste_profiles d
          WHERE d.status = 'active'
            AND ((d.user1_id = (SELECT uid FROM moi) AND d.user2_id = p.id)
              OR (d.user2_id = (SELECT uid FROM moi) AND d.user1_id = p.id))
        ) THEN 'proche'

        WHEN EXISTS (
          SELECT 1
          FROM public.event_participants a
          JOIN public.event_participants b ON b.event_id = a.event_id
          WHERE a.user_id = (SELECT uid FROM moi) AND b.user_id = p.id
        ) THEN 'croise'

        WHEN EXISTS (
          SELECT 1 FROM public.events e
          JOIN public.event_participants a ON a.event_id = e.id
          WHERE (e.organizer_id = (SELECT uid FROM moi) AND a.user_id = p.id)
             OR (e.organizer_id = p.id AND a.user_id = (SELECT uid FROM moi))
        ) THEN 'croise'

        WHEN EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'pending'
            AND ((f.requester_id = (SELECT uid FROM moi) AND f.addressee_id = p.id)
              OR (f.addressee_id = (SELECT uid FROM moi) AND f.requester_id = p.id))
        ) THEN 'croise'

        ELSE NULL
      END AS relation
    FROM public.profiles p
    WHERE p.id = ANY(p_ids)
  )
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    CASE WHEN l.relation IN ('moi', 'proche') THEN p.bio             END,
    CASE WHEN l.relation IN ('moi', 'proche') THEN p.podium_film_ids END,
    CASE WHEN l.relation IN ('moi', 'proche') THEN p.friend_code     END,
    CASE WHEN l.relation IN ('moi', 'proche') THEN p.favorite_genres END,
    CASE WHEN l.relation IN ('moi', 'proche') THEN p.excluded_genres END,
    l.relation
  FROM lien l
  JOIN public.profiles p ON p.id = l.id
  WHERE l.relation IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_visible_profiles(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated;

-- ── Détacher l'historique ──────────────────────────────────────────────────
-- `recommendation_sessions.group_session_id` pointait vers les sessions
-- retirées. La colonne est vidée et sa contrainte levée : l'historique des
-- recommandations reste intact, il perd seulement un rattachement devenu
-- caduc. Sa colonne `audience_type` continue de distinguer solo et groupe.

ALTER TABLE public.recommendation_sessions
  DROP CONSTRAINT IF EXISTS recommendation_sessions_group_session_id_fkey;

UPDATE public.recommendation_sessions
SET group_session_id = NULL
WHERE group_session_id IS NOT NULL;

-- ── Suppression ────────────────────────────────────────────────────────────
-- Les membres d'abord : ils référencent les sessions.

DROP TABLE IF EXISTS public.group_session_members CASCADE;
DROP TABLE IF EXISTS public.group_sessions CASCADE;

-- `is_session_member` ne servait qu'aux politiques de ces deux tables, parties
-- avec elles. `auth_uid_is_event_member`, qui concerne les soirées, reste.
DROP FUNCTION IF EXISTS public.is_session_member(uuid, uuid);
