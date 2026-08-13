-- Journal des erreurs.
--
-- Jusqu'ici, une erreur dans le navigateur d'un utilisateur n'existait que dans
-- sa console : personne ne la voyait jamais. Les fonctions serveur, elles, sont
-- déjà tracées par la plateforme — le vrai angle mort est côté navigateur.
--
-- Pourquoi une table plutôt qu'un service comme Sentry : la politique de
-- confidentialité publiée le 12 août nomme exactement quatre destinataires des
-- données. En ajouter un cinquième rendrait cette page fausse le jour même, et
-- imposerait de la republier. Garder le journal chez soi évite ce détour, et
-- suffit largement à l'échelle actuelle. Le jour où le volume le justifie, rien
-- n'empêche d'y venir — mais ce sera une décision, pas un effet de bord.

CREATE TABLE IF NOT EXISTS public.error_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,                     -- NULL si l'erreur précède la connexion
  source      text NOT NULL DEFAULT 'client',
  message     text NOT NULL,
  stack       text,
  route       text,
  user_agent  text,
  context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Ce point d'écriture est ouvert par nature : il doit accepter les erreurs de
  -- visiteurs non connectés. Les longueurs sont donc bornées ici, pas seulement
  -- côté client, où rien ne garantit qu'elles le soient.
  CONSTRAINT error_events_message_len CHECK (char_length(message)    <= 2000),
  CONSTRAINT error_events_stack_len   CHECK (stack      IS NULL OR char_length(stack)      <= 8000),
  CONSTRAINT error_events_route_len   CHECK (route      IS NULL OR char_length(route)      <= 500),
  CONSTRAINT error_events_ua_len      CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  CONSTRAINT error_events_source_ok   CHECK (source IN ('client', 'server'))
);

CREATE INDEX IF NOT EXISTS error_events_created_idx ON public.error_events (created_at DESC);
CREATE INDEX IF NOT EXISTS error_events_user_idx    ON public.error_events (user_id, created_at DESC);

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

-- Écriture : ouverte, y compris aux visiteurs non connectés — une erreur au
-- moment de l'inscription est précisément celle qu'on veut voir. Un utilisateur
-- connecté ne peut en revanche pas signer une erreur du nom d'un autre.
DROP POLICY IF EXISTS "Chacun peut signaler une erreur" ON public.error_events;
CREATE POLICY "Chacun peut signaler une erreur"
  ON public.error_events FOR INSERT TO authenticated, anon
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Lecture : les administrateurs seulement. Une trace d'erreur contient des
-- chemins, des identifiants et parfois des bouts de données — ce n'est pas
-- matière à consultation publique.
DROP POLICY IF EXISTS "Les administrateurs lisent les erreurs" ON public.error_events;
CREATE POLICY "Les administrateurs lisent les erreurs"
  ON public.error_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.error_events IS
  'Journal des erreurs applicatives. Écriture ouverte (les erreurs d''avant connexion comptent aussi), lecture réservée aux administrateurs. Purger au-delà de 90 jours.';

-- Purge. Appelée à la main pour l'instant : sans planificateur en place, mieux
-- vaut une fonction prête et documentée qu'un CRON qu'on croit actif.
CREATE OR REPLACE FUNCTION public.purge_old_error_events(p_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_supprimees integer;
BEGIN
  DELETE FROM public.error_events
  WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_supprimees = ROW_COUNT;
  RETURN v_supprimees;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_error_events(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_error_events(integer) TO service_role;
