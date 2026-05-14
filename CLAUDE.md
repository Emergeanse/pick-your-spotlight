# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run lint       # ESLint check
npm test           # Run tests once (Vitest)
npm run test:watch # Run tests in watch mode
```

Run a single test file: `npx vitest run src/path/to/file.test.ts`

This project uses `bun.lock` alongside `package-lock.json`. Use `npm` for installs.

## Architecture

**Stack**: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui + React Query + React Router v6 + Framer Motion + Supabase + Three.js (via `@react-three/fiber`)

### Directory layout

| Path | Purpose |
|------|---------|
| `src/pages/` | Route-level components (one per route) |
| `src/components/pick/` | All app-specific feature components |
| `src/components/pick/together/` | Multi-step "Pick Together" session wizard steps |
| `src/components/ui/` | shadcn/ui primitives — do not modify these manually |
| `src/hooks/` | Custom React hooks (`use-auth`, `use-pick-plus`, `use-presence`, etc.) |
| `src/lib/` | Business logic: TMDB API, taste engine, sessions, interactions, watchlist, etc. |
| `src/integrations/supabase/` | Supabase client + generated TypeScript types |
| `supabase/functions/` | Deno edge functions deployed to Supabase |
| `supabase/migrations/` | SQL migration files (chronological) |

Path alias `@/` maps to `src/`.

### Routing & auth

`App.tsx` defines all routes. Protected routes wrap children in `<ProtectedRoute>` which reads from `useAuth` (`src/hooks/use-auth.ts`). `useAuth` hydrates from Supabase session storage and exposes `{ user, isReady, loading, signOut }`. All authenticated pages are nested under `/app/*` inside `<AppLayout>` (which just adds `<BottomTabBar>`).

### Recommendation flow

The main recommendation flow lives in `src/pages/Index.tsx`. Users go through guided wizard steps (`MediaTypeStep`, `MoodStep`, `GenreStep`, `PlatformStep`, etc.) in `src/components/pick/`, then receive results via the `surprise-personalized` or `movie-match` edge functions. Results render in `ResultScreen` using flip cards.

### Taste engine (`src/lib/taste-engine.ts`)

The core personalization layer builds a **multi-vector profile** per user from Supabase data:
- **Stable taste vector** — full history with long exponential decay (150-day half-life)
- **Recent taste vector** — last 30 days, short decay (21-day half-life)
- **Avoidance vector** — from skips/dislikes (60-day half-life)

Profiles are cached in the `user_taste_vectors` table using a fingerprint. Genre-to-cluster mappings use French genre names (e.g. `"Comédie"`, `"Horreur"`) — keep these consistent with `src/lib/tmdb.ts`.

### Supabase edge functions

All functions in `supabase/functions/` are Deno-based and use `https://deno.land/std` imports. They share a common CORS header pattern. Key functions:
- `movie-match` — scores a candidate movie against a user's taste profile using cosine similarity on embeddings + Claude LLM via `LOVABLE_API_KEY`
- `pick-chat` / `companion-chat` — Claude-powered conversational interfaces
- `generate-embedding` — creates 32-dim movie embeddings cached in `movie_embeddings`
- `group-recommend` — recommendation for collaborative Pick Together sessions
- `surprise-personalized` — full personalized recommendation batch

### External APIs

- **TMDB**: API key is in `src/lib/tmdb.ts` and hardcoded in edge functions. All TMDB calls use `language=fr-FR` and `watch_region=FR` — this app targets French-speaking users.
- **ElevenLabs**: Used for TTS via `@elevenlabs/react` and the `pick-tts` edge function.
- **Supabase**: Project configured via `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

### Testing

Tests use Vitest + jsdom + `@testing-library/react`. Setup file is at `src/test/setup.ts`. Test files follow `*.test.ts` / `*.spec.ts` convention inside `src/`.

### Pick Together

The collaborative session flow (`src/pages/PickTogether.tsx`, `src/components/pick/together/`) lets multiple users pick a movie together via shared sessions. Sessions are tracked in Supabase with real-time presence via `use-presence.ts`.
