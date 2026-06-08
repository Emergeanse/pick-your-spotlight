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
    console.log("[SP] ✅ version 2026-06-03-v8 — mood boost dans fallback discover");
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
        // JWT uses base64URL (- and _ instead of + and /). atob only accepts
        // standard base64, so convert before decoding.
        const b64url = jwt.split(".")[1];
        const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "==".slice(0, (4 - b64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
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
            mediaType: m.media_type === "tv" ? "tv" : "movie",
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
    // Langue, décennie et exclusions d'origine filtrées en SQL.
    // Le filtre plateforme est fait APRÈS le LLM (sur 10-50 films, pas 200).
    // Avec un historique dense (1800+ films), il faut chercher plus loin dans la similarité.
    const sqlMatchCount = 300;
    // Familles de plateformes : un abonnement inclut plusieurs IDs TMDB distincts
    // IDs sourcés depuis platforms.ts (source de vérité côté app)
    const PLATFORM_FAMILIES: Record<number, number[]> = {
      381: [381, 538, 685, 193, 1754, 2285], // Canal+ → Cinéma, Séries, Box Office, myCanal, Cine+
      119: [119, 1024, 10, 2100],            // Amazon Prime → variants + channel Amazon (2100)
      8:   [8, 1796],                          // Netflix → variants
      337: [337],                              // Disney+
      56:  [56, 531, 582, 2303],               // Paramount+ → variants FR
      236: [236, 531, 582, 2303],              // Paramount+ (ID app) → même famille
      1899: [1899, 1825],                      // Max → Max FR
      384: [384, 1899, 1825],                  // HBO (ID app) → Max/Max FR
      35:  [35],                               // Rakuten TV
      234: [234],                              // Arte
      11:  [11],                               // MUBI
      1967: [1967],                            // Molotov TV
      350: [350],                              // Apple TV+
      147: [147],                              // M6+
      415: [415],                              // ADN
      310: [310],                              // LaCinetek
      513: [513],                              // Shadowz
      300: [300],                              // Pluto TV
      2601: [2601],                            // Pathé Home
      193: [193],                              // SFR Play
    };
    const expandedPlatformIds = platformIds?.length > 0
      ? [...new Set((platformIds as number[]).flatMap((id: number) => PLATFORM_FAMILIES[id] ?? [id]))]
      : null;

    const buildRpcParams = (opts: { withLang: boolean; withYear: boolean; withPlatform: boolean }) => ({
      query_vector: `[${userTasteVector.join(",")}]`,
      match_count: sqlMatchCount,
      exclude_ids: normalizedExcludeIds,
      filter_media_type: effectiveFilterMediaType,
      min_rating: minRating > 0 ? minRating : 6,
      excluded_genres: effectiveExcludedGenres,
      liked_genres: effectiveLikedGenresSQL ?? likedGenresForSQL,
      max_duration: effectiveMaxDuration ?? null,
      p_user_id: null, // exclude_ids + usedIds suffisent — p_user_id réduit trop le pool
      p_original_language: opts.withLang ? (voiceOriginalLanguage ?? null) : null,
      p_min_year: opts.withYear ? (voiceDecade ?? null) : null,
      p_max_year: opts.withYear ? (voiceDecade != null ? voiceDecade + 9 : null) : null,
      p_excluded_languages: effectiveExcludedLangsArr,
      p_excluded_clusters: rejectedClusters.length > 0 ? rejectedClusters : [],
      p_min_popularity: 8,
      p_platform_ids: opts.withPlatform ? (expandedPlatformIds ?? null) : null,
    });

    // ── ÉTAPE 1 : Génération du pool SQL — 30 films non-interagis sur plateformes ──
    //
    // Principe : exclude_ids (historique complet) n'est JAMAIS tronqué.
    // On boucle par tranches de 300 films en escaladant progressivement les
    // contraintes de GOÛT jusqu'à obtenir 30 films non-interagis sur plateforme.
    //
    // Niveaux de contraintes (escalade si non atteint) :
    //   0 — tout : lang + année + liked_genres + excluded_genres + note + plateforme
    //   1 — sans lang/année
    //   2 — sans liked_genres
    //   3 — sans excluded_genres ni note min
    //   4 — sans plateforme (dernier recours)

    let candidates: any[] = [];
    let platformCandidatesCount = -1;
    let platformFallbackTriggered = false;
    let finalCascadeLevel = -1;
    let finalRpcParamsSummary: Record<string, any> | null = null;
    const sqlCountDiag: { level: number; total_in_db: number; available_after_exclusions: number }[] = [];

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userTasteVector) {
      const TARGET = 30;
      const BATCH = 500;
      const excludedSet = new Set(normalizedExcludeIds);
      const seenIds = new Set<number>();

      const countNonInteracted = (cands: any[]) =>
        cands.filter((c: any) => !excludedSet.has(Number(c.tmdb_id))).length;

      const addBatch = (batch: any[]) => {
        const fresh = batch.filter((c: any) => !seenIds.has(Number(c.tmdb_id)));
        fresh.forEach((c: any) => seenIds.add(Number(c.tmdb_id)));
        candidates = [...candidates, ...fresh];
      };

      // Niveaux d'escalade des contraintes de goût (exclude_ids TOUJOURS complet)
      const levels = [
        // niveau 0 : toutes contraintes, avec voix si présentes
        (extra: any) => ({ ...buildRpcParams({ withLang: true, withYear: true, withPlatform: true }), ...extra }),
        // niveau 1 : sans lang/année
        (extra: any) => ({ ...buildRpcParams({ withLang: false, withYear: false, withPlatform: true }), ...extra }),
        // niveau 2 : sans liked_genres
        (extra: any) => ({ ...buildRpcParams({ withLang: false, withYear: false, withPlatform: true }), liked_genres: [], ...extra }),
        // niveau 3 : sans goût restrictif
        (extra: any) => ({ ...buildRpcParams({ withLang: false, withYear: false, withPlatform: true }), liked_genres: [], excluded_genres: [], min_rating: 0, p_min_popularity: null, ...extra }),
        // niveau 4 : sans plateforme (dernier recours absolu)
        (extra: any) => ({ ...buildRpcParams({ withLang: false, withYear: false, withPlatform: false }), liked_genres: [], excluded_genres: [], min_rating: 0, p_min_popularity: null, ...extra }),
      ];

      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        for (let level = 0; level < levels.length && countNonInteracted(candidates) < TARGET; level++) {
          if (level >= 1) platformFallbackTriggered = true;
          if (level === 4) console.log(`[SP] FALLBACK ABSOLU — sans plateforme`);

          // COUNT avant requête : combien de films correspondent aux filtres de ce niveau
          try {
            const countParams = levels[level]({ match_count: 1, exclude_ids: normalizedExcludeIds });
            const { data: countData } = await sb.rpc("count_movie_candidates", {
              filter_media_type: countParams.filter_media_type ?? null,
              min_rating: countParams.min_rating ?? 0,
              excluded_genres: countParams.excluded_genres ?? [],
              liked_genres: countParams.liked_genres ?? [],
              max_duration: countParams.max_duration ?? null,
              p_excluded_languages: countParams.p_excluded_languages ?? [],
              p_min_popularity: countParams.p_min_popularity ?? null,
              p_platform_ids: countParams.p_platform_ids ?? null,
              exclude_ids: normalizedExcludeIds,
            });
            if (countData?.[0]) {
              const total = Number((countData as any[])[0].total_in_db);
              const available = Number((countData as any[])[0].available_after_exclusions);
              sqlCountDiag.push({ level, total_in_db: total, available_after_exclusions: available });
              console.log(`[SP] COUNT niveau ${level}: ${total} films en base, ${available} disponibles après ${normalizedExcludeIds.length} exclusions`);
            }
          } catch (e) {
            console.warn(`[SP] count_movie_candidates level=${level} failed:`, e);
          }

          // Boucle d'expansion : relance jusqu'à trouver TARGET non-interagis à ce niveau
          let round = 0;
          const MAX_ROUNDS_PER_LEVEL = 5;

          while (countNonInteracted(candidates) < TARGET && round < MAX_ROUNDS_PER_LEVEL) {
            const expandExcludeIds = [...normalizedExcludeIds, ...seenIds];
            const params = levels[level]({ match_count: BATCH, exclude_ids: expandExcludeIds });
            finalCascadeLevel = level;
            finalRpcParamsSummary = {
              level,
              filter_media_type: params.filter_media_type ?? null,
              min_rating: params.min_rating ?? 0,
              excluded_genres: params.excluded_genres ?? [],
              liked_genres: params.liked_genres ?? [],
              max_duration: params.max_duration ?? null,
              p_excluded_languages: params.p_excluded_languages ?? [],
              p_min_popularity: params.p_min_popularity ?? null,
              p_platform_ids: params.p_platform_ids ?? null,
              exclude_ids_count: expandExcludeIds.length,
            };
            const { data, error } = await sb.rpc("match_movies_for_recommendation", params);
            if (error) { console.error(`[SP] SQL error level=${level} round=${round}:`, error); break; }
            if (!data || (data as any[]).length === 0) break;
            const before = countNonInteracted(candidates);
            addBatch(data as any[]);
            const gained = countNonInteracted(candidates) - before;
            console.log(`[SP] Level=${level} Round=${round}: +${(data as any[]).length} bruts, +${gained} non-interagis → total non-interagis: ${countNonInteracted(candidates)}/${TARGET}`);
            if (gained === 0) break; // Plus rien de nouveau à ce niveau
            round++;
          }
        }

        platformCandidatesCount = countNonInteracted(candidates);
        console.log(`[SP] Pool final: ${candidates.length} candidats, ${platformCandidatesCount} non-interagis | excludeIds: ${normalizedExcludeIds.length}`);

      } catch (e) {
        console.error("SQL vector search failed:", e);
      }
    } else {
      console.log(`[SP] SQL skipped — userTasteVector: ${!!userTasteVector}, SUPABASE_URL: ${!!SUPABASE_URL}`);
    }

    let filteredCandidates = candidates;

    const t1 = Date.now();
    console.log(`[SP⏱] SQL: ${t1 - t0}ms (${candidates.length} candidats)`);

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

    // ── ÉTAPE 2 : Filtre plateforme → LLM sur les films disponibles uniquement ──
    let llmSelections: any[] = [];
    let llmFilteredAll = false;
    const llmPoolSize = 30;
    let llmPool: any[] = [];
    let llmInputPool: any[] = [];
    let platformPool: { title: string; platforms: string[]; match: boolean }[] = [];
    let capturedSystemPrompt: string | null = null;
    let llmDebugError: string | null = null;
    let tPlatform = t2;


    const PROVIDER_NAMES: Record<number, string> = {
      8: "Netflix", 1796: "Netflix",
      119: "Amazon Prime", 1024: "Amazon Prime", 10: "Amazon Prime", 2100: "Amazon",
      337: "Disney+",
      381: "Canal+", 538: "Canal+ Cinéma", 685: "Canal+ Séries",
      193: "Canal+ Box Office", 1754: "myCanal", 2285: "Cine+",
      56: "Paramount+", 236: "Paramount+", 531: "Paramount+", 582: "Paramount+", 2303: "Paramount+",
      384: "Max", 1899: "Max", 1825: "Max",
      350: "Apple TV+",
      35: "Rakuten TV",
      234: "Arte",
      11: "MUBI",
      1967: "Molotov TV",
      147: "M6+",
      415: "ADN",
      310: "LaCinetek",
      513: "Shadowz",
      300: "Pluto TV",
      2601: "Pathé Home",
      193: "SFR Play",
      701: "OCS", 588: "OCS",
      2077: "Universciné",
      1968: "Canal+",
    };

    if (filteredCandidates.length >= 1) {
      const compositeScore = (c: any) => {
        let score = (c.similarity ?? 0) * 100 + (c.vote_average ?? 0);
        if (preferredLangsBoost.size > 0 && preferredLangsBoost.has(c.original_language || "")) score += 15;
        return score;
      };

      const originEligible = excludedLangsBoost.size > 0
        ? filteredCandidates.filter((c: any) => !excludedLangsBoost.has(c.original_language || ""))
        : filteredCandidates;
      if (excludedLangsBoost.size > 0) {
        const removed = filteredCandidates.length - originEligible.length;
        console.log(`[SP] Filtre origine: ${originEligible.length}/${filteredCandidates.length} films gardés (${removed} retirés — langues exclues: [${[...excludedLangsBoost].join(",")}])`);
      }
      const topPool = [...originEligible]
        .sort((a, b) => compositeScore(b) - compositeScore(a))
        .slice(0, llmPoolSize);
      llmPool = topPool;
      console.log(
        `[SP] Top ${topPool.length} après filtre origine:\n` +
        topPool.map((c: any, i: number) =>
          `  ${i + 1}. "${c.title || "?"}" (${c.year || "?"}) [${c.original_language || "?"}] ⭐${c.vote_average?.toFixed(1) ?? "?"} sim=${((c.similarity ?? 0) * 100).toFixed(1)}`
        ).join("\n")
      );

      // ── ÉTAPE 2.1 : Filtre plateforme déjà appliqué en SQL (p_platform_ids) ──
      // Les candidats retournés sont tous disponibles sur les plateformes de l'utilisateur.
      // Ce bloc conserve le debug platformPool et platformCandidatesCount.
      tPlatform = Date.now();
      platformPool = topPool.map((c: any) => ({
        title: c.title || "?",
        platforms: (c.platform_ids || []).map((id: number) => PROVIDER_NAMES[id] ?? `#${id}`),
        match: true,
      }));
      platformCandidatesCount = topPool.length;
      llmInputPool = topPool;
      if (expandedPlatformIds && expandedPlatformIds.length > 0) {
        const platformNames = (platformIds as number[]).map((id: number) => PROVIDER_NAMES[id] ?? `#${id}`).join(", ");
        console.log(`[SP] Filtre plateforme SQL: ${topPool.length} films sur [${platformNames}]`);
      }

      // ── ÉTAPE 2.2 : LLM — évalue uniquement les films disponibles ──
      if (llmInputPool.length >= 1) {
        const poolScores = llmInputPool.map((c: any) => ((c.similarity ?? 0) * 100 + (c.vote_average ?? 0)));
        const scoreMin = Math.min(...poolScores);
        const scoreMax = Math.max(...poolScores) || 1;
        const scoreRange = scoreMax - scoreMin || 1;

        const candidateList = llmInputPool
          .map((c: any, i: number) => {
            const typeFlag = c.media_type === "tv" ? "S" : "F";
            const safeTitle = (c.title || "").replace(/[^\x20-\x7EÀ-ɏЀ-ӿ]/g, "").trim();
            const note = c.vote_average > 0 ? c.vote_average.toFixed(1) : "?";
            return `${i + 1}.[${typeFlag}] "${safeTitle}" (${c.year || "?"}) ${(c.genres || []).slice(0, 2).join("/")} ★${note}`;
          })
          .join("\n");

        console.log(`[SP] ${llmInputPool.length} films envoyés au LLM (disponibles sur plateforme):\n${candidateList}`);

        const targetCount = Math.min(requestedCount + 2, llmInputPool.length);
        const rejectionNote = rejectionContext
          ? `\nDERNIER FILM REFUSÉ : "${rejectionContext.rejectedTitle}" — Ne propose rien de similaire.`
          : "";
        const explorationNote =
          explorationLevel >= 7
            ? "MODE DÉCOUVERTE : Privilégie des pépites moins connues ou des genres adjacents."
            : explorationLevel <= 2
              ? "MODE PRÉCISION : Reste très proche des genres et clusters favoris."
              : "";
        const originNote = [
          likedOrigins.length > 0 ? `- Origines préférées : ${likedOrigins.join(", ")}` : "",
          excludedOrigins.length > 0
            ? `- ⛔ ORIGINES À ÉVITER ABSOLUMENT : ${excludedOrigins.join(", ")} — n'inclus aucun film de ces origines.`
            : "",
        ].filter(Boolean).join("\n");
        const platformNote = expandedPlatformIds && expandedPlatformIds.length > 0
          ? `\n🎬 Ces films sont tous disponibles sur les plateformes de l'utilisateur (${(platformIds as number[]).map((id) => PROVIDER_NAMES[id] ?? `#${id}`).join(", ")}).\n`
          : "";

        const hardExcludedNote = effectiveExcludedGenres.length > 0
          ? `\n⛔ GENRES INTERDITS (élimination absolue) : ${effectiveExcludedGenres.join(", ")}\nÉlimine immédiatement tout film de la liste dont un genre correspond à cette liste — ne les propose pas, même s'ils semblent bien noter.\n`
          : "";

        const systemPrompt = `Tu es Pick, moteur de recommandation cinéphile. Sélectionne les meilleurs films depuis une liste pré-validée.
${moodContext ? `\n🎭 AMBIANCE CHOISIE : ${moodContext}\n` : ""}${platformNote}${hardExcludedNote}
PROFIL UTILISATEUR :
- Genres préférés : ${likedWithTv.join(", ") || "non déterminés"}
${moodBoostGenres ? `- 🎯 Genres prioritaires (ambiance) : ${moodBoostGenres.join(", ")}` : ""}
- Clusters favoris : ${tasteClusters.slice(0, 5).join(", ") || "non déterminés"}
- Films aimés : ${likedTitles.join(", ") || "aucun encore"}
- Confiance profil : ${confidence.score}/100
${fatiguedGenres.length > 0 ? `- Genres à éviter (fatigue) : ${fatiguedGenres.join(", ")}` : ""}
${originNote}
${rejectionNote}
${explorationNote}

FILMS DISPONIBLES — déjà filtrés par similarité vectorielle et disponibilité plateforme :
${candidateList}

MISSION : Sélectionne exactement ${targetCount} films/séries depuis cette liste — les ${targetCount} qui correspondent le mieux au profil, classés du meilleur au moins bon.

ÉTAPE 1 — FILTRE OBLIGATOIRE : Parcours chaque film de la liste et élimine définitivement tout film dont un genre figure dans les GENRES INTERDITS ci-dessus. Ces films ne peuvent pas être sélectionnés, quelle que soit leur note.

ÉTAPE 2 — SÉLECTION : Parmi les films restants, choisis les ${targetCount} meilleurs selon le profil.

RÈGLES DE SÉLECTION :
- Tu DOIS retourner exactement ${targetCount} entrées, pas moins. Classe-les du meilleur au moins bon.
- Format liste : N°.[F=Film/S=Série] "Titre" (année) genres ★note
- Diversifie les genres entre les sélections
- Priorise les films bien notés (⭐7+) si le profil matche
- Évite 2 films de la même franchise ou très similaires
- Les genres interdits et origines exclues sont des règles absolues — jamais d'exception

SCORING (matchScore) :
- Base : 75%. Hausse si genre favori / note 8+. Baisse si cluster rejeté / note <6.
- Donne des scores honnêtes reflétant le rang.
- Pas de seuil bloquant : classe les ${targetCount} meilleurs même si certains sont à 60%.

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans backticks) :
{
  "selections": [
    {
      "rank": <numéro N° de la liste, entre 1 et ${llmInputPool.length}>,
      "matchScore": <entier entre 60 et 99>,
      "reason": "<1 phrase pourquoi ce film correspond au profil>"
    }
  ]
}`;

        capturedSystemPrompt = systemPrompt;

        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
          const geminiBody = JSON.stringify({
            contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
            generationConfig: { maxOutputTokens: 500, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
          });
          const geminiHeaders = { "Content-Type": "application/json" };

          let response = await fetch(geminiUrl, { method: "POST", headers: geminiHeaders, body: geminiBody });
          if (response.status === 429 || response.status === 503) {
            await new Promise((r) => setTimeout(r, response.status === 503 ? 4000 : 3000));
            response = await fetch(geminiUrl, { method: "POST", headers: geminiHeaders, body: geminiBody });
          }

          if (response.ok) {
            const raw = await response.text();
            const aiData = JSON.parse(raw);
            const rawContent = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log(`[SP] LLM rawContent (first 400): ${rawContent.slice(0, 400)}`);

            const content = rawContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").replace(/```(?:json)?\s*/g, "").trim();
            const repair = (s: string) => s.replace(/^﻿/, "").replace(/\}\s*\n\s*\{/g, "},\n{").replace(/,\s*([}\]])/g, "$1");
            const hasSelections = (obj: any) => obj?.selections && Array.isArray(obj.selections) && obj.selections.length > 0;

            let parsed: any = null;
            for (const cand of [content, repair(content)]) {
              if (parsed) break;
              try { const obj = JSON.parse(cand); if (hasSelections(obj)) { parsed = obj; console.log("[SP] Strategy 0 succeeded"); } } catch {}
            }
            if (!parsed) {
              for (let i = 0; i < content.length && !parsed; i++) {
                if (content[i] !== "{") continue;
                let d = 0, end = i;
                for (let j = i; j < content.length; j++) {
                  if (content[j] === "{") d++; else if (content[j] === "}") { d--; if (d === 0) { end = j; break; } }
                }
                if (end === i) continue;
                try { const obj = JSON.parse(repair(content.slice(i, end + 1))); if (hasSelections(obj)) { parsed = obj; } } catch {}
                i = end;
              }
            }
            if (!parsed) {
              const sels: any[] = [];
              const re = /"rank"\s*:\s*(\d+)[^}]*?"matchScore"\s*:\s*(\d+)(?:[^}]*?"reason"\s*:\s*"([^"]*)")?/g;
              let m;
              while ((m = re.exec(content)) !== null) sels.push({ rank: Number(m[1]), matchScore: Number(m[2]), reason: m[3] || undefined });
              if (sels.length > 0) { parsed = { selections: sels }; console.log(`[SP] Strategy 2 (regex) extracted ${sels.length}`); }
            }

            if (!parsed) throw new Error(`No valid JSON in LLM response: ${rawContent.slice(0, 300)}`);

            if (parsed.selections && Array.isArray(parsed.selections)) {
              llmSelections = parsed.selections
                .map((s: any) => {
                  const rankIdx = s.rank != null ? Number(s.rank) : null;
                  // Les rangs réfèrent à llmInputPool (liste filtrée plateforme)
                  const candidate = (rankIdx != null && rankIdx >= 1 && rankIdx <= llmInputPool.length)
                    ? llmInputPool[rankIdx - 1]
                    : llmInputPool.find((c: any) => Number(c.tmdb_id) === Number(s.tmdb_id));
                  if (!candidate) return null;
                  return { tmdb_id: Number(candidate.tmdb_id), matchScore: s.matchScore || 75, reason: s.reason || null };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
              console.log(`[SP] LLM: ${parsed.selections.length} sélections → ${llmSelections.length} résolues`);
            }
          } else {
            const errBody = await response.text().catch(() => "");
            llmDebugError = `HTTP ${response.status}: ${errBody.slice(0, 300)}`;
            console.error(`[SP] LLM error: ${llmDebugError}`);
          }
        } catch (e) {
          llmDebugError = String(e);
          console.error("LLM selection failed:", e);
        }

        // Fallback : si le LLM échoue, prendre le top du pool filtré plateforme directement
        if (llmSelections.length === 0) {
          console.log(`[SP] LLM returned 0 — fallback déterministe sur pool plateforme`);
          llmSelections = llmInputPool
            .slice(0, targetCount)
            .map((c: any) => ({
              tmdb_id: Number(c.tmdb_id),
              matchScore: Math.round(72 + (((c.similarity ?? 0) * 100 + (c.vote_average ?? 0) - scoreMin) / scoreRange) * 20),
              reason: null,
            }));
        }
      }
    } else {
      console.log(`[SP] LLM skipped — candidats insuffisants: ${filteredCandidates.length}`);
    }

    const t3 = Date.now();
    console.log(`[SP⏱] Plateforme: ${tPlatform - t2}ms | LLM: ${t3 - tPlatform}ms → ${llmSelections.length} films sélectionnés`);

    // ── ÉTAPE 3 : TMDB — enrichissement en batch ──
    // Trier par score LLM décroissant : on enrichit les meilleurs en premier
    llmSelections.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));

    const movies: any[] = [];
    // usedIds bloque les films déjà interagis même si la cascade SQL a désactivé
    // p_user_id pour élargir le pool — filet de sécurité côté edge function.
    const usedIds = new Set<number>(normalizedExcludeIds);
    const tmdbDiag: { id: number; title: string; type: string; ok: boolean; reason?: string }[] = [];
    const fallbackTrace: { stage: string; id: number; title: string; type: string }[] = [];

    if (llmSelections.length > 0) {
      const tmdbResults = await Promise.all(
        llmSelections.map(async (sel: any) => {
          const candidate = candidates.find((c: any) => Number(c.tmdb_id) === Number(sel.tmdb_id));
          const rawType = candidate?.media_type;
          const itemType: "movie" | "tv" = rawType === "tv" ? "tv" : rawType === "movie" ? "movie" : searchType;
          let detail = await getMovieDetails(sel.tmdb_id, itemType);
          let resolvedType = itemType;
          // Si TMDB retourne null, réessayer avec l'autre type (media_type stocké peut être incorrect)
          if (!detail) {
            const fallbackType: "movie" | "tv" = itemType === "movie" ? "tv" : "movie";
            detail = await getMovieDetails(sel.tmdb_id, fallbackType);
            if (detail) {
              console.warn(`[SP] TMDB type mismatch id=${sel.tmdb_id}: stored=${itemType}, resolved=${fallbackType}`);
              resolvedType = fallbackType;
            }
          }
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
          // Normalise les séries TV : TMDB renvoie "name" au lieu de "title"
          if (resolvedType === "tv") {
            if (!detail.title && detail.name) detail.title = detail.name;
            if (!detail.original_title && detail.original_name) detail.original_title = detail.original_name;
            if (!detail.release_date && detail.first_air_date) detail.release_date = detail.first_air_date;
          }
          // Filtre plateforme déjà fait en SQL — pas de re-vérification TMDB ici.
          tmdbDiag.push({ id: sel.tmdb_id, title: detail.title || candidate?.title || "?", type: resolvedType, ok: true });
          return { detail, sel, resolvedType };
        }),
      );

      for (const r of tmdbResults) {
        if (!r) continue;
        if (usedIds.has(r.detail.id)) continue;
        usedIds.add(r.detail.id);
        const candidate = candidates.find((c: any) => Number(c.tmdb_id) === Number(r.sel.tmdb_id));
        movies.push({
          movie: { ...r.detail, platform_ids: candidate?.platform_ids ?? [] },
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
    // Genre IDs effectifs pour le fallback : voix prime sur profil, mood boost ajouté
    const moodBoostGenreIds = new Set((moodBoostGenres ?? []).map((g: string) => genreNameToId[g]).filter(Boolean));
    const effectiveLikedGenreIds = voiceGenres
      ? new Set(voiceGenres.map((g: string) => genreNameToId[g]).filter(Boolean))
      : new Set([...likedGenreIds, ...moodBoostGenreIds]);

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
          // Exclut location/achat — uniquement abonnement/gratuit/AVOD comme le filtre SQL
          params.set("with_watch_monetization_types", "flatrate|free|ads");
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

    // ── Filet de sécurité final : retire les films dont le genre principal ou la langue est exclu ──
    // Nécessaire car les fallbacks discover/trending ne passent pas par les filtres SQL
    const safeMovies = movies.filter((m: any) => {
      const movie = m.movie || m;
      const genres: string[] = (movie.genres || []).map((g: any) => g.name || g).filter(Boolean);
      const lang: string = movie.original_language || "";
      const primaryGenre: string = genres[0] || "";
      const genreOk = effectiveExcludedGenres.length === 0 || !effectiveExcludedGenres.includes(primaryGenre);
      const langOk  = effectiveExcludedLangsArr.length === 0 || !effectiveExcludedLangsArr.includes(lang);
      return genreOk && langOk;
    });
    const filteredCount = movies.length - safeMovies.length;
    if (filteredCount > 0) console.log(`[SP] Filet sécurité: ${filteredCount} film(s) éliminé(s) (genre/langue exclus)`);

    // Garde au maximum le nombre souhaité par l'utilisateur
    const finalMovies = (safeMovies.length >= Math.min(requestedCount, 1) ? safeMovies : movies).slice(0, requestedCount);

    const tFinal = Date.now();
    console.log(
      `[SP] Final: ${finalMovies.length}/${movies.length} movies kept (requested ${requestedCount}), mode: ${llmSelections.length > 0 ? "retrieve-rerank" : "fallback"}`,
    );
    console.log(`[SP⏱] TOTAL: ${tFinal - t0}ms | SQL: ${t1 - t0}ms | LangEnrich: ${t2 - t1}ms | LLM+Plateforme: ${t3 - t2}ms | TMDB: ${t4 - t3}ms | Fallback: ${tFinal - t4}ms`);

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

    const toSqlArray = (arr: any[], type: string) =>
      arr?.length
        ? `ARRAY[${arr.map((v: any) => typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v).join(", ")}]::${type}[]`
        : `ARRAY[]::${type}[]`;

    const sqlSnippet = finalRpcParamsSummary ? [
      `-- Appel RPC — niveau cascade ${finalRpcParamsSummary.level} — ${finalRpcParamsSummary.exclude_ids_count} IDs exclus`,
      `SELECT tmdb_id, title, genres, vote_average, year, media_type, similarity`,
      `FROM match_movies_for_recommendation(`,
      `  query_vector := '<coller votre vecteur 32-dim ici>',`,
      `  match_count := 50,`,
      `  exclude_ids := ARRAY[]::integer[],  -- ${finalRpcParamsSummary.exclude_ids_count} IDs (omis)`,
      `  filter_media_type := ${finalRpcParamsSummary.filter_media_type ? `'${finalRpcParamsSummary.filter_media_type}'` : "NULL"},`,
      `  min_rating := ${finalRpcParamsSummary.min_rating},`,
      `  excluded_genres := ${toSqlArray(finalRpcParamsSummary.excluded_genres, "text")},`,
      `  liked_genres := ${toSqlArray(finalRpcParamsSummary.liked_genres, "text")},`,
      `  max_duration := ${finalRpcParamsSummary.max_duration ?? "NULL"},`,
      `  p_excluded_languages := ${toSqlArray(finalRpcParamsSummary.p_excluded_languages, "text")},`,
      `  p_min_popularity := ${finalRpcParamsSummary.p_min_popularity ?? "NULL"},`,
      `  p_platform_ids := ${finalRpcParamsSummary.p_platform_ids?.length ? toSqlArray(finalRpcParamsSummary.p_platform_ids, "integer") : "NULL"}`,
      `)`,
      `ORDER BY similarity DESC`,
      `LIMIT 50;`,
    ].join("\n") : null;

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
          platformCandidatesCount,
          platformFallbackTriggered,
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
          sqlCascadeLevel: finalCascadeLevel,
          sqlRpcParams: finalRpcParamsSummary,
          sqlSnippet,
          sqlCountDiag,
          sql50: candidates.map(toDebugRow), // renommé sql100 en pratique
          top20: llmPool.length > 0 ? llmPool.map(toDebugRow) : candidates.slice(0, llmPoolSize).map(toDebugRow),
          llmFiltered: llmInputPool.map(toDebugRow),
          platformPool,
          platformFilterMs: tPlatform - t2,
          llmMs: t3 - tPlatform,
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
