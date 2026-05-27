import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function getMovieDetails(id: number, type: "movie" | "tv" = "movie"): Promise<any> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}


async function getProviderIdsFR(tmdbId: number, mediaType: "movie" | "tv"): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`,
    );
    if (!res.ok) return [];
    const text = await res.text();
    if (!text) return [];
    const data = JSON.parse(text);
    const fr = data?.results?.FR;
    if (!fr) return [];
    return [...(fr.flatrate || []), ...(fr.free || []), ...(fr.ads || [])].map((p: any) =>
      Number(p.provider_id),
    );
  } catch {
    return [];
  }
}

async function safeFetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const t0 = Date.now();
    const {
      tasteProfile,
      userTasteVector,
      platformIds,
      excludeIds,
      excludedPlatformIds,
      excludedGenres,
      minRating: rawMinRating,
      rejectionContext,
      explorationLevel: rawExplorationLevel,
      mediaType: rawMediaType,
      count: rawCount,
      maxDuration: rawMaxDuration,
      minMatchScore: rawMinMatchScore,
      likedMovies,
      voiceGenres: rawVoiceGenres,
      voiceOriginalLanguage: rawVoiceLanguage,
      voiceMediaType: rawVoiceMediaType,
      voiceMaxDuration: rawVoiceDuration,
      voiceDecade: rawVoiceDecade,
      moodContext: rawMoodContext,
      moodBoostGenres: rawMoodBoostGenres,
    } = await req.json();

    // Voice overrides: what was stated replaces profile; what wasn't keeps profile defaults
    const voiceGenres: string[] | null = Array.isArray(rawVoiceGenres) && rawVoiceGenres.length > 0 ? rawVoiceGenres : null;
    const voiceOriginalLanguage: string | null = typeof rawVoiceLanguage === "string" && rawVoiceLanguage.length > 0 ? rawVoiceLanguage : null;
    const voiceMediaType: "movie" | "tv" | null = rawVoiceMediaType === "movie" || rawVoiceMediaType === "tv" ? rawVoiceMediaType : null;
    const voiceMaxDuration: number | null = typeof rawVoiceDuration === "number" && rawVoiceDuration > 0 ? rawVoiceDuration : null;
    const voiceDecade: number | null = typeof rawVoiceDecade === "number" && rawVoiceDecade >= 1900 ? rawVoiceDecade : null;

    // Mood overrides: applied when user selects an ambiance chip
    const moodContext: string | null = typeof rawMoodContext === "string" && rawMoodContext.length > 0 ? rawMoodContext : null;
    const moodBoostGenres: string[] | null = Array.isArray(rawMoodBoostGenres) && rawMoodBoostGenres.length > 0 ? rawMoodBoostGenres : null;

    const requestedCount = Math.max(1, Math.min(typeof rawCount === "number" ? rawCount : 3, 20));
    const minRating = typeof rawMinRating === "number" ? Math.min(rawMinRating, 8) : 0;
    const explorationLevel =
      typeof rawExplorationLevel === "number" ? Math.max(0, Math.min(10, rawExplorationLevel)) : 5;
    const mediaType: "movie" | "tv" | "both" =
      rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";
    const minMatchScore = typeof rawMinMatchScore === "number" ? Math.max(0, Math.min(100, rawMinMatchScore)) : 60;
    const maxDuration = typeof rawMaxDuration === "number" && rawMaxDuration > 0 ? rawMaxDuration : null;
    const searchType: "movie" | "tv" = mediaType === "both" ? (Math.random() < 0.5 ? "movie" : "tv") : mediaType;

    // Voice overrides replace profile when stated
    const effectiveSearchType: "movie" | "tv" = voiceMediaType ?? searchType;
    const effectiveLikedGenresSQL = voiceGenres ?? null; // null means "use profile genres below"
    const effectiveMaxDuration = voiceMaxDuration ?? maxDuration;
    const effectiveFilterMediaType = voiceMediaType ?? (mediaType === "both" ? null : searchType);

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY is not configured");

    let userId: string | null = null;
    try {
      const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (jwt) {
        const payload = JSON.parse(atob(jwt.split(".")[1]));
        userId = payload.sub ?? null;
      }
    } catch {
      /* anonymous */
    }

    const normalizedExcludeIds = [
      ...new Set([
        ...(likedMovies || []).map((m: any) => Number(m.tmdb_id || m.id)).filter(Number.isFinite),
        ...(excludeIds || []).map((id: any) => Number(id)).filter(Number.isFinite),
        ...(tasteProfile?.excludeIds || []).map((id: any) => Number(id)).filter(Number.isFinite),
      ]),
    ];
    const excludedSet = new Set(normalizedExcludeIds);

    const topGenres = tasteProfile?.topGenres || [];
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const rejectedClusters = tasteProfile?.rejectedClusters || [];
    const confidence = tasteProfile?.confidence || { score: 50 };
    const stats = tasteProfile?.stats || {};
    const likedTitles = (likedMovies || [])
      .slice(0, 15)
      .map((m: any) => m.title)
      .filter(Boolean);
    const fatigueState = tasteProfile?.fatigueState || {};
    const fatiguedGenres = Object.entries(fatigueState)
      .filter(([k, v]) => k.startsWith("genre_") && (v as number) >= 3)
      .map(([k]) => k.replace("genre_", ""));

    const genreNameToId: Record<string, number> = {
      Action: 28,
      Aventure: 12,
      Animation: 16,
      Comédie: 35,
      Crime: 80,
      Documentaire: 99,
      Drame: 18,
      Famille: 10751,
      Familial: 10751,
      Fantastique: 14,
      Histoire: 36,
      Horreur: 27,
      Musique: 10402,
      Mystère: 9648,
      Romance: 10749,
      "Science-Fiction": 878,
      Thriller: 53,
      Guerre: 10752,
      Western: 37,
    };

    const tvGenreEquivalents: Record<string, string[]> = {
      Action: ["Action & Adventure"],
      Aventure: ["Action & Adventure"],
      "Science-Fiction": ["Science-Fiction & Fantastique", "Sci-Fi & Fantasy"],
      Fantastique: ["Science-Fiction & Fantastique", "Sci-Fi & Fantasy"],
      Animation: ["Kids", "Animation"],
      Famille: ["Kids", "Familial"],
      Familial: ["Kids", "Famille"],
      Guerre: ["War & Politics"],
      Crime: ["Crime"],
      Horreur: ["Horreur"],
    };

    const likedWithTv =
      topGenres.length >= 2
        ? [
            ...new Set([
              ...(topGenres as string[]),
              ...(topGenres as string[]).flatMap((g) => tvGenreEquivalents[g] ?? []),
            ]),
          ]
        : [];

    // Pour le SQL : genres du profil + genres mood, uniquement les genres TMDB valides
    const likedGenresForSQL =
      topGenres.length >= 2
        ? [...new Set([
            ...(topGenres as string[]).filter((g) => g in genreNameToId),
            ...(moodBoostGenres ?? []).filter((g) => g in genreNameToId),
          ])]
        : (moodBoostGenres ?? []).filter((g) => g in genreNameToId);

    const hardExcludedFormats = ["Reality", "Soap", "Talk", "News", "Téléfilm", "Horreur"];
    const autoExcluded = hardExcludedFormats.filter((g) => !likedWithTv.includes(g));
    // Genres en fatigue (>= 3 occurrences) exclus en SQL — diversification forcée
    const effectiveExcludedGenres = [...new Set([...(excludedGenres || []), ...autoExcluded, ...fatiguedGenres])];

    const excludedGenreIds = new Set(effectiveExcludedGenres.map((g: string) => genreNameToId[g]).filter(Boolean));
    const likedGenreIds = new Set((topGenres as string[]).map((g) => genreNameToId[g]).filter(Boolean));

    const isMovieAllowed = (movie: any): boolean => {
      if (excludedSet.has(movie.id)) return false;
      if (minRating > 0 && (movie.vote_average || 0) > 0 && (movie.vote_average || 0) < minRating) return false;
      if (excludedGenreIds.size > 0 && movie.genre_ids?.some((gid: number) => excludedGenreIds.has(gid))) return false;
      return true;
    };

    const isGenreCompatibleForFallback = (movie: any): boolean => {
      if (likedGenreIds.size === 0) return true;
      return movie.genre_ids?.some((gid: number) => likedGenreIds.has(gid)) ?? true;
    };

    const fireEmbedding = (m: any) => {
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            tmdbId: m.id,
            title: m.title || m.name,
            overview: m.overview,
            genres: (m.genres || []).map((g: any) => g.name),
            originalLanguage: m.original_language || null,
          }),
        }).catch(() => {});
      }
    };

    // ── Préférences d'origine depuis user_preferences (filtre dur) ──
    const ORIGIN_KEY_LANGS: Record<string, string[]> = {
      "cinema-francais": ["fr"],
      "cinema-americain": ["en"],
      "cinema-asiatique": ["ko", "ja", "zh", "cn", "th", "hi", "ta", "te", "ml"],
      "cinema-africain": [],
      "cinema-amerique-du-sud": ["es", "pt"],
    };
    let userExcludedOriginLangs = new Set<string>();
    let userPreferredOriginLangs = new Set<string>();
    if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const sbPrefs = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: originPrefs } = await sbPrefs
          .from("user_preferences")
          .select("weight, tag:tag_id(key)")
          .eq("user_id", userId);
        for (const p of originPrefs || []) {
          const langs = ORIGIN_KEY_LANGS[(p as any).tag?.key || ""];
          if (!langs) continue;
          if ((p as any).weight < 0) langs.forEach((l: string) => userExcludedOriginLangs.add(l));
          else if ((p as any).weight > 0) langs.forEach((l: string) => userPreferredOriginLangs.add(l));
        }
        if (userExcludedOriginLangs.size > 0 || userPreferredOriginLangs.size > 0) {
          console.log(`[SP] Origines profil — exclues: [${[...userExcludedOriginLangs].join(",")}] préférées: [${[...userPreferredOriginLangs].join(",")}]`);
        }
      } catch (e) {
        console.error("[SP] Origin prefs fetch failed:", e);
      }
    }

    // ── Langues exclues effectives : user_preferences + tags de genre origine ──
    // Les tags comme "Cinéma asiatique" sont stockés dans excludedGenres (pas user_preferences),
    // donc on les traduit en codes langue pour les passer au SQL dès la récupération des 300 candidats.
    const GENRE_TAG_LANGS: Record<string, string[]> = {
      "Cinéma asiatique": ["ko", "ja", "zh", "cn", "th", "hi", "ta", "te", "ml"],
      "Cinéma Amérique du Sud": ["es", "pt"],
      "Cinéma africain": [],
    };
    const genreTagExcludedLangs = effectiveExcludedGenres
      .flatMap((g: string) => GENRE_TAG_LANGS[g] ?? []);

    // Si la voix demande explicitement une langue exclue dans le profil → la voix prime
    const effectiveExcludedLangsSet = new Set([
      ...userExcludedOriginLangs,
      ...genreTagExcludedLangs,
    ]);
    if (voiceOriginalLanguage) effectiveExcludedLangsSet.delete(voiceOriginalLanguage);
    const effectiveExcludedLangsArr = [...effectiveExcludedLangsSet];

    // ── ÉTAPE 1 : SQL — top candidats par similarité vectorielle ──
    // Langue, décennie et exclusions d'origine filtrées en SQL (plus de post-filtrage).
    // 300 candidats quand un filtre plateforme est actif (hit-rate ~7% → besoin de plus de marge).
    const sqlMatchCount = platformIds?.length > 0 ? 300 : 200;
    const buildRpcParams = (opts: { withLang: boolean; withYear: boolean }) => ({
      query_vector: `[${userTasteVector.join(",")}]`,
      match_count: sqlMatchCount,
      exclude_ids: normalizedExcludeIds,
      filter_media_type: effectiveFilterMediaType,
      min_rating: 6,
      excluded_genres: effectiveExcludedGenres,
      liked_genres: effectiveLikedGenresSQL ?? likedGenresForSQL,
      max_duration: effectiveMaxDuration ?? null,
      p_user_id: userId ?? null,
      p_original_language: opts.withLang ? (voiceOriginalLanguage ?? null) : null,
      p_min_year: opts.withYear ? (voiceDecade ?? null) : null,
      p_max_year: opts.withYear ? (voiceDecade != null ? voiceDecade + 9 : null) : null,
      p_excluded_languages: effectiveExcludedLangsArr,
      p_excluded_clusters: rejectedClusters.length > 0 ? rejectedClusters : [],
    });

    let candidates: any[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userTasteVector) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data, error: rpcError } = await supabase.rpc(
          "match_movies_for_recommendation",
          buildRpcParams({ withLang: true, withYear: true }),
        );
        if (rpcError) console.error("SQL RPC error:", rpcError);
        if (data) candidates = data as any[];
        console.log(
          `[SP] SQL candidates: ${candidates.length} | liked: [${(effectiveLikedGenresSQL ?? likedWithTv).slice(0, 4).join(", ")}...] | lang: ${voiceOriginalLanguage ?? "profil"} | decade: ${voiceDecade ?? "—"} | excluded_langs: [${effectiveExcludedLangsArr.join(",")}] | excludeIds: ${normalizedExcludeIds.length}`,
        );

        // ── Fallback langue/année : si trop peu de candidats avec filtres voix stricts, relancer sans ──
        if ((voiceOriginalLanguage || voiceDecade) && candidates.length < 10) {
          console.log(`[SP] Voice lang/year fallback: ${candidates.length} candidats — relance sans filtre langue/année`);
          const { data: data2 } = await supabase.rpc(
            "match_movies_for_recommendation",
            buildRpcParams({ withLang: false, withYear: false }),
          );
          if (data2 && (data2 as any[]).length > candidates.length) {
            candidates = data2 as any[];
            console.log(`[SP] Lang/year fallback: ${candidates.length} candidats`);
          }
        }

        // ── Fallback durée : si très peu de candidats avec contrainte vocale de durée, relancer sans durée ──
        if (voiceMaxDuration && candidates.length < 10) {
          console.log(`[SP] Voice duration fallback: ${candidates.length} candidates with maxDuration=${voiceMaxDuration} — retrying without duration`);
          const { data: data3 } = await supabase.rpc("match_movies_for_recommendation", {
            ...buildRpcParams({ withLang: true, withYear: true }),
            max_duration: null,
          });
          if (data3 && (data3 as any[]).length > candidates.length) {
            candidates = data3 as any[];
            console.log(`[SP] Duration fallback: ${candidates.length} candidates`);
          }
        }
      } catch (e) {
        console.error("SQL vector search failed:", e);
      }
    } else {
      console.log(`[SP] SQL skipped — userTasteVector: ${!!userTasteVector}, SUPABASE_URL: ${!!SUPABASE_URL}`);
    }

    // ── ÉTAPE 1.5 : Filtre plateforme sur les 100 candidats SQL ──
    let filteredCandidates = candidates;
    if (platformIds?.length > 0 && candidates.length > 0) {
      const platformSet = new Set((platformIds as number[]).map(Number));
      const PARALLEL = 30;
      const platformResults: { tmdb_id: number; onPlatform: boolean }[] = [];

      for (let i = 0; i < candidates.length; i += PARALLEL) {
        const chunk = candidates.slice(i, i + PARALLEL);
        const chunkResults = await Promise.all(
          chunk.map(async (c: any) => {
            const itemType: "movie" | "tv" = c.media_type === "tv" ? "tv" : "movie";
            const providerIds = await getProviderIdsFR(Number(c.tmdb_id), itemType);
            const onPlatform = providerIds.some((pid) => platformSet.has(pid));
            return { tmdb_id: c.tmdb_id, onPlatform };
          }),
        );
        platformResults.push(...chunkResults);
        if (i + PARALLEL < candidates.length) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }

      const platformMatchedIds = new Set(
        platformResults.filter((r) => r.onPlatform).map((r) => r.tmdb_id),
      );
      const platformFiltered = candidates.filter((c: any) => platformMatchedIds.has(c.tmdb_id));
      console.log(
        `[SP] Filtre plateforme: ${platformFiltered.length}/${candidates.length} candidats sur les plateformes [${platformIds.join(",")}]`,
      );
      // Même 1 seul film sur plateforme est suffisant — ne jamais revenir aux candidats non filtrés
      filteredCandidates = platformFiltered;
      if (platformFiltered.length === 0) {
        console.log(`[SP] Aucun candidat SQL sur les plateformes user — fallback TMDB discover utilisé`);
      }
    }

    const t1 = Date.now();
    console.log(`[SP⏱] SQL + filtres: ${t1 - t0}ms (${candidates.length} candidats → ${filteredCandidates.length} après filtres)`);

    // ── Préférences d'origine (calculées une fois, utilisées dans LLM + debug) ──
    const ORIGIN_MAP: Record<string, string> = {
      "Cinéma français": "français (langue: fr)",
      "Cinéma américain": "américain/anglophone (langue: en)",
      "Cinéma asiatique": "asiatique (langues: ko, ja, zh, cn, th, hi)",
      "Cinéma africain": "africain",
      "Cinéma Amérique du Sud": "latino/sud-américain (langues: es, pt)",
    };
    const likedOrigins = [...new Set([...likedWithTv, ...(topGenres as string[])])]
      .filter((g) => g in ORIGIN_MAP)
      .map((g) => ORIGIN_MAP[g]);
    const excludedOrigins = effectiveExcludedGenres
      .filter((g: string) => g in ORIGIN_MAP)
      .map((g: string) => ORIGIN_MAP[g]);

    const ORIGIN_LANGS: Record<string, string[]> = {
      "français (langue: fr)": ["fr"],
      "américain/anglophone (langue: en)": ["en"],
      "asiatique (langues: ko, ja, zh, cn, th, hi)": ["ko", "ja", "zh", "cn", "th", "hi", "ta", "te", "ml"],
      "africain": [],
      "latino/sud-américain (langues: es, pt)": ["es", "pt"],
    };
    // Merge: boosts from tasteProfile labels + hard exclusions from user_preferences
    const preferredLangsBoost = new Set([
      ...likedOrigins.flatMap((o: string) => ORIGIN_LANGS[o] ?? []),
      ...userPreferredOriginLangs,
    ]);
    const excludedLangsBoost = new Set([
      ...excludedOrigins.flatMap((o: string) => ORIGIN_LANGS[o] ?? []),
      ...userExcludedOriginLangs,
    ]);

    // ── ÉTAPE 1.7 : Enrichissement langue TMDB pour les candidats avec original_language=null ──
    // Les embeddings créés avant l'ajout de la colonne original_language ont null en base.
    // Sans cette donnée, le filtre d'exclusion d'origine (asiatique, latino...) est aveugle.
    if (excludedLangsBoost.size > 0 && filteredCandidates.length > 0) {
      const nullLangCandidates = filteredCandidates
        .filter((c: any) => !c.original_language)
        .slice(0, 60);
      if (nullLangCandidates.length > 0) {
        console.log(`[SP] Enrichissement langue TMDB: ${nullLangCandidates.length} candidats sans original_language`);
        const enriched = await Promise.all(
          nullLangCandidates.map(async (c: any) => {
            try {
              const type = c.media_type === "tv" ? "tv" : "movie";
              const res = await fetch(
                `https://api.themoviedb.org/3/${type}/${c.tmdb_id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
              );
              if (res.ok) {
                const tmdbData = await res.json();
                const lang = (tmdbData.original_language as string) || null;
                if (lang) {
                  // Backfill DB en tâche de fond
                  fireEmbedding({
                    id: c.tmdb_id,
                    title: c.title,
                    overview: "",
                    genres: (c.genres || []).map((g: string) => ({ name: g })),
                    original_language: lang,
                  });
                }
                return { ...c, original_language: lang };
              }
            } catch { /* ignore */ }
            return c;
          }),
        );
        const enrichedMap = new Map(enriched.map((c: any) => [c.tmdb_id, c]));
        filteredCandidates = filteredCandidates.map((c: any) => enrichedMap.get(c.tmdb_id) ?? c);
        const enrichedCount = enriched.filter((c: any) => c.original_language).length;
        console.log(`[SP] Enrichissement: ${enrichedCount}/${nullLangCandidates.length} langues récupérées`);
      }
    }

    const t2 = Date.now();
    if (t2 - t1 > 50) console.log(`[SP⏱] Enrichissement langue TMDB: ${t2 - t1}ms`);

    // ── ÉTAPE 2 : Sélection déterministe depuis le pool SQL ──
    // Gemini n'est pas fiable pour la sélection structurée (sous-sélection, hallucinations d'ID).
    // On sélectionne directement depuis le pool SQL trié par score composé avec diversité de genres.
    let llmSelections: any[] = [];
    let llmFilteredAll = false;
    const llmPoolSize = 30;
    let llmPool: any[] = [];
    const capturedSystemPrompt: string | null = null;
    const llmDebugError: string | null = null;

    if (filteredCandidates.length >= 1) {
      const compositeScore = (c: any) => {
        let score = (c.similarity ?? 0) * 100 + (c.vote_average ?? 0);
        if (preferredLangsBoost.size > 0 && preferredLangsBoost.has(c.original_language || "")) score += 15;
        return score;
      };

      const originEligible = excludedLangsBoost.size > 0
        ? filteredCandidates.filter((c: any) => !excludedLangsBoost.has(c.original_language || ""))
        : filteredCandidates;
      const topPool = [...originEligible]
        .sort((a, b) => compositeScore(b) - compositeScore(a))
        .slice(0, llmPoolSize);
      llmPool = topPool;

      // Score composé → matchScore (72-92%) selon rang dans le pool
      const poolScores = topPool.map((c: any) => compositeScore(c));
      const scoreMin = poolScores[poolScores.length - 1] ?? 0;
      const scoreMax = poolScores[0] ?? 1;
      const scoreRange = scoreMax - scoreMin || 1;
      const toMatchScore = (c: any) => Math.round(72 + ((compositeScore(c) - scoreMin) / scoreRange) * 20);

      // Exclure le film récemment refusé
      const rejectedLower = rejectionContext?.rejectedTitle?.toLowerCase() || "";
      const eligible = rejectedLower
        ? topPool.filter((c: any) => !(c.title || "").toLowerCase().includes(rejectedLower))
        : topPool;

      // Sélection avec diversité : max 2 films par genre principal
      const selected: any[] = [];
      const genreCount: Record<string, number> = {};
      const MAX_PER_GENRE = 2;
      const needed = requestedCount + 2; // extras pour absorber les échecs TMDB

      for (const c of eligible) {
        if (selected.length >= needed) break;
        const primaryGenre = (c.genres || [])[0] || "?";
        if ((genreCount[primaryGenre] || 0) < MAX_PER_GENRE) {
          genreCount[primaryGenre] = (genreCount[primaryGenre] || 0) + 1;
          selected.push(c);
        }
      }
      // Compléter sans contrainte si pas assez
      if (selected.length < needed) {
        const selectedIds = new Set(selected.map((c: any) => c.tmdb_id));
        for (const c of eligible) {
          if (selected.length >= needed) break;
          if (!selectedIds.has(c.tmdb_id)) selected.push(c);
        }
      }

      llmSelections = selected.map((c: any) => ({
        tmdb_id: Number(c.tmdb_id),
        matchScore: toMatchScore(c),
        reason: null, // movie-match génère les textes personnalisés
      }));

      const debugList = topPool.map((c: any, i: number) => {
        const typeLabel = c.media_type === "tv" ? "📺" : "🎬";
        return `[${i + 1}] ${typeLabel} "${c.title || "?"}" (${c.year || "?"}) | ${(c.genres || []).slice(0, 2).join(", ")} | ⭐${c.vote_average > 0 ? c.vote_average.toFixed(1) : "?"} | sim=${c.similarity != null ? Math.round(c.similarity * 1000) / 10 : "?"}%`;
      }).join("\n");
      console.log(`[SP] Pool SQL top ${topPool.length}:\n${debugList}`);
      console.log(`[SP] Sélection déterministe: ${llmSelections.length} films (diversité genres, skip refus)`);
    } else {
      console.log(`[SP] Sélection skipped — candidats insuffisants: ${filteredCandidates.length}`);
    }

    const t3 = Date.now();
    console.log(`[SP⏱] Sélection déterministe: ${t3 - t2}ms → ${llmSelections.length} films`);

    // ── ÉTAPE 3 : TMDB — enrichissement en batch ──
    // Trier par score LLM décroissant : on enrichit les meilleurs en premier
    llmSelections.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));

    const movies: any[] = [];
    const usedIds = new Set<number>();
    const tmdbDiag: { id: number; title: string; type: string; ok: boolean; reason?: string }[] = [];
    const fallbackTrace: { stage: string; id: number; title: string; type: string }[] = [];

    if (llmSelections.length > 0) {
      const tmdbResults = await Promise.all(
        llmSelections.map(async (sel: any) => {
          const candidate = candidates.find((c: any) => Number(c.tmdb_id) === Number(sel.tmdb_id));
          const rawType = candidate?.media_type;
          const itemType: "movie" | "tv" = rawType === "tv" ? "tv" : rawType === "movie" ? "movie" : searchType;
          const detail = await getMovieDetails(sel.tmdb_id, itemType);
          if (!detail) {
            console.warn(`[SP] TMDB null for id=${sel.tmdb_id} type=${itemType} (rawType=${rawType})`);
            tmdbDiag.push({
              id: sel.tmdb_id,
              title: candidate?.title || "?",
              type: itemType,
              ok: false,
              reason: "TMDB returned null",
            });
            return null;
          }
          if (usedIds.has(detail.id)) {
            tmdbDiag.push({
              id: sel.tmdb_id,
              title: candidate?.title || "?",
              type: itemType,
              ok: false,
              reason: "duplicate id",
            });
            return null;
          }
          if (maxDuration && itemType === "movie" && (detail.runtime || 0) > maxDuration) {
            tmdbDiag.push({
              id: sel.tmdb_id,
              title: candidate?.title || "?",
              type: itemType,
              ok: false,
              reason: `${detail.runtime}min > limite ${maxDuration}min`,
            });
            return null;
          }
          // Normalise les séries TV : TMDB renvoie "name" au lieu de "title"
          if (itemType === "tv") {
            if (!detail.title && detail.name) detail.title = detail.name;
            if (!detail.original_title && detail.original_name) detail.original_title = detail.original_name;
            if (!detail.release_date && detail.first_air_date) detail.release_date = detail.first_air_date;
          }
          // Filtre plateforme déjà fait en SQL — pas de re-vérification TMDB ici.
          tmdbDiag.push({ id: sel.tmdb_id, title: detail.title || candidate?.title || "?", type: itemType, ok: true });
          return { detail, sel };
        }),
      );

      for (const r of tmdbResults) {
        if (!r) continue;
        if (usedIds.has(r.detail.id)) continue;
        usedIds.add(r.detail.id);
        movies.push({
          movie: r.detail,
          reason: r.sel.reason || "Ce film correspond à tes goûts.",
          confidence: r.sel.matchScore || 75,
          recommendationTexts: {
            matchScore: r.sel.matchScore || 75,
            score: r.sel.matchScore || 75,
            whyItMatches: r.sel.reason || null,
          },
        });
      }
    }

    const t4 = Date.now();
    console.log(`[SP⏱] TMDB enrichissement batch: ${t4 - t3}ms → ${movies.length} films OK`);

    // ── ÉTAPE 4 : Fallback ──
    // Genre IDs effectifs pour le fallback : voix prime sur profil
    const effectiveLikedGenreIds = voiceGenres
      ? new Set(voiceGenres.map((g: string) => genreNameToId[g]).filter(Boolean))
      : likedGenreIds;

    if (movies.length < requestedCount) {
      console.log(`[SP] Fallback needed: have ${movies.length}/${requestedCount}`);
      for (let attempt = 0; attempt < 4 && movies.length < requestedCount; attempt++) {
        const params = new URLSearchParams({
          api_key: TMDB_API_KEY,
          language: "fr-FR",
          sort_by: "popularity.desc",
          "vote_count.gte": "50",
          page: String(Math.floor(Math.random() * 5) + 1),
        });
        if (minRating > 0) params.set("vote_average.gte", String(minRating));
        if (effectiveMaxDuration && searchType === "movie") params.set("with_runtime.lte", String(effectiveMaxDuration));
        if (excludedGenreIds.size > 0) params.set("without_genres", [...excludedGenreIds].join(","));
        if (effectiveLikedGenreIds.size > 0) params.set("with_genres", [...effectiveLikedGenreIds].join("|"));
        if (voiceOriginalLanguage) params.set("with_original_language", voiceOriginalLanguage);
        if (voiceDecade) {
          params.set("release_date.gte", `${voiceDecade}-01-01`);
          params.set("release_date.lte", `${voiceDecade + 9}-12-31`);
        }
        if (platformIds?.length > 0) {
          params.set("with_watch_providers", platformIds.join("|"));
          params.set("watch_region", "FR");
        }
        const data = await safeFetchJson(`https://api.themoviedb.org/3/discover/${searchType}?${params}`);
        const found = (data?.results || []).find(
          (r: any) => isMovieAllowed(r) && isGenreCompatibleForFallback(r) && !usedIds.has(r.id),
        );
        if (!found) continue;
        const detail = await getMovieDetails(found.id, searchType);
        if (!detail || usedIds.has(detail.id)) continue;
        usedIds.add(detail.id);
        if (searchType === "tv") {
          if (!detail.title && detail.name) detail.title = detail.name;
          if (!detail.original_title && detail.original_name) detail.original_title = detail.original_name;
          if (!detail.release_date && detail.first_air_date) detail.release_date = detail.first_air_date;
        }
        fireEmbedding(detail);
        fallbackTrace.push({ stage: "discover", id: detail.id, title: detail.title || detail.name || "?", type: searchType });
        movies.push({
          movie: detail,
          reason: "Ce film correspond à tes genres préférés.",
          confidence: minMatchScore,
          recommendationTexts: null,
        });
      }
    }

    // Fallback trending/popular — ignoré si l'utilisateur a des plateformes sélectionnées
    // (les URLs trending ne supportent pas le filtre watch_providers)
    if (!platformIds?.length) {
      for (const url of [
        `https://api.themoviedb.org/3/trending/${searchType}/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
        `https://api.themoviedb.org/3/${searchType}/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`,
        `https://api.themoviedb.org/3/${searchType}/top_rated?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`,
      ]) {
        if (movies.length >= requestedCount) break;
        const data = await safeFetchJson(url);
        for (const r of data?.results || []) {
          if (movies.length >= requestedCount) break;
          if (usedIds.has(r.id) || !isMovieAllowed(r) || !isGenreCompatibleForFallback(r)) continue;
          const detail = await getMovieDetails(r.id, searchType);
          if (!detail || usedIds.has(detail.id)) continue;
          usedIds.add(detail.id);
          if (searchType === "tv") {
            if (!detail.title && detail.name) detail.title = detail.name;
            if (!detail.original_title && detail.original_name) detail.original_title = detail.original_name;
            if (!detail.release_date && detail.first_air_date) detail.release_date = detail.first_air_date;
          }
          fireEmbedding(detail);
          fallbackTrace.push({ stage: "trending", id: detail.id, title: detail.title || detail.name || "?", type: searchType });
          movies.push({
            movie: detail,
            reason: "Tendance du moment.",
            confidence: minMatchScore,
            recommendationTexts: null,
          });
        }
      }
    }

    // ── FALLBACK NUCLÉAIRE : si toujours 0 film, on lève genre/note mais JAMAIS la plateforme ──
    if (movies.length === 0) {
      console.log(`[SP] Fallback nucléaire — genre/note levés, plateforme conservée`);
      llmFilteredAll = true;
      if (platformIds?.length > 0) {
        // Avec plateformes : discover filtré par plateforme, tous genres/notes acceptés
        for (let page = 1; page <= 3 && movies.length < requestedCount; page++) {
          const params = new URLSearchParams({
            api_key: TMDB_API_KEY,
            language: "fr-FR",
            sort_by: "popularity.desc",
            "vote_count.gte": "10",
            with_watch_providers: platformIds.join("|"),
            watch_region: "FR",
            page: String(page),
          });
          const data = await safeFetchJson(`https://api.themoviedb.org/3/discover/${searchType}?${params}`);
          for (const r of data?.results || []) {
            if (movies.length >= requestedCount) break;
            if (usedIds.has(r.id) || excludedSet.has(r.id)) continue;
            const detail = await getMovieDetails(r.id, searchType);
            if (!detail || usedIds.has(detail.id)) continue;
            usedIds.add(detail.id);
            if (searchType === "tv") {
              if (!detail.title && detail.name) detail.title = detail.name;
              if (!detail.original_title && detail.original_name) detail.original_title = detail.original_name;
              if (!detail.release_date && detail.first_air_date) detail.release_date = detail.first_air_date;
            }
            fallbackTrace.push({ stage: "nuclear-platforms", id: detail.id, title: detail.title || detail.name || "?", type: searchType });
            movies.push({
              movie: detail,
              reason: "Film populaire sur tes plateformes — tes filtres de genre ont été assouplis.",
              confidence: 60,
              recommendationTexts: null,
            });
          }
        }
      } else {
        // Sans plateformes : trending/popular, tous filtres levés
        const nuclearUrls = [
          `https://api.themoviedb.org/3/${searchType}/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`,
          `https://api.themoviedb.org/3/${searchType}/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=2`,
          `https://api.themoviedb.org/3/trending/${searchType}/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
        ];
        for (const url of nuclearUrls) {
          if (movies.length >= requestedCount) break;
          const data = await safeFetchJson(url);
          for (const r of data?.results || []) {
            if (movies.length >= requestedCount) break;
            if (usedIds.has(r.id) || excludedSet.has(r.id)) continue;
            const detail = await getMovieDetails(r.id, searchType);
            if (!detail || usedIds.has(detail.id)) continue;
            usedIds.add(detail.id);
            if (searchType === "tv") {
              if (!detail.title && detail.name) detail.title = detail.name;
              if (!detail.original_title && detail.original_name) detail.original_title = detail.original_name;
              if (!detail.release_date && detail.first_air_date) detail.release_date = detail.first_air_date;
            }
            fallbackTrace.push({ stage: "nuclear-popular", id: detail.id, title: detail.title || detail.name || "?", type: searchType });
            movies.push({
              movie: detail,
              reason: "Film populaire du moment — tes filtres ont été assouplis.",
              confidence: 60,
              recommendationTexts: null,
            });
          }
        }
      }
      console.log(`[SP] Fallback nucléaire: ${movies.length} film(s) trouvé(s)`);
    }

    // Tri par origine : préféré (2) → neutre (1) → exclu (0), puis score décroissant au sein de chaque groupe.
    // Les films d'origines exclues ne remontent que si rien d'autre ne remplit les slots.
    if (preferredLangsBoost.size > 0 || excludedLangsBoost.size > 0) {
      const originRank = (lang: string): number => {
        if (preferredLangsBoost.has(lang)) return 2;
        if (excludedLangsBoost.has(lang)) return 0;
        return 1;
      };
      movies.sort((a: any, b: any) => {
        const aRank = originRank(a.movie?.original_language || "");
        const bRank = originRank(b.movie?.original_language || "");
        if (aRank !== bRank) return bRank - aRank;
        return (b.confidence || 0) - (a.confidence || 0);
      });
      console.log(`[SP] Tri origine : préférées [${[...preferredLangsBoost].join(", ")}] exclues [${[...excludedLangsBoost].join(", ")}] → ${movies.slice(0, requestedCount).map((m: any) => `${m.movie?.title || "?"}(${m.movie?.original_language || "?"})`).join(", ")}`);
    }

    // Garde au maximum le nombre souhaité par l'utilisateur
    const finalMovies = movies.slice(0, requestedCount);

    const tFinal = Date.now();
    console.log(
      `[SP] Final: ${finalMovies.length}/${movies.length} movies kept (requested ${requestedCount}), mode: ${llmSelections.length > 0 ? "retrieve-rerank" : "fallback"}`,
    );
    console.log(`[SP⏱] TOTAL: ${tFinal - t0}ms | SQL: ${t1 - t0}ms | LangEnrich: ${t2 - t1}ms | Select: ${t3 - t2}ms | TMDB: ${t4 - t3}ms | Fallback: ${tFinal - t4}ms`);

    const toCompositeScore = (c: any) =>
      Math.round(((c.similarity ?? 0) * 100 + (c.vote_average ?? 0)) * 10) / 10;

    const toDebugRow = (c: any) => ({
      id: c.tmdb_id,
      title: c.title,
      year: c.year || "?",
      note: c.vote_average > 0 ? Math.round(c.vote_average * 10) / 10 : null,
      sim: c.similarity != null ? Math.round(c.similarity * 1000) / 10 : null,
      composite: toCompositeScore(c),
      genres: (c.genres || []).slice(0, 4),
      type: c.media_type,
    });

    return new Response(
      JSON.stringify({
        movies: finalMovies,
        movie: finalMovies[0]?.movie || null,
        reason: finalMovies[0]?.reason || "",
        confidence: finalMovies[0]?.confidence || minMatchScore,
        engineMeta: {
          profileConfidence: confidence.score,
          mode: llmSelections.length > 0 ? "retrieve-rerank" : "discover-fallback",
          candidatesFound: candidates.length,
          llmSelected: llmSelections.length,
          llmError: llmDebugError,
          finalCount: finalMovies.length,
          noSQLCandidates: candidates.length === 0,
          llmFilteredAll,
          filtersRelaxed: llmFilteredAll || (candidates.length === 0 && minRating > 0),
          timings: {
            total: tFinal - t0,
            sql: t1 - t0,
            langEnrich: t2 - t1,
            select: t3 - t2,
            tmdb: t4 - t3,
            fallback: tFinal - t4,
          },
        },
        debugData: {
          filters: {
            excludeCount: normalizedExcludeIds.length,
            minRating,
            maxDuration: effectiveMaxDuration ?? null,
            likedGenres: effectiveLikedGenresSQL ?? likedGenresForSQL,
            effectiveExcludedGenres,
            voiceOverrides: {
              genres: voiceGenres,
              language: voiceOriginalLanguage,
              mediaType: voiceMediaType,
              decade: voiceDecade,
              maxDuration: voiceMaxDuration,
            },
          },
          systemPrompt: capturedSystemPrompt,
          llmProfile: {
            genresPrefers: likedWithTv,
            genresExclus: effectiveExcludedGenres,
            genresFatigue: fatiguedGenres,
            originesAimees: likedOrigins,
            originesExclues: excludedOrigins,
            clusters: tasteClusters.slice(0, 5),
            clustersRejetes: rejectedClusters,
            filmsAimes: likedTitles,
            confianceProfil: confidence.score,
            explorationLevel,
            minMatchScore,
            mediaType,
          },
          sql50: candidates.map(toDebugRow), // renommé sql100 en pratique
          top20: llmPool.length > 0 ? llmPool.map(toDebugRow) : candidates.slice(0, llmPoolSize).map(toDebugRow),
          tmdbEnrichment: tmdbDiag,
          fallbackTrace,
          llmSelections: llmSelections.map((s: any) => ({
            id: s.tmdb_id,
            title: candidates.find((c: any) => Number(c.tmdb_id) === Number(s.tmdb_id))?.title || "?",
            matchScore: s.matchScore,
            reason: s.reason,
          })),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("surprise-personalized error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
