

## Plan: Improve Taste Trainer visuals and add landing menu

### Problem
1. **Images appear grayed/muted** in the Taste Trainer cards despite having brightness/saturation filters. The `bg-background` dark background combined with the card shadow and overlays makes posters look washed out.
2. **No landing menu** -- users jump directly into swiping. The user wants a selection screen first: "Films", "Acteurs", "Réalisateurs".

### Changes

#### 1. Add a landing menu screen (`TasteTrainer.tsx`)
- Add a new state `selectedCategory: null | "movies" | "series" | "actors" | "directors"` (default `null`).
- When `null`, show a menu with 3-4 visually appealing cards: **Films**, **Séries**, **Acteurs**, **Réalisateurs**.
- Each card has an icon, label, and a brief description (e.g. "Évalue des films pour affiner tes recommandations").
- Tapping a card sets the category and enters the existing swipe flow.
- Replace the current tab bar with this landing when no category is selected; add a back arrow to return to the menu from inside the trainer.

#### 2. Split "Acteurs & Réals" into two categories
- Currently `PeopleTrainer` fetches both Acting and Directing. Add a `filterDepartment` prop to filter by "Acting" or "Directing".
- Pass the appropriate filter based on selected category.

#### 3. Fix image brightness
- **Main card front**: Increase to `brightness-[1.3] saturate-[1.3]` and remove the `mix-blend-screen` overlay gradient that adds a white/gray wash on top.
- **PeopleTrainer**: Same treatment -- boost brightness/saturation, remove the screen-blend overlay.
- **Next card preview**: Increase opacity from `opacity-30` to `opacity-50` for a richer preview.
- Remove or reduce the background glow motion value that can add a haze effect.

#### Files modified
- `src/components/pick/TasteTrainer.tsx` -- landing menu, image fixes, category routing
- `src/components/pick/PeopleTrainer.tsx` -- accept `filterDepartment` prop, image fixes

