

## Probleme actuel

Les ecrans de questions (Mood, Genre, Context, Time, Platforms) sont fonctionnels mais visuellement "plats" compares au HomeScreen cinematographique et au ResultScreen immersif. Ils n'ont :

- Aucun fond visuel (juste `bg-background` sombre uni)
- Pas d'indicateur de progression
- Pas de feedback visuel satisfaisant au tap
- Pas de personnalite visuelle (tous identiques)
- Transitions basiques

## Plan de redesign

### 1. Barre de progression animee (nouveau composant `StepProgress`)
- Barre fine en haut de l'ecran, violet neon, qui se remplit progressivement (etape 1/5, 2/5...)
- Texte discret "Etape 2 sur 5" sous la barre
- S'anime fluidement entre chaque etape avec framer-motion

### 2. Fond cinematographique subtil sur chaque etape
- Ajouter un fond avec un gradient radial violet subtil qui pulse doucement (comme une ambiance cinema)
- Particules flottantes tres legeres (3-4 petits cercles violets en mouvement lent) via framer-motion
- Cela donne vie a l'arriere-plan sans distraire

### 3. Micro-interaction de selection "satisfaisante"
- Quand l'utilisateur clique un choix : animation de scale bounce (1.0 -> 1.08 -> 1.0) + flash de glow violet
- Ajout d'un petit check anime qui apparait dans le coin (pour multi-select : Genre, Platforms)
- Pour les single-select (Mood, Context, Time) : la carte selectionnee pulse brievement puis le flow avance avec un delai de 300ms (le temps de voir la selection)

### 4. Titres plus engageants et playful
- Remplacer les titres neutres par des formulations plus conversationnelles :
  - "Quelle est votre humeur ?" -> "Comment vous sentez-vous ce soir ?"
  - "Quel genre vous tente ?" -> "Qu'est-ce qui vous ferait vibrer ?"
  - "Avec qui regardez-vous ?" -> "C'est pour qui ce soir ?"
  - "Combien de temps avez-vous ?" -> "Vous avez combien de temps devant vous ?"
  - "Vos plateformes" -> "Ou regardez-vous ?"

### 5. Transition entre etapes plus dynamique
- Remplacer le simple fade par un slide + fade : la page sortante glisse vers la gauche en s'effacant, la nouvelle arrive par la droite
- Cree une sensation de progression et de mouvement

### 6. Cartes avec personnalite visuelle
- Ajouter une icone Lucide subtile sur chaque carte Mood (ex: `Sun` pour Detente, `Zap` pour Adrenaline, `Heart` pour Romance, `Brain` pour Vertige, `Popcorn`/`Film` pour Leger, `Laugh`/`Smile` pour Rire)
- Meme principe pour Context (`User`, `Heart`, `Users`, `Home`)
- Meme principe pour Time (`Clock`, `Clapperboard`, `Tv`)
- Les icones apparaissent en `text-primary/40` et passent a `text-primary` au hover

### Fichiers modifies

| Fichier | Changement |
|---|---|
| `src/components/pick/StepProgress.tsx` | Nouveau composant barre de progression |
| `src/components/pick/StepLayout.tsx` | Nouveau layout wrapper avec fond ambiant + particules + progress bar |
| `src/components/pick/MoodStep.tsx` | Titres, icones Lucide, micro-interaction de selection avec delai |
| `src/components/pick/GenreStep.tsx` | Titre, bounce animation au toggle |
| `src/components/pick/ContextStep.tsx` | Titres, icones, micro-interaction |
| `src/components/pick/TimeStep.tsx` | Titres, icones, micro-interaction |
| `src/components/pick/PlatformStep.tsx` | Titre |
| `src/pages/Index.tsx` | Passer `currentStep`/`totalSteps` aux layouts, transition slide+fade |

