

## Problem

The TMDB API returns a `link` field per country (e.g. `fr.link`) that points to **themoviedb.org's own watch page** (`https://www.themoviedb.org/movie/803796-.../watch?locale=FR`), not to the actual streaming platform. Currently, `getWatchProviders` passes this as `tmdb_link` to every provider, and `buildStreamingLinks` uses it as the primary URL. Result: clicking "Ouvrir" on Netflix sends users to themoviedb.org.

## Fix

**In `src/lib/tmdb.ts` — `getWatchProviders` function (line 188-194):**

Stop passing `fr.link` as `tmdb_link`. TMDB does not provide direct platform URLs per provider in its API response — only its own JustWatch-powered page. Set `tmdb_link` to `null` so that `buildStreamingLinks` falls through to the platform-specific search URLs defined in `PLATFORM_MAP` (e.g. `https://www.netflix.com/search?q=...`).

Change:
```typescript
const tmdbLink = fr.link || null;
// ...
tmdb_link: tmdbLink,
```

To:
```typescript
// fr.link points to themoviedb.org, not the actual platform — don't use it
// ...
tmdb_link: undefined,
```

This single change makes all platform buttons use the correct URLs from `PLATFORM_MAP` in `streaming-links.ts` (Netflix search, Disney+ search, Prime Video search, etc.), which the native apps can also intercept on mobile.

