# Architecture du pipeline de recommandation — Pick Your Spotlight

## 1. Architecture globale — flux de données

Toute personnalisation dans Pick repose sur un pipeline à **6 couches** :

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. UI EVENTS                                                       │
│     Swipe like/dislike, ajout watchlist, scan affiche, vocal…       │
└──────┬───────────────────────────────────────────────────┬──────────┘
       │ stockage brut (événements de session)             │ stockage direct
       ▼                                                   ▼
┌──────────────────┐                          ┌─────────────────────┐
│  user_interactions│                          │  liked_movies       │
│  (swipes, skips, │                          │  watchlist          │
│   rejections…)   │                          │  (actions explicites│
└──────┬───────────┘                          │   persistées)       │
       │                                      └──────────┬──────────┘
       │                  triggers automatiques          │
       └──────────────────────┬──────────────────────────┘
                              │  interprétation / scoring (PostgreSQL)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. INTERPRÉTATION / SCORING                                        │
│     Fonction recompute_user_movie_score()                           │
│     Pondération par type · score normalisé [-1, +1] · confidence    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  upsert automatique
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. user_movie_scores                          ✅ EN PRODUCTION      │
│     Score normalisé par (user, film) · confiance · détail signaux   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  agrégation vectorielle
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. TASTE VECTORS                                                   │
│     Profil multi-vecteurs : stable · récent · évitement             │
│     [ACTUEL] taste-engine lit liked_movies + watchlist +            │
│              user_interactions + user_movie_scores (évitement)      │
│     [CIBLE]  taste-engine lit uniquement user_movie_scores          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  requête personnalisée
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. RECOMMENDATION ENGINE                                           │
│     SQL vectoriel → présélection → LLM → résultats personnalisés    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Détail de chaque couche

### Couche 1 — UI Events

Ce que l'utilisateur fait dans l'interface. Chaque action est un signal capturé.

| Action | Signal émis | Poids sémantique |
|--------|-------------|------------------|
| Swipe like ❤️ | `like` | Fort positif |
| Swipe love 💜 | `love` | Très fort positif |
| Ajout watchlist 🔖 | `watchlist` | Positif modéré (intérêt sans engagement) |
| Swipe skip → | `skip` | Faiblement négatif |
| Swipe dislike ✕ | `dislike` | Fort négatif |
| Film vu ✓ | `seen` | Neutre (signal de consommation) |
| Affinage vocal | `refine` | Signal contextuel (insatisfaction partielle) |
| Scan affiche (Match) | `match_lookup` | Signal d'intérêt externe |
| Temps passé sur la carte | `dwell` | Signal implicite (à exploiter) |

---

### Couche 2 — `user_interactions`

Table de capture brute. Un enregistrement = un événement.

```sql
user_interactions (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES profiles,
  movie_id        integer,          -- TMDB ID
  interaction_type text,            -- like / love / dislike / skip / watchlist / seen / refine
  source          text,             -- 'swipe' | 'voice' | 'match' | 'trainer'
  session_id      uuid,             -- lien avec la session de recommandation
  context         jsonb,            -- métadonnées contextuelles (recherche associée, score LLM au moment du swipe…)
  created_at      timestamptz
)
```

---

### Couche 3 — Interprétation / Scoring

Couche de traitement implémentée en **PostgreSQL** via la fonction `recompute_user_movie_score()`. Elle s'exécute automatiquement via des triggers après chaque insertion/modification dans les 3 tables sources.

#### Sources déclenchant un recalcul

| Table | Trigger | Signal |
|-------|---------|--------|
| `user_interactions` | `trg_user_interactions_score` | Swipes, skips, rejections de session |
| `liked_movies` | `trg_liked_movies_score` | Likes et coups de cœur explicites |
| `watchlist` | `trg_watchlist_score` | Ajouts et retraits de la liste |

#### Table de pondération (implémentée)

| Action | Poids | Interprétation |
|--------|-------|----------------|
| `love` | +2.0 | Coup de cœur |
| `like` (liked_movies) | +1.0 | Like explicite |
| `like` (user_interactions) | +1.0 | Like session |
| `watchlist` | +0.5 | Intérêt sans engagement |
| `watched` | +0.3 | Consommation neutre positive |
| `unsure` | −0.4 | Doute |
| `skipped` | −0.3 | Skip session |
| `rejected_not_tonight` | −0.4 | Temporaire, signal faible |
| `rejected_too_long` | −0.6 | Durée, signal modéré |
| `rejected_too_slow` | −0.8 | Rythme |
| `rejected_too_intense` | −0.8 | Contenu |
| `rejected_style` | −1.5 | Rejet de style — signal fort |
| `dislike` | −1.5 | Rejet explicite |
| `unliked` | −1.5 | Like retiré |

#### Règles supplémentaires (à implémenter)

| Règle | Description |
|-------|-------------|
| **Décroissance temporelle** | Score × exp(−λ × jours) — actuellement appliquée dans le taste-engine, à déplacer ici |
| **Amplification trainer** | Signal issu du mode entraînement = ×1.2 |
| **Détection de patterns** | Ex. : 5 likes consécutifs sur des thrillers → boost cluster "thriller" |
| **Contexte session** | Skip après un love sur film similaire = signal plus fort qu'un skip isolé |

---

### Couche 4 — `user_movie_scores` ✅ En production

Table intermédiaire : résultat normalisé de l'interprétation, par (utilisateur, film). Alimentée automatiquement par les triggers de la couche 3. **Migration : `20260526100000_add_user_movie_scores.sql`**

```sql
user_movie_scores (
  user_id      uuid REFERENCES auth.users,
  movie_id     integer,             -- TMDB ID
  score        float,               -- normalisé [−1, +1]
  confidence   float,               -- 0–1 · sature à 5 signaux
  signals      jsonb,               -- [{type, weight, date}, …]
  last_updated timestamptz,
  PRIMARY KEY (user_id, movie_id)
)
```

**Avantage clé** : si la logique de scoring évolue, on recalcule cette table sans toucher aux événements bruts. La fonction `recompute_user_movie_score()` peut être relancée à tout moment sur tout ou partie des utilisateurs.

---

### Couche 5 — Taste Vectors

#### État actuel (implémenté)

Le `taste-engine.ts` lit encore directement les 3 tables sources pour construire les vecteurs positifs, et lit `user_movie_scores` uniquement pour l'**avoidance vector** (score ≤ −0.6) :

```
liked_movies     → vecteur stable + récent (positif)
watchlist        → vecteur stable + récent (positif, poids 0.4–0.5)
user_interactions→ vecteur récent + avoidance (inline)
user_movie_scores→ avoidance uniquement (score ≤ −0.6)  ← nouveau
```

#### Cible (refonte future)

Le taste-engine ne lira **que** `user_movie_scores`, éliminant les 3 lectures parallèles actuelles :

```
user_movie_scores (score > 0)  → vecteur stable + récent (selon last_updated)
user_movie_scores (score ≤ −0.6) → avoidance vector
```

Ce sera une **simplification significative** du taste-engine : plus de logique de pondération inline, plus de jointures multiples — tout est déjà calculé en base.

#### Vecteurs produits (inchangé)

Agrégation des signaux en vecteurs multi-dimensionnels, mis en cache dans `user_taste_vectors`.

| Vecteur | Source actuelle | Source cible | Half-life | Rôle |
|---------|----------------|--------------|-----------|------|
| **Stable** | `liked_movies` | `user_movie_scores (score > 0)` | 150 j | Goûts durables |
| **Récent** | `liked_movies` (30 j) | `user_movie_scores (score > 0, 30 j)` | 21 j | Tendances actuelles |
| **Évitement** | `user_interactions` + `user_movie_scores` | `user_movie_scores (score ≤ −0.6)` | 60 j | Ce qu'il faut éviter |

Chaque vecteur est en 32 dimensions alignées sur l'espace d'embedding des films (`movie_embeddings`).

---

### Couche 6 — Recommendation Engine

Utilise les taste vectors pour construire et exécuter une requête personnalisée.

| Étape | Détail |
|-------|--------|
| Requête SQL cosinus | `match_movies_for_recommendation` — 200 ou 300 candidats |
| Présélection | Tri similarité (70%) + note TMDB (20%) + popularité (10%) → top 20–30 |
| Évaluation LLM | `movie-match` — score d'adhésion + texte personnalisé par film |
| Résultat | 1, 2 ou 3 films selon réglage profil |

---

## 2. Points d'entrée

| # | Entrée | Déclencheur UI | Profil(s) | Vocal |
|---|--------|----------------|-----------|-------|
| 1 | **Search solo** | Bouton "Recherche" | Profil utilisateur courant | Non |
| 2 | **Search duo** | Bouton "Recherche à deux" | Profil A + Profil B (compte existant) ou saisie minimale (invité) | Non |
| 3 | **Vocal solo** | Micro "Pick" | Profil utilisateur courant + intention vocale | Oui |
| 4 | **Vocal duo** | Micro "Pick à deux" | Profil A + Profil B + intention vocale | Oui |

### Saisie minimale pour un invité (mode duo sans compte)

Lorsque la personne B n'a pas de profil, on lui demande a minima :
- Genres préférés (sélection rapide, 3 maximum)
- Plateformes disponibles ce soir
- Tolérance aux contenus (horreur, violence, adult)

Ces données sont éphémères (session uniquement, non persistées).

---

## 3. Construction du contexte de recherche

### 3.1 Mode solo

| Signal | Source | Rôle dans le filtre |
|--------|--------|---------------------|
| Vecteur de goût stable | `user_taste_vectors` (150 j half-life) | Similarité cosinus principale |
| Vecteur récent | `user_taste_vectors` (21 j half-life) | Boost films dans la tendance actuelle |
| Vecteur d'évitement | Skips/dislikes (60 j half-life) | Pénalité sur genres/clusters indésirables |
| Plateformes actives | `profiles.streaming_platforms` | Filtre `platform_ids` en SQL |
| Films déjà vus | `user_interactions` (love/like/skip) | Exclusions explicites |
| Langue préférée | `profiles.preferred_language` | Filtre `original_language` optionnel |
| Décennie préférée | `profiles.preferred_decade` | Filtre `year` optionnel |

### 3.2 Mode duo

Les deux vecteurs de goût sont **fusionnés par moyenne pondérée** avant envoi au SQL. Les plateformes utilisées sont l'**intersection** des deux listes (seules les plateformes communes aux deux personnes). Les exclusions combinent les films vus par l'un ou l'autre.

```
vecteur_duo = (vecteur_A × poids_A + vecteur_B × poids_B) / (poids_A + poids_B)
poids = nombre d'interactions enregistrées (proxy de confiance du profil)
```

### 3.3 Mode vocal (solo ou duo)

Le message vocal est d'abord traité par `pick-chat` en mode `extract_search_intent`. L'intention extraite enrichit le contexte :

| Élément extrait | Exemple | Effet |
|-----------------|---------|-------|
| Genre explicite | "un thriller" | Ajout filtre genre SQL |
| Ambiance | "quelque chose de léger" | Ajustement vecteur requête |
| Époque | "un film des années 80" | Filtre décennie SQL |
| Acteur/réalisateur | "avec Meryl Streep" | Filtre `cast` TMDB |
| Durée | "pas trop long" | Filtre `runtime` SQL |
| Langue | "en français" | Filtre `original_language` SQL |

Le résultat est un objet `SearchIntent` qui remplace ou complète les filtres du profil.

---

## 4. Filtre SQL — requête vectorielle

### Fonction RPC : `match_movies_for_recommendation`

La requête utilise la similarité cosinus entre le vecteur de requête (32 dimensions) et les embeddings stockés dans `movie_embeddings`.

### Volume de candidats

| Contexte | `match_count` | Raison |
|----------|--------------|--------|
| Aucun filtre plateforme | **200** | Pool suffisant sans contrainte |
| Filtre plateforme actif | **300** | Compensation : le filtre plateforme élimine ~50–70 % des résultats |
| Mode duo | **300** | Vecteur fusionné moins précis, besoin de plus de candidats |

### Filtres SQL appliqués

```sql
WHERE
  -- Filtre plateforme (si actif)
  (platform_ids && $platform_ids OR $platform_ids IS NULL)
  -- Filtre langue (si actif)
  AND (original_language = $lang OR $lang IS NULL)
  -- Filtre décennie (si actif)
  AND (year BETWEEN $decade_start AND $decade_end OR $decade_start IS NULL)
  -- Exclusion films déjà vus
  AND tmdb_id != ALL($exclude_ids)
ORDER BY
  -- Similarité cosinus (poids principal) + note TMDB pondérée
  (embedding <=> $query_vector) * 0.7 + (vote_average / 10) * 0.3
LIMIT $match_count
```

---

## 5. Présélection avant LLM

Après la requête SQL, les candidats sont **triés et tronqués** avant envoi au LLM :

| Critère de tri | Pondération |
|----------------|-------------|
| Score de similarité cosinus | 70 % |
| Note TMDB (`vote_average`) | 20 % |
| Popularité (`popularity`) | 10 % |

| Mode | Films envoyés au LLM |
|------|----------------------|
| Solo | **20 films** |
| Duo | **30 films** |
| Vocal | **20 films** (solo) / **30 films** (duo) |

---

## 6. Évaluation LLM — `movie-match`

### Entrées

- Les N films candidats (titre, genres, synopsis, année, note)
- Le(s) vecteur(s) de goût utilisateur
- Le contexte de recherche (intention vocale, filtres actifs, historique récent)
- Le `minMatchScore` calibré sur le profil

### Traitement

Pour chaque film candidat, le LLM :
1. Évalue le **score d'adhésion** (0–100) en comparant le film au profil
2. Rédige un **texte de recommandation personnalisé** (2–4 phrases)

En mode duo, le texte est adapté : "Ce film vous correspond parce que [référence aux goûts de A] et [référence aux goûts de B]…"

### Sorties

```typescript
{
  tmdb_id: number,
  matchScore: number,       // 0–100
  explanation: string,      // Texte LLM personnalisé
  recommendedRank: number   // Classement suggéré par le LLM
}
```

### Filtrage post-LLM

Seuls les films dont le `matchScore` dépasse le seuil du profil sont retenus. Si moins de films que demandé passent le seuil, le seuil est abaissé progressivement (tolérance +10 pts) pour garantir un résultat.

---

## 7. Résultat affiché

| Réglage profil (`recommendationBatchSize`) | Films affichés | UI |
|--------------------------------------------|----------------|----|
| 1 | 1 film | Carte unique + texte LLM |
| 2 | 2 films | 2 cartes navigables (flèches) |
| 3 | 3 films | 3 cartes navigables (flèches + pastilles) |

Chaque carte affiche :
- Affiche du film (TMDB)
- Titre, année, genres, durée
- Note TMDB + score match (optionnel en mode debug)
- **Texte de recommandation LLM** personnalisé
- Plateformes de streaming disponibles
- Actions : Ajouter à la watchlist / Voir un autre / Affiner avec Pick

---

## 8. Flux complet — diagramme

```
┌──────────────────────────────────────────────────────────────────┐
│                        POINTS D'ENTRÉE                           │
│                                                                  │
│   [Search solo]   [Search duo]   [Vocal solo]   [Vocal duo]      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  CONSTRUCTION DU CONTEXTE                        │
│                                                                  │
│  ┌─────────────────────┐      ┌──────────────────────────────┐   │
│  │   Profil(s)         │      │   Intention vocale           │   │
│  │  • Vecteur goût     │      │  (pick-chat extract_intent)  │   │
│  │  • Plateformes      │  +   │  • Genre, ambiance, époque   │   │
│  │  • Exclusions       │      │  • Acteur, durée, langue     │   │
│  │  • [Fusion duo]     │      │                              │   │
│  └─────────────────────┘      └──────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              FILTRE SQL — match_movies_for_recommendation         │
│                                                                  │
│  Requête vectorielle (cosinus 32 dim) sur movie_embeddings       │
│  + filtres plateforme / langue / décennie / exclusions           │
│                                                                  │
│  → 200 candidats (sans filtre plateforme)                        │
│  → 300 candidats (avec filtre plateforme ou mode duo)            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     PRÉSÉLECTION                                 │
│                                                                  │
│  Tri : similarité (70%) + note TMDB (20%) + popularité (10%)     │
│  → Top 20 films (solo) / Top 30 films (duo)                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ÉVALUATION LLM — movie-match                    │
│                                                                  │
│  Pour chaque film :                                              │
│  • Score d'adhésion 0–100                                        │
│  • Texte de recommandation personnalisé (solo ou duo)            │
│  • Classement suggéré                                            │
│                                                                  │
│  Filtrage post-LLM : seuil matchScore (tolérance +10 si trop peu)│
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                         RÉSULTAT                                 │
│                                                                  │
│  1, 2 ou 3 films selon réglage profil                            │
│  Chaque film = affiche + métadonnées + texte LLM + plateformes   │
└──────────────────────────────────────────────────────────────────┘
```

---

---

## 9. Fonctionnalité Match — "Ce film me correspond ?"

### Concept

L'utilisateur saisit le nom d'un film **ou scanne l'affiche** (photo). Pick répond de deux façons selon l'historique :

- **Film déjà connu** → affichage de la fiche avec l'interaction existante (like, watchlist, dislike…)
- **Film inconnu** → évaluation LLM comme s'il était sorti du pipeline SQL, avec score d'adhésion et texte personnalisé

---

### Flux détaillé

```
┌──────────────────────────────────────────────────────────────┐
│                     ENTRÉE MATCH                             │
│                                                              │
│   [Saisie nom]            [Scan affiche]                     │
│   Champ texte libre       Caméra / import image              │
└────────────────┬─────────────────────┬───────────────────────┘
                 │                     │
                 ▼                     ▼
         TMDB Search API         Vision API (OCR/IA)
         → TMDB ID               → Titre reconnu
                 │                     │
                 └──────────┬──────────┘
                            │
                            ▼
          ┌─────────────────────────────────────┐
          │   Résolution TMDB ID + métadonnées  │
          │   (titre, affiche, année, genres)   │
          └──────────────┬──────────────────────┘
                         │
                         ▼
          ┌─────────────────────────────────────┐
          │   Vérification interaction Supabase  │
          │   user_interactions WHERE            │
          │   movie_id = tmdb_id AND             │
          │   user_id = current_user             │
          └──────────┬──────────────────────────┘
                     │
           ┌─────────┴──────────┐
           │                    │
           ▼                    ▼
   INTERACTION TROUVÉE    PAS D'INTERACTION
           │                    │
           ▼                    ▼
  Fiche film existante    Appel movie-match LLM
  + badge interaction     (1 seul film à évaluer)
  (like / watchlist /     + profil utilisateur
   dislike / seen…)            │
                               ▼
                     Score adhésion 0–100
                     + texte personnalisé
                     + plateformes dispo
                     → Fiche résultat standard
```

---

### Détail des deux cas

#### Cas 1 — Film déjà interagi

| Champ affiché | Source |
|---------------|--------|
| Affiche, titre, année | TMDB |
| Note TMDB, genres | TMDB |
| Badge interaction | `user_interactions.interaction_type` |
| Date de l'interaction | `user_interactions.created_at` |
| Plateformes actuelles | TMDB Watch Providers (rechargées en live) |
| Actions disponibles | Modifier l'interaction / Voir détail |

#### Cas 2 — Film jamais vu

| Étape | Détail |
|-------|--------|
| Entrée LLM | Film unique (pas de batch) + vecteur de goût utilisateur |
| Sortie LLM | Score d'adhésion 0–100 + texte de recommandation personnalisé |
| Affichage | Même carte résultat que le pipeline standard |
| Actions | Like / Watchlist / Dislike / Affiner avec Pick |

> Le film évalué n'a **pas** besoin d'être dans `movie_embeddings`. L'évaluation LLM se fait sur ses métadonnées TMDB brutes + le profil utilisateur.

---

### Scan d'affiche — détail technique

| Étape | Technologie envisagée |
|-------|-----------------------|
| Capture image | API Caméra Web (`getUserMedia`) ou `<input type="file" accept="image/*" capture>` |
| Reconnaissance du film | Claude Vision (envoi base64 → extraction titre + année) ou TMDB Visual Search |
| Fallback | Si la reconnaissance échoue → champ texte pré-rempli avec la proposition, l'utilisateur confirme |

---

### Composants à créer

| Composant | Rôle |
|-----------|------|
| `src/pages/Match.tsx` | Page dédiée à la fonctionnalité |
| `src/components/pick/MatchSearch.tsx` | Barre de recherche texte + bouton scan |
| `src/components/pick/PosterScanner.tsx` | Accès caméra + envoi image + résultat reconnaissance |
| `src/components/pick/MatchResultCard.tsx` | Carte résultat unifiée (interaction existante ou évaluation LLM) |
| `supabase/functions/match-movie/` | Edge function : résolution TMDB + check interaction + évaluation LLM si besoin |

---

### Table Supabase concernée : `user_interactions`

```sql
SELECT interaction_type, created_at, notes
FROM user_interactions
WHERE user_id = $user_id
  AND movie_id = $tmdb_id
ORDER BY created_at DESC
LIMIT 1;
```

Types d'interaction possibles : `like`, `love`, `dislike`, `skip`, `watchlist`, `seen`

---

## 10. Composants techniques concernés

| Composant | Rôle |
|-----------|------|
| `src/pages/Index.tsx` | Orchestration principale, dispatch des flux |
| `src/pages/index/use-recommendation-engine.ts` | Logique de recherche, appels edge functions |
| `src/lib/recommendation-batch.ts` | `ensureRecommendationBatch` — scoring + providers côté client |
| `src/lib/taste-engine.ts` | Construction des vecteurs de goût |
| `src/components/pick/VoiceChat.tsx` | Interface vocale, extraction d'intention |
| `supabase/functions/surprise-personalized/` | Edge function — SQL + sélection top N |
| `supabase/functions/movie-match/` | Edge function — scoring LLM + texte |
| `supabase/functions/pick-chat/` | Edge function — NLP + extraction SearchIntent |
| `movie_embeddings` (Supabase) | Table — embeddings 32 dim + métadonnées films |
| `user_taste_vectors` (Supabase) | Table — vecteurs de goût mis en cache par profil |

---

## 10. Ce qui est en place vs. à construire

| Fonctionnalité | Statut |
|----------------|--------|
| Search solo (profil) | ✅ En production |
| Vocal solo (pick-chat → surprise-personalized) | ✅ En production |
| Filtre plateforme SQL (300 candidats) | ✅ En production |
| Scoring movie-match + texte LLM | ✅ En production |
| Résultat 1/2/3 films configurable | ✅ En production |
| **Table `user_movie_scores` + triggers** | ✅ Migration créée (20260526100000) |
| **Backfill liked_movies / watchlist / user_interactions** | ✅ Inclus dans la migration |
| **Correction bug avoidance vector (mauvais nom de colonne)** | ✅ Corrigé dans taste-engine.ts |
| **taste-engine lit user_movie_scores pour l'évitement** | ✅ Implémenté |
| Search duo (fusion de vecteurs) | 🔲 À construire |
| Vocal duo | 🔲 À construire |
| Invité sans compte (saisie minimale) | 🔲 À construire |
| Texte LLM adapté au contexte duo | 🔲 À construire |
| **Match — recherche par nom** | 🔲 À construire |
| **Match — scan d'affiche (Vision IA)** | 🔲 À construire |
| **Match — fiche interaction existante** | 🔲 À construire |
| **Match — évaluation LLM film inconnu** | 🔲 À construire |
| taste-engine lit entièrement depuis user_movie_scores | 🔲 Prochaine étape |
