-- La loupe cesse de puiser dans le quota « conversations ».
--
-- Constat du 2 septembre : cinq recherches à la loupe suffisaient à verrouiller
-- le compagnon de film, le chat Pick et l'analyse des phrases pour la journée.
-- Les quatre partageaient le même compteur `chat`, plafonné à 5 en gratuit.
--
-- Chercher un film n'est pas converser : c'est le geste de découverte de base,
-- il doit avoir sa propre enveloppe. D'où un quatrième type d'usage.

-- ── 1. Plafonds du nouveau type ────────────────────────────────────────────
-- Un appel d'identification, c'est une requête Gemini Flash très courte
-- (200 jetons de sortie, sans réflexion) plus deux appels TMDB. Beaucoup moins
-- cher qu'une conversation, d'où un plafond gratuit plus large que les 5
-- conversations.

INSERT INTO public.plan_quotas (plan, kind, daily_limit) VALUES
  ('free',      'search', 10),
  ('pick_plus', 'search', 60),
  ('staff',     'search', NULL)   -- NULL = sans plafond, cohérent avec le palier
ON CONFLICT (plan, kind) DO UPDATE SET daily_limit = EXCLUDED.daily_limit;

-- ── 2. Le palier « staff » de Chris, réappliqué ────────────────────────────
-- La migration du 17 août faisait un UPDATE sur `subscriptions`. Un UPDATE ne
-- touche rien quand la ligne n'existe pas : un compte sans abonnement enregistré
-- restait donc en `free` sans que rien ne le signale — c'est ce qui s'est
-- produit. On insère la ligne si besoin, et on la corrige sinon.

INSERT INTO public.subscriptions (user_id, plan, status)
SELECT u.id, 'staff', 'active'
FROM auth.users u
WHERE lower(u.email) = 'cbilleux@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET plan = 'staff', updated_at = now();
