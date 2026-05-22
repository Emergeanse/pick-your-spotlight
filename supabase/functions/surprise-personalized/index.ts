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
    const data = await res.json();
    const fr = data?.results?.FR;
    if (!fr) return [];
    return [...(fr.flatrate || []), ...(fr.free || []), ...(fr.ads || [])].map((p: any) => Number(p.provider_id));
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
    } = await req.json();

    const requestedCount = Math.max(1, Math.min(typeof rawCount === "number" ? rawCount : 3, 20));
    const minRating = typeof rawMinRating === "number" ? Math.min(rawMinRating, 8) : 0;
    const explorationLevel =
      typeof rawExplorationLevel === "number" ? Math.max(0, Math.min(10, rawExplorationLevel)) : 5;
    const mediaType: "movie" | "tv" | "both" =
      rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";
    const minMatchScore = typeof rawMinMatchScore === "number" ? Math.max(0, Math.min(100, rawMinMatchScore)) : 60;
    const maxDuration = typeof rawMaxDuration === "number" && rawMaxDuration > 0 ? rawMaxDuration : null;
    const searchType: "movie" | "tv" = mediaType === "both" ? (Math.random() < 0.5 ? "movie" : "tv") : mediaType;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const hardExcludedFormats = ["Reality", "Soap", "Talk", "News", "Téléfilm", "Horreur"];
    const autoExcluded = hardExcludedFormats.filter((g) => !likedWithTv.includes(g));
    const effectiveExcludedGenres = [...new Set([...(excludedGenres || []), ...autoExcluded])];

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
          }),
        }).catch(() => {});
      }
    };

    // ── ÉTAPE 1 : SQL — top 50 par similarité vectorielle ──
    let candidates: any[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userTasteVector) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data, error: rpcError } = await supabase.rpc("match_movies_for_recommendation", {
          query_vector: `[${userTasteVector.join(",")}]`,
          match_count: 100,
          exclude_ids: normalizedExcludeIds,
          filter_media_type: mediaType === "both" ? null : searchType,
          min_rating: minRating,
          excluded_genres: effectiveExcludedGenres,
          liked_genres: likedWithTv,
          max_duration: maxDuration ?? null,
          p_user_id: userId ?? null,
        });
        if (rpcError) console.error("SQL RPC error:", rpcError);
        if (data) candidates = data as any[];
        console.log(
          `[SP] SQL candidates: ${candidates.length} | liked: [${likedWithTv.slice(0, 4).join(", ")}...] | excluded: ${effectiveExcludedGenres.length} genres | excludeIds: ${normalizedExcludeIds.length}`,
        );
      } catch (e) {
        console.error("SQL vector search failed:", e);
      }
    } else {
      console.log(`[SP] SQL skipped — userTasteVector: ${!!userTasteVector}, SUPABASE_URL: ${!!SUPABASE_URL}`);
    }

    // ── ÉTAPE 2 : LLM — sélection + scoring ──
    let llmSelections: any[] = [];
    let llmFilteredAll = false;
    const llmPoolSize = 20;
    let llmPool: any[] = [];

    if (candidates.length >= 1) {
      // ── ÉTAPE 1.5 : Pré-filtrage plateforme sur l'ensemble des 50 candidats SQL ──
      // On cherche jusqu'à llmPoolSize films sur les plateformes de l'utilisateur
      // parmi TOUS les candidats SQL (pas seulement le top-20).
      let topPool = candidates.slice(0, llmPoolSize);
      if (platformIds?.length > 0) {
        console.log(`[SP] Pré-filtre plateforme: vérification de ${candidates.length} candidats sur plateformes [${platformIds.join(",")}]`);
        const allChecks = await Promise.all(
          candidates.map(async (c: any) => {
            const itemType: "movie" | "tv" = c.media_type === "tv" ? "tv" : "movie";
            const available = await getProviderIdsFR(Number(c.tmdb_id), itemType);
            const ok = available.some((pid: number) => platformIds.includes(pid));
            console.log(`[SP]   ${ok ? "✓" : "✗"} ${c.title} (id=${c.tmdb_id}) — providers FR: [${available.join(",")}]`);
            return ok ? c : null;
          }),
        );
        const filtered = (allChecks.filter(Boolean) as any[]).slice(0, llmPoolSize);
        console.log(`[SP] Pré-filtre plateforme: ${filtered.length}/${candidates.length} films sur plateformes`);
        if (filtered.length === 0) console.log(`[SP] ⚠️ Aucun film sur plateformes — pool non filtré utilisé`);
        topPool = filtered.length > 0 ? filtered : candidates.slice(0, llmPoolSize);
      }
      llmPool = topPool;
      const targetLLMCount = topPool.length;

      const candidateList = topPool
        .map(
          (c: any, i: number) =>
            `[${i + 1}] id=${c.tmdb_id} | "${c.title}" (${c.year || "?"}) | ${(c.genres || []).slice(0, 3).join(", ")} | ⭐${c.vote_average > 0 ? c.vote_average.toFixed(1) : "?"}/10`,
        )
        .join("\n");

      console.log(
        `[SP] Top ${topPool.length} envoyés au LLM (sur ${candidates.length} candidats SQL):\n${candidateList}`,
      );

      const rejectionNote = rejectionContext
        ? `\nDERNIER FILM REFUSÉ : "${rejectionContext.rejectedTitle}" — Ne propose rien de similaire.`
        : "";

      const explorationNote =
        explorationLevel >= 7
          ? "MODE DÉCOUVERTE : Privilégie des pépites moins connues ou des genres adjacents."
          : explorationLevel <= 2
            ? "MODE PRÉCISION : Reste très proche des genres et clusters favoris."
            : "";

      const systemPrompt = `Tu es Pick, moteur de recommandation cinéphile. Sélectionne les meilleurs films depuis une liste pré-validée.

PROFIL UTILISATEUR :
- Genres préférés : ${topGenres.slice(0, 6).join(", ") || "non déterminés"}
- Clusters favoris : ${tasteClusters.slice(0, 5).join(", ") || "non déterminés"}
${rejectedClusters.length > 0 ? `- ⛔ Clusters rejetés : ${rejectedClusters.join(", ")}` : ""}
- Films aimés : ${likedTitles.join(", ") || "aucun encore"}
- Confiance profil : ${confidence.score}/100
${fatiguedGenres.length > 0 ? `- Genres en fatigue : ${fatiguedGenres.join(", ")}` : ""}
${excludedGenres?.length > 0 ? `- ⛔ GENRES EXCLUS (absolu) : ${excludedGenres.join(", ")}` : ""}
${rejectionNote}
${explorationNote}

FILMS DISPONIBLES — pré-validés mathématiquement par similarité vectorielle :
${candidateList}

MISSION : Sélectionne EXACTEMENT ${targetLLMCount} films parmi cette liste.

RÈGLES DE SÉLECTION :
- Diversifie les genres entre les sélections
- Priorise les films bien notés (⭐7+) si le profil matche
- Évite 2 films de la même franchise ou très similaires
- Respecte absolument les genres exclus et clusters rejetés

SCORING (matchScore) :
- Base : 75%. Hausse si genre favori / note 8+. Baisse si cluster rejeté / note <6.
- Donne uniquement des scores honnêtes — un film moyen doit avoir un score moyen.

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans backticks) :
{
  "selections": [
    {
      "tmdb_id": <id exact de la liste ci-dessus>,
      "matchScore": <50-99>,
      "reason": "<1 phrase pourquoi ce film correspond au profil>"
    }
  ]
}`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            max_tokens: 2500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Sélectionne ${targetLLMCount} films.` },
            ],
          }),
        });

        if (response.ok) {
          const raw = await response.text();
          const aiData = JSON.parse(raw);
          const content = aiData?.choices?.[0]?.message?.content || "";
          const jsonStr = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed.selections && Array.isArray(parsed.selections)) {
            const validIds = new Set(topPool.map((c: any) => Number(c.tmdb_id)));
            const idValid = parsed.selections.filter((s: any) => s.tmdb_id && validIds.has(Number(s.tmdb_id)));
            llmSelections = idValid.map((s: any) => ({ ...s, tmdb_id: Number(s.tmdb_id) }));
            console.log(
              `[SP] LLM raw selections: ${parsed.selections.length}, valid: ${llmSelections.length}, minMatchScore (used by movie-match): ${minMatchScore}`,
            );
          }
        } else {
          console.error(`[SP] LLM gateway error: ${response.status}`);
        }
      } catch (e) {
        console.error("LLM selection failed:", e);
      }
    } else {
      console.log(`[SP] LLM skipped — not enough candidates: ${candidates.length}`);
    }

    // ── ÉTAPE 3 : TMDB — enrichissement en batch ──
    const movies: any[] = [];
    const usedIds = new Set<number>();
    const tmdbDiag: { id: number; title: string; type: string; ok: boolean; reason?: string }[] = [];

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
          if (platformIds?.length > 0) {
            const available = await getProviderIdsFR(sel.tmdb_id, itemType);
            const onPlatform = available.some((pid: number) => platformIds.includes(pid));
            if (!onPlatform) {
              tmdbDiag.push({
                id: sel.tmdb_id,
                title: candidate?.title || "?",
                type: itemType,
                ok: false,
                reason: "hors plateformes",
              });
              return null;
            }
          }
          tmdbDiag.push({ id: sel.tmdb_id, title: candidate?.title || "?", type: itemType, ok: true });
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

    // ── ÉTAPE 4 : Fallback ──
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
        if (maxDuration && searchType === "movie") params.set("with_runtime.lte", String(maxDuration));
        if (excludedGenreIds.size > 0) params.set("without_genres", [...excludedGenreIds].join(","));
        if (likedGenreIds.size > 0) params.set("with_genres", [...likedGenreIds].join("|"));
        if (platformIds?.length > 0 && attempt < 2) {
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
        fireEmbedding(detail);
        movies.push({
          movie: detail,
          reason: "Ce film correspond à tes genres préférés.",
          confidence: minMatchScore,
          recommendationTexts: null,
        });
      }
    }

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
        fireEmbedding(detail);
        movies.push({
          movie: detail,
          reason: "Tendance du moment.",
          confidence: minMatchScore,
          recommendationTexts: null,
        });
      }
    }

    // Garde au maximum le nombre souhaité par l'utilisateur
    const finalMovies = movies.slice(0, requestedCount);

    console.log(
      `[SP] Final: ${finalMovies.length}/${movies.length} movies kept (requested ${requestedCount}), mode: ${llmSelections.length > 0 ? "retrieve-rerank" : "fallback"}`,
    );

    const toDebugRow = (c: any) => ({
      id: c.tmdb_id,
      title: c.title,
      year: c.year || "?",
      note: c.vote_average > 0 ? Math.round(c.vote_average * 10) / 10 : null,
      sim: c.similarity != null ? Math.round(c.similarity * 1000) / 10 : null,
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
          finalCount: finalMovies.length,
          noSQLCandidates: candidates.length === 0,
          llmFilteredAll,
          filtersRelaxed: llmFilteredAll || (candidates.length === 0 && minRating > 0),
        },
        debugData: {
          filters: {
            excludeCount: normalizedExcludeIds.length,
            minRating,
            maxDuration: maxDuration ?? null,
            likedGenres: likedWithTv,
            effectiveExcludedGenres,
          },
          sql50: candidates.map(toDebugRow), // renommé sql100 en pratique
          top20: llmPool.length > 0 ? llmPool.map(toDebugRow) : candidates.slice(0, llmPoolSize).map(toDebugRow),
          tmdbEnrichment: tmdbDiag,
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
