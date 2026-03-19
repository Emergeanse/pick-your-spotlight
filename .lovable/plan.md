

## Plan: QR Code par soirée ciné + flow d'invitation intelligent

### Concept

Chaque soirée ciné génère un **QR code unique** que les gens autour de toi peuvent scanner. Le comportement s'adapte selon leur situation :
- **Déjà ami + compte** → rejoint la soirée immédiatement
- **Pas ami + compte** → ajouté en ami + rejoint la soirée
- **Pas de compte** → page avec choix : s'inscrire OU rejoindre en tant qu'invité

### Changements

#### 1. Base de données : ajouter un code d'invitation par session
- Ajouter une colonne `invite_code` (text, unique, auto-généré) à la table `group_sessions`
- Générer un code court type `SOIR-XXXX` à la création de session

#### 2. Pick Together (`src/pages/PickTogether.tsx`)
- À l'étape "who", ajouter un bouton **"Partager un QR code"** qui :
  - Crée une session dans `group_sessions` avec un `invite_code`
  - Affiche un QR code encodant l'URL : `https://pick-your-spotlight.lovable.app/join?session=SOIR-XXXX`
  - Bouton de partage natif (lien copié ou share API)
- Les participants qui rejoignent via le QR apparaissent en temps réel dans la liste (via Supabase Realtime sur `group_session_members`)

#### 3. Nouvelle page `/join` (`src/pages/JoinSession.tsx`)
Page d'atterrissage quand quelqu'un scanne le QR :
- Lit le param `?session=SOIR-XXXX`
- **Si connecté + déjà ami du créateur** → rejoint la session, redirige vers `/app/pick-together?session=ID`
- **Si connecté + pas ami** → ajoute en ami automatiquement + rejoint la session
- **Si pas connecté** → affiche deux options :
  - "J'ai un compte" → redirige vers `/auth?redirect=/join?session=SOIR-XXXX`
  - "Rejoindre en invité" → formulaire rapide (prénom, âge optionnel, genres) → rejoint comme guest

#### 4. Auth page (`src/pages/Auth.tsx`)
- Supporter un param `redirect` pour revenir vers `/join?session=...` après login/signup

#### 5. Routes (`src/App.tsx`)
- Ajouter la route `/join` (publique, pas protégée)

#### 6. QR du profil (déjà en place)
- Le QR du profil reste sur la page Profile pour l'ajout d'ami simple (déjà implémenté)

### Technical Details

- **Migration SQL** : `ALTER TABLE group_sessions ADD COLUMN invite_code text UNIQUE DEFAULT generate_session_code();` + fonction `generate_session_code()` similaire à `generate_friend_code()`
- **Realtime** : activer realtime sur `group_session_members` pour voir les participants arriver
- **RLS** : politique SELECT publique sur `group_sessions` filtré par `invite_code` (pour que la page `/join` puisse lire la session sans être authentifié — via une edge function sécurisée plutôt)
- **Edge function `join-session`** : gère la logique serveur (vérifier le code, créer l'amitié si nécessaire, ajouter le membre à la session)
- **Package** : réutilise `qrcode.react` déjà installé

