

# Plan : Parcours d'activation complet "Construis ton ADN Cinéma"

## Vue d'ensemble

Trois phases distinctes, dans l'ordre :

```text
1. ONBOARDING (inscription)     → Questions essentielles (âge, genres, plateformes, type de média)
2. TOUR DE LA PLATEFORME        → Explication visuelle des fonctionnalités clés
3. PARCOURS "ADN CINÉMA"        → Missions obligatoires → déblocage 7 jours Pick+
```

Le fil rouge marketing : **"Construis ton ADN Cinéma"** — chaque mission complétée remplit progressivement un ADN visuel, et à la fin Pick "te connaît" assez pour débloquer l'expérience complète.

---

## Phase 1 — Enrichir l'onboarding existant

**Fichier** : `src/pages/Onboarding.tsx`

Ajouter 2 étapes au flow existant (welcome → genres → plateformes) :

| Nouvelle étape | Position | Contenu |
|---|---|---|
| **Année de naissance** | Après welcome, avant genres | Picker année (scroll ou input), sauvegardé dans `profiles.birth_year` |
| **Type de média** | Après plateformes | Films / Séries / Les deux (sauvegardé dans `profiles.media_preference`) |

Le flow complet devient : `welcome → birth_year → genres → platforms → media_type`

La barre de progression s'adapte automatiquement (5 étapes au lieu de 3).

---

## Phase 2 — Tour visuel de la plateforme

**Nouveau fichier** : `src/components/pick/PlatformTour.tsx`

Overlay plein écran avec 4-5 slides swipables (Framer Motion) qui présentent les fonctionnalités :

1. **"Pick pour ce soir"** — "Dis-moi ce que tu veux, je trouve le film parfait"
2. **"Parle à Pick"** — "Demande-moi n'importe quoi sur le cinéma" + exemples de phrases
3. **"Entraîne ton Pick"** — "Swipe des films pour que je comprenne tes goûts"
4. **"Ta Watchlist & Coups de cœur"** — "Sauvegarde tout ce que tu veux voir"
5. **"Ton ADN Cinéma"** — "Plus tu m'utilises, plus ton profil cinéma se construit"

Chaque slide : icône/illustration + titre + description courte. Bouton "Suivant" / "C'est compris, on y va !"

Affiché une seule fois après l'onboarding, avant le parcours d'activation. Condition : `onboarding_completed && !tour_completed`. Nouveau champ `tour_completed` sur `profiles`.

---

## Phase 3 — Parcours "Construis ton ADN Cinéma"

**Nouveau fichier** : `src/components/pick/ActivationFlow.tsx`

Barre de progression persistante en haut de l'écran (non bloquante, mais avec des nudges) + écran de mission entre chaque étape.

### Missions

| # | Mission | Seuil | Description affichée |
|---|---------|-------|---------------------|
| 1 | `train_20` | 20 films swipés | "Évalue 20 films pour que Pick comprenne tes goûts" |
| 2 | `first_reco` | 1 reco générée | "Lance ta première recommandation avec Pick pour ce soir" |
| 3 | `talk_to_pick` | 1 message envoyé | "Parle à Pick — essaie : 'Un thriller récent et intense'" |
| 4 | `watchlist_3` | 3 films en watchlist | "Sauvegarde 3 films dans ta liste" |
| 5 | `like_5` | 5 coups de cœur | "Marque 5 films que tu as adorés" |

### UX

- Entre chaque mission complétée, un écran intermédiaire avec la mascotte Pick qui félicite + montre la progression ADN
- Barre persistante en haut : 5 pastilles (remplies au fur et mesure), texte de la mission en cours
- L'utilisateur peut naviguer librement mais la barre reste visible et cliquable pour rappeler la mission
- À la fin : écran "Ton ADN Cinéma est prêt !" → animation → "Tu as débloqué 7 jours de Pick+ gratuit"

### Persistance

Nouveau champ `activation_step` (text, default `'train_20'`) et `activation_completed` (boolean, default false) sur `profiles`.

La progression est vérifiée en temps réel en comptant les données existantes (user_interactions, watchlist, liked_movies) — pas de compteur séparé.

---

## Phase 4 — Déblocage essai gratuit

**Fichier** : `src/hooks/use-pick-plus.ts`

- Remplacer `const isPremium = true` par la vraie logique
- `isPremium = plan !== 'free' || (status === 'trial' && periodEnd > now)`
- Quand l'activation se termine : upsert dans `subscriptions` avec `status: 'trial'`, `plan: 'pick_plus'`, `current_period_end: now + 7 jours`
- Exposer `trialDaysLeft` pour affichage dans le profil

---

## Migration SQL

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activation_step text NOT NULL DEFAULT 'train_20',
  ADD COLUMN IF NOT EXISTS activation_completed boolean NOT NULL DEFAULT false;
```

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/pages/Onboarding.tsx` | Ajouter étapes birth_year + media_type |
| `src/components/pick/PlatformTour.tsx` | Nouveau — tour visuel 5 slides |
| `src/components/pick/ActivationFlow.tsx` | Nouveau — parcours missions |
| `src/pages/Index.tsx` | Orchestrer tour → activation → home |
| `src/hooks/use-pick-plus.ts` | Logique trial réelle |
| `src/components/pick/GuidedTour.tsx` | Supprimé (remplacé par PlatformTour) |
| Migration SQL | 3 colonnes sur profiles |

