-- Ancrer le rôle administrateur en base, avant de le retirer du code client.
--
-- `useAdmin` accordait le statut sur simple correspondance d'adresse e-mail,
-- depuis une liste écrite en dur dans le navigateur. Deux problèmes : la liste
-- des administrateurs est publique pour qui lit le code livré, et le contrôle
-- se fait du côté qu'on ne maîtrise pas.
--
-- Le hook sait déjà lire `user_roles` — c'était son second chemin. Cette
-- migration s'assure simplement que la ligne existe AVANT que la liste d'adresses
-- ne disparaisse, sans quoi le compte perdrait l'accès à l'administration.
--
-- Idempotente : la rejouer ne fait rien de plus.

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'cbilleux@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Pour accorder le rôle à quelqu'un d'autre plus tard, même requête avec son
-- adresse. C'est désormais le seul endroit où un administrateur se désigne, et
-- il est côté serveur — pas dans le code téléchargé par les navigateurs.
