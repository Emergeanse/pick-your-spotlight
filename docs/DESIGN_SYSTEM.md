# Pick — Design System v1.0

Référence visuelle de Pick, adoptée le 6 octobre 2026. Toute modification d'interface
s'y conforme. On ne refait pas l'interface d'un coup : on l'applique progressivement
aux composants existants, en réduisant les différences arbitraires de couleur, de
rayon, d'espacement, d'ombre et de comportement. **La cohérence d'abord, pas l'ajout
d'effets.**

## 1. Direction

> **Sombre et élégant au repos. La magie apparaît à l'interaction.**

Une application cinéma premium, chaleureuse, légèrement magique — pas un site décoré.

- Répartition cible : 80 % noir / violet très sombre, 15 % violet Pick, 5 % accents
  (magenta, rose, or).
- **Une seule chose très lumineuse par écran.** Sur l'accueil : le CTA « Créer une
  soirée ciné », puis l'élément sélectionné, puis le secondaire, puis la navigation
  inactive. Si tout brille, rien n'est prioritaire.
- Avant d'ajouter un effet : *aide-t-il l'utilisateur à comprendre quelque chose ?*
  Sinon, on ne l'ajoute pas.
- Avant de créer un composant : réutiliser d'abord un composant Pick existant.

## 2. Couleurs

Jamais de violet, de rose ou de magenta écrit en dur dans un composant
(`violet-400`, `#A78BFA`, `rgba(168,85,247,…)`…) : on passe par les classes ci-dessous.

| Usage | Valeur | Classe Tailwind |
|---|---|---|
| Fond principal | `#07070A` | `bg-background` |
| Carte | `#12101B` | `bg-pick-surface` |
| Carte survolée | `#171222` | `bg-pick-surface-hover` |
| Violet Pick | `#8B5CF6` | `primary` (`bg-primary`, `text-primary`…) |
| Violet actif | `#A855F7` | `accent` |
| Violet clair (texte actif) | `#A78BFA` | `pick-purple-light` |
| Magenta | `#D946EF` | `pick-magenta` |
| Rose | `#EC4899` | `pick-pink` |
| Or chaleureux | `#E8B85C` | `pick-gold` |
| Exclu (rose désaturé) | `#F29AA9` | `pick-exclude` |
| Texte principal | blanc | `text-foreground` |
| Texte secondaire | `#A8A3B3` | `text-pick-text-secondary` |
| Texte discret | `#716B7A` | `text-pick-text-muted` |
| Bordure | violet 18 % | `border-pick-border` |
| Bordure survol | violet 38 % | `border-pick-border-hover` |
| Bordure sélection | violet actif 70 % | `border-pick-border-active` |

Les variables CSS correspondantes (`--pick-*`) sont dans `src/index.css`.

## 3. Typographie

Deux familles, pas une de plus.

- **Interface : Inter** (`font-sans`). Le document d'origine préférait Manrope ; Inter
  est dans sa liste et déjà partout, on le garde.
- **Accroches émotionnelles : DM Serif Display** (`font-serif`). *Uniquement* sur les
  grandes accroches (« Créez une soirée cinéma… »). Jamais dans un bouton, un menu,
  une carte ou un champ.

| Élément | Taille | Graisse |
|---|---:|---:|
| Très petit label | 11 px | 500 |
| Texte secondaire | 12 px | 500 |
| Navigation | 12–13 px | 600 |
| Texte courant | 14 px | 500 |
| Bouton | 15–16 px | 600–700 |
| Titre de section | 16–18 px | 700 |
| Titre d'écran | 22–26 px | 700 |

**Aucun texte sous 11 px.**

## 4. Espacement

Grille : **4 / 8 / 12 / 16 / 24 / 32 / 48 px** (Tailwind `1 2 3 4 6 8 12`). Pas de
valeur arbitraire (`13px`, `19px`…).

| Situation | Espacement |
|---|---:|
| Icône ↔ texte | 8 px |
| Éléments internes d'une carte | 8–12 px |
| Padding petite carte | 12 px |
| Padding carte principale | 16 px |
| Entre deux cartes | 12–16 px |
| Entre deux sections | 24–32 px |
| Marge d'écran | 16–20 px |

## 5. Rayons

| Élément | Rayon | Classe |
|---|---:|---|
| Petite puce | 8 px | `rounded-pick-sm` |
| Petite carte | 12 px | `rounded-pick-md` |
| Carte | 16 px | `rounded-pick-lg` |
| Grande carte | 20 px | `rounded-pick-xl` |
| CTA, pilule | 999 px | `rounded-full` |
| Avatar, bouton rond | 50 % | `rounded-full` |

Pas de rayon choisi « parce que c'était plus joli ».

## 6. Ombres et lumière

| État | Classe |
|---|---|
| Carte | `shadow-pick-card` |
| Survol | `shadow-pick-hover` |
| Élément actif | `shadow-pick-active` |
| CTA magique (maximum) | `shadow-pick-cta` |

Jamais de halo énorme permanent.

## 7. États des composants

Chaque élément interactif a **Normal → Survol → Pressé → Actif → Désactivé**.

- **Normal** : violet très sombre ou gris-violet, presque pas de lueur.
- **Survol** : violet un peu plus saturé, petit halo. **Réservé aux souris** :
  `[@media(hover:hover)]:hover:` ou `[@media(hover:hover)]:group-hover:`, jamais
  `hover:` seul — sur écran tactile, le survol reste collé après l'appui.
- **Pressé** : `active:scale-[0.97]`, lueur légèrement réduite.
- **Actif** : violet Pick, halo visible mais propre, texte `pick-purple-light`.
- **Désactivé** : opacité ~35 %, aucune lueur, non interactif.

Aucune information importante ne doit dépendre uniquement du survol.

### Préférences à trois états (genres, époques)

Une seule capsule, `classeChip` (`src/lib/preference-etats.ts`) : hauteur 32 px,
espacement 8 px, 18–20 px entre groupes.

- **Aimé** — Pick favorise : violet légèrement rempli, `pick-purple-light`, sans halo au repos.
- **Exclu** — Pick évite fortement : `pick-exclude`, discret, icône ⊘.
- **Neutre** — aucune préférence : gris-violet très effacé.

En lecture, les groupes sont séparés (Aimés, Exclus, Sans préférence) et jamais
mélangés ; on modifie dans une feuille du bas (`FeuillePreferences`), où un
toucher fait passer neutre → aimé → exclu → neutre.

## 8. Icônes

Deux familles, toutes en images dans `src/assets/` :

- **Expressives** (cartes Surprise / Duo / Famille / Amis, tickets « Nouvelle
  soirée ») : volume 3D, verre violet, touches magenta et or.
- **Fonctionnelles** (`src/assets/icones/`) : recherche, filtres, amis,
  notifications, onglets, flèches. Chacune existe en `-repos` (verre fumé) et
  `-actif` (violet lumineux), **recadrées avec le même cadre** pour que le fondu ne
  fasse pas bouger le dessin. Composant : `IconeCharte`.

Une icône fonctionnelle ne rivalise jamais avec l'écureuil, une affiche ou le CTA.

Images fournies sur fond noir : les détourer (intérieur opaque, halo transformé en
lumière transparente), ne jamais les poser telles quelles.

## 9. Navigation basse

Accueil · Mes soirées · Nouvelle soirée · Biblio · Profil. Inactif : icône au repos,
texte discret. Actif : icône active, texte violet, trait de 2 px au-dessus. Le
bouton central (ticket) est l'exception graphique : sombre au repos, lumineux au
survol et à l'appui.

## 10. Cartes

Toutes dérivent de la même base (prochaine soirée, partagé avec vous, suggestions,
notifications, résultats) :

```
bg-pick-surface/90 border border-pick-border rounded-pick-lg p-4 shadow-pick-card
survol : bg-pick-surface-hover border-pick-border-hover
```

Pas un style différent par carte.

## 11. Affiches

Même ratio (`aspect-[2/3]`), même rayon (10 px), même ombre, même hauteur sur une
rangée. Survol : zoom 1.025, transition douce.

## 12. Mouvement

| Geste | Durée | Classe |
|---|---:|---|
| Clic / tap | 120 ms | `duration-120` |
| Survol | 180 ms | `duration-180` |
| Ouverture carte / modale | 260 ms | `duration-260` |
| Changement d'écran | 300 ms max | |

Courbe : `ease-pick` (`cubic-bezier(.2,.8,.2,1)`). Une application premium ne saute pas.

## 13. Fond cinéma

L'écureuil reste présent. Les affiches du fond (Le Parrain, Casablanca…) sont une
texture, pas une information. **Décision du 6 octobre** : on garde l'image actuelle,
atténuée vers les bords par un vignettage léger (60 %). Le document d'origine visait
5 à 12 % d'opacité ; c'est volontairement plus visible, à la demande de Chris.

## 14. Responsive

Vérifier à **360, 390, 430 px**, tablette et ordinateur (aperçu Lovable = cadre
téléphone de 420 px, où l'en-tête passe en version grand écran : logo 75 px, marge
24 px). Marges 16–20 px, zones tactiles 44 × 44 px minimum.

## 15. États obligatoires

Chargement (squelette sombre violet), vide (illustration + message chaleureux),
erreur (message clair, pas de grand panneau rouge), succès (micro-animation, accent
violet ou or), désactivé, hors ligne (comportement propre, jamais de page cassée).

## 16. Écarts connus (au 6 octobre 2026)

À résorber progressivement, composant par composant. **Fait :** l'accueil
(`HomeScreen`, 6 octobre) — base de carte `CARTE_PICK`, jetons partout, plus de
texte sous 11 px hors barre d'onglets.

- `violet-400`, `violet-500`, `pink-500`… écrits en dur : une trentaine
  d'occurrences hors accueil.
- Rayons : `--radius` vaut 24 px (`rounded-lg` shadcn) et sept tailles coexistent.
- Textes sous 11 px : libellés de la barre d'onglets (8,5–10 px, fluides pour tenir à
  360 px). Passer la navigation à 12 px demande de revoir la place des libellés, qui
  se touchaient déjà à 360 px : décision en attente (libellés plus courts ou sur deux
  lignes).
