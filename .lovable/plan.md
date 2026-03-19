

## Ajouter une étape "Niveau d'exploration" dans le flow "Pick pour ce soir"

### Concept
Après l'étape "Que veux-tu regarder ?" (What), une nouvelle étape demande "Envie de sortir de ta zone de confort ?" avec un slider de 0 à 10. L'utilisateur choisit son niveau d'exploration, puis la recommandation est générée en tenant compte de cette valeur.

### Modifications

**1. Nouveau composant `ExplorationStep.tsx`**
- Un slider (0-10) avec des labels aux extrémités : "Mes classiques" (0) et "Terre inconnue" (10), valeur par défaut 5.
- Question : "Envie d'explorer ?" ou formulation similaire.
- Un bouton "Valider" pour confirmer + un lien "Passer" qui utilise la valeur par défaut (5).
- Style cohérent avec WhoStep/WhatStep (framer-motion, même layout).

**2. Mise à jour de `HomeScreen.tsx`**
- Ajouter `"exploration"` au type `flowStep` : `"idle" | "who" | "what" | "exploration"`.
- Après WhatStep, passer à `flowStep = "exploration"` au lieu de lancer directement `generateTonightPick`.
- Stocker la valeur d'exploration dans un state `explorationLevel`.
- Quand ExplorationStep valide, appeler `generateTonightPick` en passant `explorationLevel`.
- Mettre à jour le `StepLayout totalSteps` de 2 à 3.
- Passer `explorationLevel` dans les appels à `invokeSurprisePersonalized`.

**3. Mise à jour de la edge function `surprise-personalized/index.ts`**
- Recevoir `explorationLevel` (0-10) dans le body.
- Intégrer dans le prompt IA :
  - **0-2** : Mode ultra-précision. Coller aux genres exacts, privilégier les candidats embedding à haute similarité.
  - **3-5** : Mode équilibré (comportement actuel).
  - **6-8** : Mode découverte. Genres adjacents, films sous-estimés, pépites.
  - **9-10** : Mode "terre inconnue". Genres opposés aux habitudes, interdiction des genres habituels.
- Ajuster le seuil de similarité embedding (0.85 pour niveaux bas, 0.5 pour niveaux hauts).
- Pour niveaux 7+, activer automatiquement le flag `outOfComfortZone`.

