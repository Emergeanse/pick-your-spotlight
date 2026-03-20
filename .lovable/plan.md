

## Plan : Uniformiser les deux chemins vers le ResultScreen avec 5 films precharges

### Constat

Les deux chemins ("Pick choisit pour toi" et "Parle a Pick") menent deja au meme composant `ResultScreen` visuellement (backdrop, poster, acteurs, analyse, streaming, boutons). Le probleme est que "Parle a Pick" ne renvoie qu'**1 seul film**, donc les boutons Precedent/Suivant n'apparaissent pas.

### Ce qui sera fait

#### 1. Modifier l'Edge Function `pick-chat` pour precharger 5 films
**Fichier** : `supabase/functions/pick-chat/index.ts`
- Quand l'IA suggere un film, apres avoir recupere ses details TMDB, le backend cherche automatiquement **4 films similaires** via l'endpoint TMDB `/movie/{id}/recommendations`
- Filtre par note minimale, recupere les details en parallele
- Renvoie un champ `movies: MovieDetail[]` (5 films) en plus du champ `movie` existant

#### 2. Adapter VoiceChat pour transmettre les 5 films
**Fichier** : `src/components/pick/VoiceChat.tsx`
- Changer la signature du callback : `onMovieSuggested(movies: MovieDetail[])`
- Quand `data.movies` existe, passer le tableau complet ; sinon `[data.movie]`

#### 3. Adapter Index.tsx pour recevoir un tableau
**Fichier** : `src/pages/Index.tsx`
- `handleMovieSuggested` accepte `MovieDetail[]` au lieu d'un seul film
- Appelle `setResults(movies)` et `setCurrentResultIndex(0)`

### Resultat

```text
"Pick choisit pour toi" → surprise-personalized (count=5) → ResultScreen ◀ 1/5 ▶
"Parle a Pick"          → pick-chat + 4 similaires        → ResultScreen ◀ 1/5 ▶
                                                              ↑ meme page visuelle
```

### Ce qui ne change PAS
- `ResultScreen.tsx` — les boutons Precedent/Suivant sont deja implementes et fonctionnels
- L'apparence visuelle — les deux chemins arrivent deja sur le meme composant

