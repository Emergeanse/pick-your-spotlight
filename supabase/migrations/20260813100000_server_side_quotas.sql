-- Quotas d'usage appliqués côté serveur.
--
-- Jusqu'ici, `daily_usage` était écrite par le navigateur : les politiques RLS
-- autorisaient chaque utilisateur à mettre à jour sa propre ligne de compteurs.
-- Autrement dit, il suffisait de remettre le compteur à zéro pour lever la
-- limite. Le freemium était décoratif, et surtout rien ne bornait le coût des
-- appels d'IA et de voix.
--
-- Ce qui change : les compteurs vivent désormais dans une table que le client
-- peut lire mais jamais écrire. Seules les fonctions serveur, via le rôle
-- service_role, peuvent les incrémenter — et la ligne du jour est verrouillée
-- le temps de la vérification, donc deux appels simultanés se suivent au lieu
-- de franchir le plafond ensemble.

-- ── Plafonds par plan ───────────────────────────────────────────────────────
-- Table plutôt que constantes : ajuster un seuil ne demande ni migration ni
-- redéploiement, juste un UPDATE depuis l'éditeur SQL.

CREATE TABLE IF NOT EXISTS public.plan_quotas (
  plan        text    NOT NULL,
  kind        text    NOT NULL,
  daily_limit integer,               -- NULL = illimité (à n'utiliser qu'en connaissance de cause)
  PRIMARY KEY (plan, kind)
);

ALTER TABLE public.plan_quotas ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte : l'interface affiche « il te reste N recommandations ».
-- Aucune politique d'écriture — donc personne n'écrit, hors service_role.
DROP POLICY IF EXISTS "Les plafonds sont publics" ON public.plan_quotas;
CREATE POLICY "Les plafonds sont publics"
  ON public.plan_quotas FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.plan_quotas (plan, kind, daily_limit) VALUES
  -- Palier gratuit : reprend l'intention produit déjà codée côté client.
  ('free',      'recommendation',  3),
  ('free',      'chat',            5),
  ('free',      'voice',           5),
  -- Palier Pick+ : large, mais fini. Un plafond infini laisserait le risque de
  -- coût entier, ce qui est précisément ce qu'on corrige ici.
  ('pick_plus', 'recommendation', 40),
  ('pick_plus', 'chat',          100),
  ('pick_plus', 'voice',          60)
ON CONFLICT (plan, kind) DO NOTHING;

-- ── Compteurs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id    uuid    NOT NULL,
  usage_date date    NOT NULL DEFAULT CURRENT_DATE,
  kind       text    NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date, kind)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Chacun voit sa consommation. Personne ne l'écrit : c'est tout l'objet du
-- changement. Aucune politique INSERT, UPDATE ou DELETE n'est créée.
DROP POLICY IF EXISTS "Chacun lit sa propre consommation" ON public.usage_counters;
CREATE POLICY "Chacun lit sa propre consommation"
  ON public.usage_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS usage_counters_date_idx ON public.usage_counters (usage_date);

-- ── Consommation d'un jeton de quota ───────────────────────────────────────
-- Renvoie systématiquement l'état complet, autorisé ou non : la fonction
-- appelante peut ainsi renvoyer un message utile plutôt qu'un simple refus.

CREATE OR REPLACE FUNCTION public.consume_quota(
  p_user_id uuid,
  p_kind    text,
  p_amount  integer DEFAULT 1
)
RETURNS TABLE (allowed boolean, used integer, quota integer, plan text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_plan  text;
  v_limit integer;
  v_used  integer;
BEGIN
  SELECT COALESCE(s.plan, 'free') INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id;

  -- Sans ligne d'abonnement, on retombe sur le palier le plus restrictif.
  v_plan := COALESCE(v_plan, 'free');

  SELECT q.daily_limit INTO v_limit
  FROM public.plan_quotas q
  WHERE q.plan = v_plan AND q.kind = p_kind;

  -- Un type d'usage non déclaré n'est pas limité : mieux vaut laisser passer
  -- une fonction oubliée que bloquer un usage légitime sur une faute de frappe.
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 0, NULL::integer, v_plan;
    RETURN;
  END IF;

  -- La ligne du jour est créée si besoin, puis verrouillée. Le verrou tient
  -- jusqu'à la fin de la transaction : deux appels simultanés se suivent au
  -- lieu de se marcher dessus, et ne peuvent donc pas franchir le plafond
  -- ensemble. Écrit en trois temps lisibles plutôt qu'en une instruction
  -- astucieuse — cette fonction garde la porte, sa justesse doit se vérifier
  -- à la lecture.
  INSERT INTO public.usage_counters (user_id, usage_date, kind, count)
  VALUES (p_user_id, CURRENT_DATE, p_kind, 0)
  ON CONFLICT (user_id, usage_date, kind) DO NOTHING;

  SELECT c.count INTO v_used
  FROM public.usage_counters c
  WHERE c.user_id = p_user_id
    AND c.usage_date = CURRENT_DATE
    AND c.kind = p_kind
  FOR UPDATE;

  v_used := COALESCE(v_used, 0);

  IF v_limit IS NOT NULL AND v_used + p_amount > v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit, v_plan;
    RETURN;
  END IF;

  UPDATE public.usage_counters c
  SET count = c.count + p_amount, updated_at = now()
  WHERE c.user_id = p_user_id
    AND c.usage_date = CURRENT_DATE
    AND c.kind = p_kind
  RETURNING c.count INTO v_used;

  RETURN QUERY SELECT true, v_used, v_limit, v_plan;
END;
$$;

-- Seules les fonctions serveur consomment du quota. Si le navigateur pouvait
-- appeler ceci, il pourrait consommer le quota d'autrui — ou s'en abstenir.
REVOKE ALL ON FUNCTION public.consume_quota(uuid, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, text, integer) TO service_role;

-- ── Lecture de sa propre consommation ──────────────────────────────────────
-- Pour l'affichage. Prend son identité de `auth.uid()`, jamais d'un paramètre :
-- impossible de lire la consommation de quelqu'un d'autre.

CREATE OR REPLACE FUNCTION public.get_my_quotas()
RETURNS TABLE (kind text, used integer, quota integer, plan text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    q.kind,
    COALESCE(c.count, 0)::integer AS used,
    q.daily_limit                 AS quota,
    q.plan
  FROM public.plan_quotas q
  LEFT JOIN public.usage_counters c
    ON c.user_id = auth.uid()
   AND c.usage_date = CURRENT_DATE
   AND c.kind = q.kind
  WHERE q.plan = COALESCE(
    (SELECT s.plan FROM public.subscriptions s WHERE s.user_id = auth.uid()),
    'free'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_quotas() TO authenticated;

-- ── Sort de l'ancienne table `daily_usage` ─────────────────────────────────
-- Elle reste écrite par le navigateur, et c'est assumé : elle ne fait plus
-- autorité sur rien. Elle sert au confort d'interface — notamment le suivi par
-- film des questions posées au compagnon, une granularité que le serveur n'a
-- pas besoin de connaître.
--
-- Le coût réel, lui, est borné par `usage_counters`, que le client ne peut pas
-- écrire. Un utilisateur qui remettrait `daily_usage` à zéro ne gagnerait donc
-- aucun appel d'IA supplémentaire : il ne tromperait que son propre affichage.
--
-- Les politiques d'écriture sont laissées en place volontairement : les retirer
-- casserait le suivi par film sans rien sécuriser de plus.

COMMENT ON TABLE public.daily_usage IS
  'Compteurs de confort côté interface. NE FAIT PAS AUTORITÉ : le plafonnement réel est dans usage_counters, alimentée par consume_quota.';

COMMENT ON TABLE public.usage_counters IS
  'Compteurs faisant autorité. Écrits uniquement par consume_quota (service_role). Le client peut lire les siens, jamais les écrire.';

-- ── Position alpha : Pick+ pour tout le monde ──────────────────────────────
-- Les deux paliers existent et sont appliqués. Personne n'est dégradé pour
-- autant : chaque compte est sur le palier Pick+, offert.
--
-- 👉 POUR ACTIVER LE FREEMIUM : repasser le défaut du déclencheur à 'free' et
--    exécuter `UPDATE public.subscriptions SET plan = 'free';`. Rien d'autre.

UPDATE public.subscriptions SET plan = 'pick_plus' WHERE plan = 'free';

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'pick_plus', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
