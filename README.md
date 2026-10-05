# Pick Your Spotlight

Application de recommandation de films et de séries. Pick apprend les goûts de
chacun pour proposer quoi regarder — seul, à deux, ou en groupe lors d'une
soirée. Interface en français, catalogue et disponibilités pour la France.

**En ligne :** https://pick-your-spotlight.lovable.app

---

## Démarrer

Node 20 ou plus récent.

```bash
npm ci                 # npm, pas bun — voir « Lockfiles » plus bas
cp .env.example .env   # puis renseigner les deux variables
npm run dev            # http://localhost:8080
```

Deux variables suffisent pour lancer l'application :

| Variable | Rôle |
|----------|------|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (anon) |

**Aucune clé d'API tierce ne va dans `.env`.** TMDB, Google AI et ElevenLabs
sont appelés depuis les fonctions serveur, avec des secrets configurés dans
Supabase (Dashboard → Project Settings → Edge Functions → Secrets) :
`TMDB_API_KEY`, `GOOGLE_AI_KEY`, `ELEVENLABS_API_KEY`.

---

## Commandes

```bash
npm run dev              # serveur de développement, port 8080
npm run build            # build de production
npm run lint             # ESLint — voir « Le cliquet » ci-dessous
npm test                 # tests unitaires (Vitest)
npm run test:watch       # idem, en continu
npm run test:integration # tests contre la vraie base — nécessite .env.test
npm run test:e2e         # Playwright — nécessite .env.test + Chromium
npm run test:smoke       # build + tests de fumée
```

Un seul fichier de test : `npx vitest run src/chemin/fichier.test.ts`

---

## Architecture

**Front** — Vite, React 18, TypeScript, Tailwind, shadcn/ui, React Router,
React Query, Framer Motion. Alias `@/` vers `src/`.

**Backend** — Supabase, opéré via Lovable Cloud : authentification, PostgreSQL
avec RLS, recherche vectorielle, et 31 fonctions serveur en Deno.

**Services tiers** — TMDB (fiches de films), modèles Gemini de Google
(recommandation et conversation), ElevenLabs (transcription et synthèse
vocale). Le détail de ce que chacun reçoit est dans la page `/confidentialite`,
qui fait foi.

| Dossier | Contenu |
|---------|---------|
| `src/pages/` | Une page par route |
| `src/components/pick/` | Composants métier |
| `src/components/ui/` | Primitives shadcn — **ne pas modifier à la main** |
| `src/hooks/` | Hooks partagés (`use-auth`, `use-pick-plus`…) |
| `src/lib/` | Logique métier : TMDB, moteur de goût, soirées, quotas… |
| `supabase/functions/` | Fonctions serveur Deno |
| `supabase/migrations/` | Migrations SQL, par ordre chronologique |
| `docs/` | [Pipeline de recommandation](docs/RECOMMENDATION_PIPELINE.md) · [Tests de fumée](docs/SMOKE_TESTS.md) |

### Le moteur de goût

`src/lib/taste-engine.ts` construit un profil à plusieurs vecteurs par
utilisateur : un vecteur stable (décroissance lente), un vecteur récent
(30 derniers jours), et un vecteur d'évitement issu des rejets. Les
correspondances genre → grappe utilisent les **noms français** — les garder
alignés avec `src/lib/tmdb.ts`.

Le parcours complet est documenté dans
[docs/RECOMMENDATION_PIPELINE.md](docs/RECOMMENDATION_PIPELINE.md).

### Quotas

Chaque appel coûteux — recommandation, conversation, voix — consomme un jeton
côté serveur **avant** d'appeler le modèle. Les compteurs vivent dans
`usage_counters`, que le navigateur peut lire mais jamais écrire.

Les plafonds sont dans la table `plan_quotas`, pas dans le code : les ajuster ne
demande ni migration ni déploiement. Trois paliers — `free`, `pick_plus`,
et `staff` (sans plafond, réservé aux comptes dont on assume la facture).

`src/lib/plan-limits.ts` ne fait qu'**afficher** ces valeurs, pour la page
d'accueil publique qui n'a personne de connecté pour interroger la base. En
changeant `plan_quotas`, changer ce fichier aussi.

### Confidentialité des profils

`profiles` porte 49 colonnes, dont l'année de naissance. **Une seule politique
de lecture existe : la sienne.** Toute lecture d'un profil tiers passe par
`src/lib/visible-profiles.ts`, qui appelle une fonction ne rendant que les
colonnes partageables.

⚠️ Ne jamais ajouter de politique `SELECT` sur `profiles` : le RLS PostgreSQL ne
sait pas filtrer par colonne, une politique rendrait la ligne entière.

---

## Déployer

Le projet est opéré par **Lovable**. La CLI Supabase renvoie 403 — tout passe
par l'interface Lovable.

1. Pousser sur `main`
2. Appliquer les **migrations** depuis Lovable
3. Déployer les **fonctions serveur** modifiées
4. Déployer le **front**

**L'ordre compte.** Une migration qui retire une colonne ou une table doit
précéder le front qui cesse de s'en servir ; l'inverse laisse l'application en
ligne parler à un schéma qui n'existe plus.

Lovable pousse ses propres commits sur `main` (scans de sécurité, types
regénérés). Faire `git pull --rebase --autostash` avant tout `git push`.

---

## Tests

| Suite | Ce qu'elle couvre | Prérequis |
|-------|-------------------|-----------|
| **Unitaires** | Moteur de goût, pipeline, soirées, quotas, notifications | aucun |
| **Intégration** | La vraie base : RLS, quotas, exposition des profils, fusion de groupe | `.env.test` |
| **E2E** | Parcours complets au navigateur | `.env.test` + `npx playwright install chromium` |

```bash
cp .env.test.example .env.test   # puis renseigner le compte de test
npm run test:integration
```

Les tests d'intégration attaquent la base **avec les droits d'un utilisateur
ordinaire** et vérifient ce qu'il ne peut pas faire : lire le profil d'un autre,
s'accorder du quota, écrire ses propres compteurs.

**Comparer le nombre total de tests d'une exécution à l'autre.** Certains
s'ignorent quand une migration n'est pas appliquée ou qu'un compte de
démonstration a disparu — et un test ignoré compte comme réussi. Deux
régressions ont été prises ainsi : la suite était verte, mais le total avait
baissé.

---

## Le cliquet du lint

`npm run lint` porte un plafond d'avertissements, fixé au nombre exact du jour
où il a été posé. Ce sont presque tous des `any` à typer.

**Ce nombre s'abaisse quand on résorbe de la dette. Il ne remonte jamais.** S'il
faut le relever pour faire passer la CI, c'est qu'on a ajouté des `any` : les
typer plutôt que relever le plafond.

Les erreurs, elles, bloquent : la CI échoue à la moindre.

---

## Lockfiles

`npm ci` pour installer. `bun.lock` et `package-lock.json` coexistent
volontairement : les outils locaux et la CI utilisent npm, mais on ignore lequel
Lovable utilise pour construire. Supprimer le mauvais casserait le déploiement —
question à trancher avec Lovable avant de consolider.

---

## Où retrouver quoi

- **Ce qui reste à faire** — liste de priorités tenue à jour hors dépôt.
  `docs/BACKLOG.md` est figé au 26 juin 2026 et **ne fait plus foi**.
- **Le pipeline de recommandation** — [docs/RECOMMENDATION_PIPELINE.md](docs/RECOMMENDATION_PIPELINE.md)
- **Les tests de fumée** — [docs/SMOKE_TESTS.md](docs/SMOKE_TESTS.md)
- **Les conventions de travail** — [CLAUDE.md](CLAUDE.md)

---

Les fiches de films proviennent de [TMDB](https://www.themoviedb.org/).
Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
