-- Palier gratuit à 9 recommandations, et un palier sans plafond pour l'équipe.
--
-- Deux demandes de Chris du 17 août.

-- ── 1. Trois essais par jour, c'était trop court ───────────────────────────
-- Se tromper d'humeur ou de genre consommait un tiers de la journée.

UPDATE public.plan_quotas
SET daily_limit = 9
WHERE plan = 'free' AND kind = 'recommendation';

-- ── 2. Un palier « staff », hors quota ─────────────────────────────────────
-- `daily_limit` à NULL vaut « sans plafond » dans `consume_quota` : la
-- consommation continue d'être comptée, mais rien n'est jamais refusé. On garde
-- donc la mesure sans la contrainte — utile pour voir ce qu'un usage intensif
-- coûte réellement.
--
-- ⚠️ Un compte sur ce palier n'a plus aucune borne de dépense. À n'accorder
-- qu'aux comptes dont on assume la facture.

INSERT INTO public.plan_quotas (plan, kind, daily_limit) VALUES
  ('staff', 'recommendation', NULL),
  ('staff', 'chat',           NULL),
  ('staff', 'voice',          NULL)
ON CONFLICT (plan, kind) DO UPDATE SET daily_limit = EXCLUDED.daily_limit;

-- ── 3. Le compte de Chris passe sur ce palier ──────────────────────────────
-- Désigné par son adresse plutôt que par un identifiant en dur : la requête
-- reste lisible et rejouable. Pour exempter quelqu'un d'autre plus tard, même
-- requête avec son adresse.
--
-- Le rôle d'administrateur n'est volontairement PAS utilisé comme critère :
-- nommer un administrateur ne doit pas lever sa limite de dépense sans qu'on
-- l'ait décidé.

UPDATE public.subscriptions s
SET plan = 'staff', updated_at = now()
FROM auth.users u
WHERE u.id = s.user_id
  AND lower(u.email) = 'cbilleux@gmail.com';

-- `usePickPlus` traite tout plan différent de 'free' comme premium : un compte
-- « staff » ne voit donc aucun mur de paiement, et `get_my_quotas` lui renvoie
-- des plafonds nuls que l'interface affiche comme illimités.
