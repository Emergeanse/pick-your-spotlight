-- Distinctions de l'ADN cinéma.
--
-- Les trophées se calculent dans le téléphone de chacun, à partir de données
-- qu'un ami ne peut pas lire. On enregistre donc la liste des trophées obtenus
-- (des clés comme « recos-3 », rien d'autre) et, au plus trois, ceux que la
-- personne choisit d'épingler. get_adn_visible les rend à qui voit l'ADN.

ALTER TABLE public.adn_cinema
  ADD COLUMN IF NOT EXISTS distinctions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS distinctions_epinglees text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.adn_cinema DROP CONSTRAINT IF EXISTS adn_cinema_epinglees_max3;
ALTER TABLE public.adn_cinema
  ADD CONSTRAINT adn_cinema_epinglees_max3 CHECK (cardinality(distinctions_epinglees) <= 3);

CREATE OR REPLACE FUNCTION public.get_adn_visible(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  moi        uuid := auth.uid();
  relation   text;
  niveau     text;
  ligne      public.adn_cinema%ROWTYPE;
  prof       record;
  cine       record;
  traits_out jsonb;
BEGIN
  IF moi IS NULL THEN RETURN NULL; END IF;

  IF p_user_id = moi THEN
    relation := 'moi';
  ELSIF EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = moi AND f.addressee_id = p_user_id)
        OR (f.addressee_id = moi AND f.requester_id = p_user_id))
  ) OR EXISTS (
    SELECT 1 FROM public.duo_taste_profiles d
    WHERE d.status = 'active'
      AND ((d.user1_id = moi AND d.user2_id = p_user_id)
        OR (d.user2_id = moi AND d.user1_id = p_user_id))
  ) THEN
    relation := 'proche';
  ELSIF EXISTS (
    SELECT 1 FROM public.event_participants a
    JOIN public.event_participants b ON b.event_id = a.event_id
    WHERE a.user_id = moi AND b.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.event_participants a ON a.event_id = e.id
    WHERE (e.organizer_id = moi AND a.user_id = p_user_id)
       OR (e.organizer_id = p_user_id AND a.user_id = moi)
  ) OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'pending'
      AND ((f.requester_id = moi AND f.addressee_id = p_user_id)
        OR (f.addressee_id = moi AND f.requester_id = p_user_id))
  ) THEN
    relation := 'croise';
  ELSE
    RETURN jsonb_build_object('niveau', 'aucun');
  END IF;

  SELECT * INTO ligne FROM public.adn_cinema WHERE user_id = p_user_id;

  -- Réglage de visibilité choisi par la personne consultée.
  niveau := CASE
    WHEN relation = 'moi' THEN 'moi'
    WHEN COALESCE(ligne.visibilite, 'amis_et_soirees') = 'moi' THEN 'aucun'
    WHEN relation = 'proche' THEN 'ami'
    WHEN COALESCE(ligne.visibilite, 'amis_et_soirees') = 'amis_et_soirees' THEN 'soiree'
    ELSE 'aucun'
  END;
  IF niveau = 'aucun' THEN RETURN jsonb_build_object('niveau', 'aucun'); END IF;

  SELECT p.bio, p.podium_film_ids INTO prof FROM public.profiles p WHERE p.id = p_user_id;
  SELECT c.dna_archetype, c.personality_title, c.narrative INTO cine
    FROM public.cinematic_profiles c WHERE c.user_id = p_user_id;

  -- Version allégée : traits arrondis à la vingtaine — assez pour dessiner la
  -- forme de la constellation, pas pour lire le détail des goûts.
  IF ligne.traits IS NOT NULL AND niveau = 'soiree' THEN
    SELECT jsonb_object_agg(k, GREATEST(10, LEAST(90, (round((v::text)::numeric / 20) * 20)::int)))
      INTO traits_out FROM jsonb_each(ligne.traits) AS t(k, v);
  ELSE
    traits_out := ligne.traits;
  END IF;

  RETURN jsonb_build_object(
    'niveau',     niveau,
    'traits',     traits_out,
    'univers',    COALESCE(to_jsonb(ligne.univers), '[]'::jsonb),
    'archetype',  COALESCE(cine.dna_archetype, cine.personality_title),
    'narrative',  CASE WHEN niveau IN ('moi', 'ami') THEN cine.narrative END,
    'bio',        prof.bio,
    'podium',     to_jsonb(prof.podium_film_ids),
    'visibilite', CASE WHEN niveau = 'moi' THEN COALESCE(ligne.visibilite, 'amis_et_soirees') END,
    -- Distinctions : les trophées obtenus seulement, jamais les verrouillés ni
    -- la progression (qui restent dans le profil privé).
    'distinctions', COALESCE(to_jsonb(ligne.distinctions), '[]'::jsonb),
    'epinglees',    COALESCE(to_jsonb(ligne.distinctions_epinglees), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_adn_visible(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_adn_visible(uuid) TO authenticated;
