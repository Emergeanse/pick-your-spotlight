-- Minimisation des données de profil visibles par les autres.
--
-- `profiles` porte 49 colonnes. Huit seulement servent à autrui : prénom
-- affiché, avatar, bio, podium, code ami, genres aimés et exclus. Les 41 autres
-- — année de naissance, tranche d'âge, seuils de recommandation, avancement de
-- l'initiation, statistiques d'usage — ne regardent que leur propriétaire.
--
-- Or trois politiques ouvraient la LIGNE ENTIÈRE :
--
--   « Users can view accepted friends profiles »     → tout ami accepté
--   « Users can view pending friendship counterpart » → toute demande en cours
--   « Duo members can view each other profiles »      → tout partenaire de duo
--
-- La deuxième mérite une mention particulière. Son commentaire d'origine
-- annonçait « minimal info », mais le RLS PostgreSQL ne sait pas restreindre des
-- colonnes : une politique de lecture donne toute la ligne, sans exception.
--
-- Conséquence, et c'est la vraie portée du correctif du 12 août : faire passer
-- l'amitié de `accepted` à `pending` à l'entrée d'une soirée a supprimé le lien
-- social non consenti, mais PAS l'accès aux données. La demande en attente
-- suffisait à lire l'année de naissance de l'organisateur. Le premier maillon
-- était bien coupé, le second tenait toujours.
--
-- Ici, on coupe le second : `profiles` n'est plus lisible que par son
-- propriétaire, et les autres passent par une fonction qui ne rend que les
-- colonnes partageables — et pas les mêmes selon le lien qui vous unit.

-- ── La ligne complète, à son seul propriétaire ─────────────────────────────

DROP POLICY IF EXISTS "Users can view accepted friends profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Users can view pending friendship counterpart" ON public.profiles;
DROP POLICY IF EXISTS "Duo members can view each other profiles"    ON public.profiles;

-- Recréée sous son nom d'origine plutôt qu'ajoutée à côté : on veut la certitude
-- qu'il ne reste qu'UNE politique de lecture sur cette table, quel que soit
-- l'état réel de la base. Les politiques RLS se combinent en OU — il suffit
-- d'une seule trop large pour que tout le reste ne serve à rien.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- ── Ce que les autres peuvent voir ─────────────────────────────────────────
--
-- Deux niveaux, parce que tous les liens ne se valent pas :
--
--   proche  — ami accepté ou partenaire de duo actif. Voit la fiche publique
--             entière, goûts compris : c'est ce dont vivent la page ADN et le
--             calcul des goûts communs.
--   croise  — simple co-participant d'une soirée, ou demande d'ami en attente.
--             Voit de quoi afficher un nom et une pastille, rien de plus.
--
-- Un inconnu ne voit rien : la fonction ne renvoie aucune ligne pour lui.

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

        -- Co-participants d'une même soirée. Nécessaire depuis que rejoindre
        -- une soirée ne crée plus d'amitié acceptée : sans ça, les prénoms
        -- disparaîtraient de la liste des participants.
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
          SELECT 1
          FROM public.group_session_members a
          JOIN public.group_session_members b ON b.session_id = a.session_id
          WHERE a.user_id = (SELECT uid FROM moi) AND b.user_id = p.id
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

COMMENT ON FUNCTION public.get_visible_profiles(uuid[]) IS
  'Seule voie de lecture d''un profil qui n''est pas le sien. Ne rend que les colonnes partageables, et les restreint encore pour un simple co-participant. Le RLS ne sachant pas filtrer par colonne, toute politique de lecture sur profiles rendrait les 49 colonnes.';

COMMENT ON TABLE public.profiles IS
  'Lisible par son seul propriétaire. Les autres passent par get_visible_profiles() — n''ajouter aucune politique SELECT ici sans mesurer que cela expose la ligne entière.';
