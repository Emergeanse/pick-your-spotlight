import {
  getDisplayTitle,
  getMovieDetailsWithCredits,
  getYear,
  searchMovies,
  type MovieDetail,
} from "@/lib/tmdb";

export type FinalPickEvent = {
  final_pick_title: string | null;
  final_pick_poster: string | null;
  final_pick_tmdb_id: number | null;
  /** TMDB media type of the revealed pick (movie | tv) */
  final_pick_media_type?: string | null;
  /** Event criteria (movie | tv | both) — not the pick's TMDB type */
  media_type?: string | null;
};

export type FinalPickLoadResult = {
  movie: MovieDetail;
  mediaType: "movie" | "tv";
  titleMismatch?: boolean;
};

const normalizeTitle = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Loose match for TMDB title variants (accents, subtitles). */
export function titlesMatch(expected: string, actual: string): boolean {
  const a = normalizeTitle(expected);
  const b = normalizeTitle(actual);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function resolvePickMediaType(movie: MovieDetail): "movie" | "tv" {
  if (movie.media_type === "tv" || movie.first_air_date) return "tv";
  return "movie";
}

/** Order of TMDB endpoints to try when final_pick_media_type is unknown (legacy rows). */
export function pickMediaTypesToTry(event: FinalPickEvent): ("movie" | "tv")[] {
  if (event.final_pick_media_type === "tv" || event.final_pick_media_type === "movie") {
    return [event.final_pick_media_type];
  }
  if (event.media_type === "tv") return ["tv", "movie"];
  if (event.media_type === "movie") return ["movie", "tv"];
  return ["tv", "movie"];
}

export function buildStubFromEvent(event: FinalPickEvent, tmdbId = 0): MovieDetail {
  const mediaType =
    event.final_pick_media_type === "tv" || event.final_pick_media_type === "movie"
      ? event.final_pick_media_type
      : event.media_type === "tv"
        ? "tv"
        : "movie";

  return {
    id: tmdbId,
    title: event.final_pick_title!,
    poster_path: event.final_pick_poster,
    overview: "",
    backdrop_path: null,
    vote_average: 0,
    genre_ids: [],
    runtime: 0,
    episode_run_time: [],
    genres: [],
    media_type: mediaType,
    ...(mediaType === "tv" ? { first_air_date: "2000-01-01" } : { release_date: "2000-01-01" }),
  };
}

export async function resolveFinalPickTmdbId(
  title: string,
  mediaType: "movie" | "tv",
  year?: string | number | null,
): Promise<number | null> {
  const results = await searchMovies(title);
  if (!results.length) return null;

  const normalized = normalizeTitle(title);
  const yearStr = year != null && year !== "" ? String(year) : null;
  const typed = results.filter((r) => r.media_type === mediaType);
  const pool = typed.length ? typed : results;

  if (yearStr) {
    const withYear = pool.find((r) => getYear(r) === yearStr);
    if (withYear) return withYear.id;
  }

  const exact = pool.find((r) => normalizeTitle(getDisplayTitle(r)) === normalized);
  if (exact) return exact.id;

  const partial = pool.find((r) => {
    const t = normalizeTitle(getDisplayTitle(r));
    return t.includes(normalized) || normalized.includes(t);
  });
  if (partial) return partial.id;

  return pool[0]?.id ?? null;
}

/** Detect TMDB media type for a stored tmdb_id + expected title (vote reveal, legacy rows). */
export async function detectPickMediaType(
  tmdbId: number,
  expectedTitle: string,
): Promise<"movie" | "tv"> {
  for (const mt of ["tv", "movie"] as const) {
    try {
      const detail = await getMovieDetailsWithCredits(tmdbId, mt);
      if (titlesMatch(expectedTitle, getDisplayTitle(detail))) return mt;
    } catch {
      /* try next */
    }
  }
  return "movie";
}

/**
 * Load TMDB detail for a soirée's final pick.
 * Always prefers final_pick_tmdb_id when present; title search is fallback only.
 */
export async function loadFinalPickDetail(event: FinalPickEvent): Promise<FinalPickLoadResult> {
  const expectedTitle = event.final_pick_title?.trim();
  if (!expectedTitle) {
    return { movie: buildStubFromEvent(event), mediaType: "movie" };
  }

  if (event.final_pick_tmdb_id) {
    const typesToTry = pickMediaTypesToTry(event);
    for (const mt of typesToTry) {
      try {
        const detail = await getMovieDetailsWithCredits(event.final_pick_tmdb_id, mt);
        if (titlesMatch(expectedTitle, getDisplayTitle(detail))) {
          return { movie: detail, mediaType: mt };
        }
      } catch {
        /* try next media type */
      }
    }

    console.warn(
      "[event-final-pick] TMDB title mismatch for id",
      event.final_pick_tmdb_id,
      "— expected",
      expectedTitle,
    );
    return {
      movie: buildStubFromEvent(event, event.final_pick_tmdb_id),
      mediaType: typesToTry[0],
      titleMismatch: true,
    };
  }

  const preferType: "movie" | "tv" =
    event.final_pick_media_type === "tv" || event.final_pick_media_type === "movie"
      ? event.final_pick_media_type
      : event.media_type === "tv"
        ? "tv"
        : event.media_type === "movie"
          ? "movie"
          : "tv";

  const tmdbId = await resolveFinalPickTmdbId(expectedTitle, preferType);
  if (!tmdbId) {
    return { movie: buildStubFromEvent(event), mediaType: preferType };
  }

  const detail = await getMovieDetailsWithCredits(tmdbId, preferType);
  const titleMismatch = !titlesMatch(expectedTitle, getDisplayTitle(detail));
  if (titleMismatch) {
    console.warn(
      "[event-final-pick] title search mismatch — expected",
      expectedTitle,
      "got",
      getDisplayTitle(detail),
    );
  }
  return { movie: detail, mediaType: preferType, titleMismatch };
}
