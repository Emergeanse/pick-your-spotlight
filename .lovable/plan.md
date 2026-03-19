

## Plan: Page d'invitation attractive pour les non-inscrits

### Concept

Redesigner la page `/join` pour les utilisateurs non connectés. Au lieu d'un simple bouton "Se connecter", afficher une page marketing attrayante avec le nom de l'hôte, deux options claires (créer un compte vs invité), et les avantages de créer un compte.

### Changements — `src/pages/JoinSession.tsx`

Refonte complète de la section non-authentifiée :

1. **Hero section** : mascotte Pick qui fait coucou + badge "Soirée ciné" + titre personnalisé "{creatorName} t'invite à une soirée ciné !"

2. **Deux boutons principaux côte à côte ou empilés** :
   - **"Créer un compte gratuit"** (bouton hero, mis en avant) → redirige vers `/auth?redirect=...`
   - **"Rejoindre en invité"** (bouton outline, secondaire) → formulaire rapide inline (prénom uniquement) qui rejoint la session sans compte

3. **Section avantages** — liste concise sous le bouton "Créer un compte" :
   - Sauvegarde tes recommandations
   - Profil cinéma personnalisé (CinéDNA)
   - Crée tes propres soirées ciné
   - Retrouve tes amis cinéphiles

4. **Séparateur visuel** entre les deux options avec un "ou" centré

5. **Flow invité** : quand l'utilisateur clique "Rejoindre en invité", un champ prénom apparaît avec un bouton de confirmation. On appelle l'edge function `join-session` avec un flag `guest: true` et le `guestName`.

### Changements — `supabase/functions/join-session/index.ts`

Ajouter le support du mode invité :
- Accepter un body `{ sessionCode, guest: true, guestName: "..." }`
- Insérer dans `group_session_members` avec `user_id = null` et un nouveau champ `guest_name`

### Migration SQL

- Ajouter `guest_name text` (nullable) à `group_session_members`
- Rendre `user_id` nullable dans `group_session_members` (pour les invités sans compte)
- Ajouter une politique INSERT pour `anon` sur `group_session_members` (via edge function service role, donc pas nécessaire)

### Technical Details

- L'edge function utilise le service role pour insérer les invités, donc pas besoin de RLS anon sur `group_session_members`
- Le design utilise les composants existants : `Button` (hero/heroOutline), `PickCharacter`, icônes Lucide
- Animations Framer Motion staggerées pour les avantages
- Le champ prénom invité utilise le composant `Input` existant

