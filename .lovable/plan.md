

## Plan: YouTube videos as first-class recommendations in Pick chat

### Problem
Currently, when Pick's AI decides to recommend a YouTube video, it returns small inline cards in the chat that just open YouTube in a new tab. The user wants YouTube recommendations to behave exactly like movie recommendations — clicking a YouTube card in the chat should navigate to the **ResultScreen** with a full-page presentation adapted for the video.

### Architecture

The key insight: the ResultScreen currently expects a `MovieDetail` object. Rather than building a whole separate screen, we'll:

1. **Adapt the data flow** so a YouTube video can be passed through the same pipeline as a movie
2. **Adapt the ResultScreen** to detect YouTube content and render appropriately
3. **Make the AI smarter** about when to suggest YouTube vs movies (it already has the tools, the prompt just needs minor tuning)

### Changes

#### 1. Edge function `pick-chat` — return top YouTube video as a "recommendation"
- When `suggest_youtube` tool is called, instead of returning `type: "youtube"`, return `type: "recommendation"` with a **fake MovieDetail-shaped object** that has a `_youtube` flag
- The object will carry: `title`, `overview` (description), `backdrop_path` (thumbnail URL), `vote_average` (0), `runtime` (parsed from ISO duration), and a `_youtubeData` field with the full video metadata (url, channelTitle, viewCount, etc.)
- Pick the **best single video** (highest view count) rather than returning an array

#### 2. Chat overlay `PickChatOverlay.tsx` — handle YouTube like movies
- When receiving a `type: "recommendation"` with `movie._youtube === true`, show the same `MovieCard`-style inline card but with a YouTube visual style (red play icon)
- Clicking it navigates to ResultScreen via the same `handleMovieClick` flow (sessionStorage + navigate)

#### 3. ResultScreen — detect and adapt for YouTube
- Check `movie._youtube` flag at the top
- **For YouTube content, change**:
  - "Où regarder" section → single "Regarder sur YouTube" button (red, with YouTube icon)
  - Hide trailer button (the video IS the content)
  - Hide "Pourquoi ce film" match analysis (not relevant)
  - Hide companion mode button
  - Adapt header: show channel name instead of genres, view count instead of TMDB rating
  - Duration from ISO 8601 instead of runtime minutes
  - Thumbnail as backdrop (use high-res YouTube thumbnail)
  - Keep: like, bookmark, share, synopsis (= video description), "Affiner" to ask for something else

#### 4. Minor prompt tuning in `pick-chat`
- Encourage the AI to use `suggest_youtube` more proactively when content is short-form, educational, or documentary-style — not just when the user explicitly says "YouTube"
- Add duration hints: "< 20 min" or "documentaire" or "éducatif" should bias toward YouTube

### Technical details

**YouTube "MovieDetail" shape:**
```typescript
{
  id: -video.id.hashCode(), // negative to avoid TMDB collision
  title: video.title,
  overview: video.description,
  poster_path: null,
  backdrop_path: video.thumbnail, // full URL, not TMDB path
  vote_average: 0,
  runtime: parsedMinutes,
  genres: [{ id: 99, name: category_label }],
  release_date: video.publishedAt,
  _youtube: true,
  _youtubeData: { url, channelTitle, viewCount, duration, thumbnail, id }
}
```

**Files to modify:**
- `supabase/functions/pick-chat/index.ts` — reshape YouTube response as recommendation + prompt tuning
- `src/components/pick/PickChatOverlay.tsx` — handle YouTube recommendations via MovieCard flow
- `src/components/pick/ResultScreen.tsx` — detect `_youtube` flag and adapt UI sections
- `src/pages/Index.tsx` — no changes needed (same movie flow)

