/**
 * Fonctions pures extraites du pipeline surprise-personalized — testables côté client (TNR phase 2).
 */

export type ResolveEffectiveExclusionsResult = {
  effectiveExcludedGenres: string[];
  removedFromExclusions: string[];
};

/** Retire les genres du thème ce soir (voix / ambiance) des exclusions profil. */
export function resolveEffectiveExclusions(
  excludedGenres: string[] | null | undefined,
  voiceGenres?: string[] | null,
  moodBoostGenres?: string[] | null,
): ResolveEffectiveExclusionsResult {
  const base = excludedGenres ?? [];
  const themeGenres = [
    ...new Set([
      ...(voiceGenres ?? []).filter((g): g is string => typeof g === "string" && g.length > 0),
      ...(moodBoostGenres ?? []).filter((g): g is string => typeof g === "string" && g.length > 0),
    ]),
  ];
  if (themeGenres.length === 0) {
    return { effectiveExcludedGenres: [...base], removedFromExclusions: [] };
  }
  const themeSet = new Set(themeGenres);
  const removedFromExclusions = base.filter((g) => themeSet.has(g));
  const effectiveExcludedGenres = base.filter((g) => !themeSet.has(g));
  return { effectiveExcludedGenres, removedFromExclusions };
}

export type SqlCandidate = {
  tmdb_id: number;
  title?: string;
  similarity?: number;
  vote_average?: number;
  original_language?: string;
  genres?: string[];
  year?: string;
  media_type?: string;
};

export type LlmSelectionInput = {
  rank?: number;
  tmdb_id?: number;
  matchScore?: number;
  reason?: string | null;
};

export type ResolvedLlmSelection = {
  tmdb_id: number;
  matchScore: number;
  reason: string | null;
};

export type RpcParamsInput = {
  userTasteVector: number[];
  normalizedExcludeIds: number[];
  effectiveFilterMediaType: "movie" | "tv" | null;
  minRating: number;
  effectiveExcludedGenres: string[];
  likedGenresForSQL: string[];
  effectiveLikedGenresSQL: string[] | null;
  effectiveMaxDuration: number | null;
  userId: string | null;
  partnerUserId: string | null;
  voiceOriginalLanguage: string | null;
  voiceDecade: number | null;
  effectiveExcludedLangsArr: string[];
  rejectedClusters: string[];
  expandedPlatformIds: number[] | null;
};

export type CascadeLevelOptions = {
  withLang: boolean;
  withYear: boolean;
  withPlatform: boolean;
};

/** Normalise exclude_ids côté edge (session + profil + duo + historique serveur). */
export function normalizeExcludeIds(
  excludeIds: unknown[] | null | undefined,
  tasteProfileExcludeIds?: unknown[] | null,
  duoExcludeTmdbIds: number[] = [],
  mainUserExcludeTmdbIds: number[] = [],
): number[] {
  return [
    ...new Set([
      ...(excludeIds || []).map((id) => Number(id)).filter(Number.isFinite),
      ...(tasteProfileExcludeIds || []).map((id) => Number(id)).filter(Number.isFinite),
      ...duoExcludeTmdbIds,
      ...mainUserExcludeTmdbIds,
    ]),
  ];
}

/** Filet usedIds — régression 2026-06-03 : doit inclure normalizedExcludeIds. */
export function buildUsedIds(normalizedExcludeIds: number[]): Set<number> {
  return new Set<number>(normalizedExcludeIds);
}

export function compositeScore(
  candidate: SqlCandidate,
  preferredLangs: Set<string> = new Set(),
): number {
  let score = (candidate.similarity ?? 0) * 100 + (candidate.vote_average ?? 0);
  if (preferredLangs.size > 0 && preferredLangs.has(candidate.original_language || "")) {
    score += 15;
  }
  return score;
}

export function repairLlmJsonContent(content: string): string {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\}\s*\n\s*\{/g, "},\n{")
    .replace(/,\s*([}\]])/g, "$1");
}

export function stripLlmResponseWrapper(rawContent: string): string {
  return rawContent
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```(?:json)?\s*/g, "")
    .trim();
}

const hasSelections = (obj: unknown): obj is { selections: LlmSelectionInput[] } =>
  !!(obj as { selections?: unknown })?.selections &&
  Array.isArray((obj as { selections: unknown }).selections) &&
  (obj as { selections: unknown[] }).selections.length > 0;

/** Parse la réponse Gemini (stratégies 0 → regex) — aligné surprise-personalized. */
export function parseLlmSelectionsJson(rawContent: string): { selections: LlmSelectionInput[] } | null {
  const content = stripLlmResponseWrapper(rawContent);
  const repair = repairLlmJsonContent;

  for (const cand of [content, repair(content)]) {
    try {
      const obj = JSON.parse(cand);
      if (hasSelections(obj)) return obj;
    } catch {
      /* next strategy */
    }
  }

  for (let i = 0; i < content.length; i++) {
    if (content[i] !== "{") continue;
    let depth = 0;
    let end = i;
    for (let j = i; j < content.length; j++) {
      if (content[j] === "{") depth++;
      else if (content[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === i) continue;
    try {
      const obj = JSON.parse(repair(content.slice(i, end + 1)));
      if (hasSelections(obj)) return obj;
    } catch {
      /* next brace */
    }
    i = end;
  }

  const sels: LlmSelectionInput[] = [];
  const re = /"rank"\s*:\s*(\d+)[^}]*?"matchScore"\s*:\s*(\d+)(?:[^}]*?"reason"\s*:\s*"([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    sels.push({ rank: Number(m[1]), matchScore: Number(m[2]), reason: m[3] || undefined });
  }
  if (sels.length > 0) return { selections: sels };
  return null;
}

export function resolveLlmSelections(
  selections: LlmSelectionInput[],
  llmInputPool: SqlCandidate[],
): ResolvedLlmSelection[] {
  return selections
    .map((s) => {
      const rankIdx = s.rank != null ? Number(s.rank) : null;
      const candidate =
        rankIdx != null && rankIdx >= 1 && rankIdx <= llmInputPool.length
          ? llmInputPool[rankIdx - 1]
          : llmInputPool.find((c) => Number(c.tmdb_id) === Number(s.tmdb_id));
      if (!candidate) return null;
      return {
        tmdb_id: Number(candidate.tmdb_id),
        matchScore: s.matchScore || 75,
        reason: s.reason ?? null,
      };
    })
    .filter((x): x is ResolvedLlmSelection => x != null)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}

export function buildSqlRpcParams(
  input: RpcParamsInput,
  opts: CascadeLevelOptions,
  matchCount = 300,
): Record<string, unknown> {
  return {
    query_vector: `[${input.userTasteVector.join(",")}]`,
    match_count: matchCount,
    exclude_ids: input.normalizedExcludeIds,
    filter_media_type: input.effectiveFilterMediaType,
    min_rating: input.minRating > 0 ? input.minRating : 6,
    excluded_genres: input.effectiveExcludedGenres,
    liked_genres: input.effectiveLikedGenresSQL ?? input.likedGenresForSQL,
    max_duration: input.effectiveMaxDuration ?? null,
    p_user_id: input.userId ?? null,
    p_user_id2: input.partnerUserId,
    p_original_language: opts.withLang ? (input.voiceOriginalLanguage ?? null) : null,
    p_min_year: opts.withYear ? (input.voiceDecade ?? null) : null,
    p_max_year: opts.withYear ? (input.voiceDecade != null ? input.voiceDecade + 9 : null) : null,
    p_excluded_languages: input.effectiveExcludedLangsArr,
    p_excluded_clusters: input.rejectedClusters.length > 0 ? input.rejectedClusters : [],
    p_min_popularity: 8,
    p_platform_ids: opts.withPlatform ? (input.expandedPlatformIds ?? null) : null,
  };
}

export const CASCADE_LEVEL_LABELS = [
  "0 — toutes contraintes (lang+année+genres+note+plateforme)",
  "1 — sans lang/année",
  "2 — sans liked_genres profil (voiceGenres conservés)",
  "3 — sans goût restrictif (min_rating=0, voiceGenres conservés)",
] as const;

/** Params RPC par niveau de cascade SQL (niveaux 0–3). */
export function buildCascadeLevelParams(
  input: RpcParamsInput,
  level: 0 | 1 | 2 | 3,
  hardGenres: string[] = [],
): Record<string, unknown> {
  if (level === 0) {
    return buildSqlRpcParams(input, { withLang: true, withYear: true, withPlatform: true });
  }
  if (level === 1) {
    return buildSqlRpcParams(input, { withLang: false, withYear: false, withPlatform: true });
  }
  if (level === 2) {
    return {
      ...buildSqlRpcParams(input, { withLang: false, withYear: false, withPlatform: true }),
      liked_genres: hardGenres,
    };
  }
  return {
    ...buildSqlRpcParams(input, { withLang: false, withYear: false, withPlatform: true }),
    liked_genres: hardGenres,
    min_rating: 0,
    p_min_popularity: null,
  };
}

export function checkFinalSafety(
  movie: { genres?: Array<{ name: string } | string>; original_language?: string },
  effectiveExcludedGenres: string[],
  effectiveExcludedLangs: string[],
): { ok: boolean; reason?: string } {
  const genres = (movie.genres || [])
    .map((g) => (typeof g === "string" ? g : g.name))
    .filter(Boolean);
  const lang = movie.original_language || "";
  const badGenre = effectiveExcludedGenres.find((g) => genres.includes(g));
  if (badGenre) return { ok: false, reason: `genre exclu: ${badGenre}` };
  if (effectiveExcludedLangs.length > 0 && effectiveExcludedLangs.includes(lang)) {
    return { ok: false, reason: `langue exclue: ${lang}` };
  }
  return { ok: true };
}

/** Fusion score SP + movie-match (seuil SP aberrant < 60). */
export function mergeRecommendationScores(
  spScore: number | null | undefined,
  mmScore: number | null | undefined,
  spMinValid = 60,
): number | null {
  const spValid = spScore != null && spScore >= spMinValid ? spScore : null;
  const mm = mmScore ?? null;
  if (spValid != null && mm != null) return Math.max(spValid, mm);
  return spValid ?? mm;
}

export function filterByUsedIds<T extends { tmdbId: number }>(
  selections: T[],
  usedIds: Set<number>,
): T[] {
  return selections.filter((s) => !usedIds.has(s.tmdbId));
}
