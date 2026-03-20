

## Plan : Rendre la barre de navigation visible sur tous les ecrans

### Probleme actuel

La `BottomTabBar` est incluse individuellement dans chaque page (`Index`, `WatchlistRoute`, `MyCinema`, `Profile`, `Friends`, `PickTogether`), avec des conditions qui la masquent parfois (ex: sur `Index.tsx` elle disparait quand on est sur l'ecran resultat, sur `PickTogether` elle n'apparait que sur le step "landing").

### Approche

Remonter la `BottomTabBar` au niveau du layout dans `App.tsx` pour qu'elle soit rendue une seule fois, automatiquement, sur toutes les routes `/app/*`. Les pages publiques (`/`, `/auth`, `/join`, `/onboarding`) ne l'afficheront pas.

### Etapes

1. **Creer un composant `AppLayout`** dans `src/components/pick/AppLayout.tsx`
   - Wrapper qui rend `{children}` + `<BottomTabBar />` en permanence
   - Ajoute le padding-bottom necessaire pour ne pas cacher le contenu sous la barre

2. **Modifier `App.tsx`**
   - Wrapper toutes les routes `/app/*` avec `AppLayout`
   - Supprimer les imports/rendus individuels de `BottomTabBar` dans chaque page

3. **Nettoyer les pages individuelles** (supprimer `BottomTabBar` de chacune) :
   - `src/pages/Index.tsx` — supprimer l'import, la variable `showTabBar`, et le rendu conditionnel
   - `src/pages/WatchlistRoute.tsx` — supprimer l'import et le rendu
   - `src/pages/MyCinema.tsx` — supprimer l'import et le rendu
   - `src/pages/Profile.tsx` — supprimer l'import et le rendu
   - `src/pages/Friends.tsx` — supprimer l'import et le rendu
   - `src/pages/PickTogether.tsx` — supprimer l'import et le rendu conditionnel

### Details techniques

```text
App.tsx
  └─ /app/*  →  <AppLayout>        ← nouveau wrapper
                  <children />
                  <BottomTabBar />  ← toujours visible
                </AppLayout>
  └─ /auth, /join, /onboarding     ← pas de tab bar
```

La barre sera fixee en bas (deja le cas via `fixed bottom-0`) et chaque page devra conserver ou ajouter un `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` pour eviter que le contenu soit cache derriere.

