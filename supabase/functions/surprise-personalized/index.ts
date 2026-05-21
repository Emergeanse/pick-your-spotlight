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
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
}

async function safeFetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      tasteProfile, userTasteVector,
      platformIds, excludeIds, excludedPlatformIds, excludedGenres,
      minRating: rawMinRating, rejectionContext,
      explorationLevel: rawExplorationLevel, mediaType: rawMediaType,
      count: rawCount, maxDuration: rawMaxDuration,
      minMatchScore: rawMinMatchScore,
      likedMovies,
    } = await req.json();

    const requestedCount = Math.max(1, Math.min(typeof rawCount === "number" ? rawCount : 3, 10));
    const minRating = typeof rawMinRating === "number" ? Math.min(rawMinRating, 8) : 0;
    const explorationLevel = typeof rawExplorationLevel === "number" ? Math.max(0, Math.min(10, rawExplorationLevel)) : 5;
    const mediaType: "movie" | "tv" | "both" = rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";
    const minMatchScore = typeof rawMinMatchScore === "number" ? Math.max(0, Math.min(100, rawMinMatchScore)) : 60;
    const maxDuration = typeof rawMaxDuration === "number" && rawMaxDuration > 0 ? rawMaxDuration : null;
    const searchType: "movie" | "tv" = mediaType === "both" ? (Math.random() < 0.5 ? "movie" : "tv") : mediaType;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Normalize excluded IDs ──
    const normalizedExcludeIds = [...new Set([
      ...(likedMovies || []).map((m: any) => Number(m.tmdb_id || m.id)).filter(Number.isFinite),
      ...((excludeIds || []).map((id: any) => Number(id)).filter(Number.isFinite)),
      ...(tasteProfile?.excludeIds || []).map((id: any) => Number(id)).filter(Number.isFinite),
    ])];
    const excludedSet = new Set(normalizedExcludeIds);

    // ── Profile summary ──
    const topGenres = tasteProfile?.topGenres || [];
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const rejectedClusters = tasteProfile?.rejectedClusters || [];
    const confidence = tasteProfile?.confidence || { score: 50 };
    const stats = tasteProfile?.stats || {};
    const likedTitles = (likedMovies || []).slice(0, 15).map((m: any) => m.title).filter(Boolean);
    const fatigueState = tasteProfile?.fatigueState || {};
    const fatiguedGenres = Object.entries(fatigueState)
      .filter(([k, v]) => k.startsWith("genre_") && (v as number) >= 3)
      .map(([k]) => k.replace("genre_", ""));

    // Genre ID map for discover fallback
    const genreNameToId: Record<string, number> = {
      "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
      "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
      "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
      "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
    };
    const excludedGenreIds = new Set((excludedGenres || []).map((g: string) => genreNameToId[g]).filter(Boolean));

    const isMovieAllowed = (movie: any): boolean => {
      if (excludedSet.has(movie.id)) return false;
      if (minRating > 0 && (movie.vote_average || 0) > 0 && (movie.vote_average || 0) < minRating) return false;
      if (excludedGenreIds.size > 0 && movie.genre_ids?.some((gid: number) => excludedGenreIds.has(gid))) return false;
      return true;
    };

    const fireEmbedding = (m: any) => {
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ tmdbId: m.id, title: m.title || m.name, overview: m.overview, genres: (m.genres || []).map((g: any) => g.name) }),
        }).catch(() => {});
      }
    };

    // ── ÉTAPE 1 : SQL — top 30 par similarité vectorielle ──
    let candidates: any[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userTasteVector) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase.rpc("match_movies_for_recommendation", {
          query_vector: `[${userTasteVector.join(",")}]`,
          match_count: 30,
          exclude_ids: normalizedExcludeIds,
          filter_media_type: mediaType === "both" ? null : searchType,
        });
        if (data) {
          candidates = data.filter((c: any) =>
            (excludedGenres || []).every((eg: string) => !(c.genres || []).includes(eg)) &&
            (minRating === 0 || c.vote_average === 0 || !c.vote_average || c.vote_average >= minRating)
          );
        }
      } catch (e) {
        console.error("SQL vector search failed:", e);
      }
    }

    // ── ÉTAPE 2 : LLM — sélection + scoring + textes complets ──
    let llmSelections: any[] = [];
    const targetLLMCount = Math.min(requestedCount * 2, 8); // buffer : demande 2x, garde requestedCount

    if (candidates.length >= 3) {
      const candidateList = candidates
        .map((c, i) => `[${i + 1}] id=${c.tmdb_id} | "${c.title}" (${c.year || "?"}) | ${(c.genres || []).slice(0, 3).join(", ")} | ⭐${c.vote_average > 0 ? c.vote_average.toFixed(1) : "?"}/10`)
        .join("\n");

      const rejectionNote = rejectionContext
        ? `\nDERNIER FILM REFUSÉ : "${rejectionContext.rejectedTitle}" — Ne propose rien de similaire.`
        : "";

      const explorationNote = explorationLevel >= 7
        ? "MODE DÉCOUVERTE : Privilégie des pépites moins connues ou des genres adjacents."
        : explorationLevel <= 2
        ? "MODE PRÉCISION : Reste très proche des genres et clusters favoris."
        : "";

      const systemPrompt = `Tu es Pick, moteur de recommandation cinéphile. Sélectionne les meilleurs films depuis une liste pré-validée et génère leurs fiches.

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

MÉTHODE DE SCORING (matchScore) :
- Point de départ : 75%
- HAUSSE (+5 à +15pts) : genre favori, film bien noté (8+), cluster adoré, profil bien développé
- BAISSE (-5 à -10pts) : cluster rejeté, genre en fatigue, film peu noté (<6)
- PLANCHER ABSOLU : ${minMatchScore}% — ces films sont déjà pré-validés mathématiquement
- Cohérence obligatoire : si le texte est positif, le score doit être ≥ 68%

TON : Ami cinéphile enthousiaste. TOUJOURS positif. Jamais "malgré", "cependant", "par contre", "même si".

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans backticks) :
{
  "selections": [
    {
      "tmdb_id": <id exact de la liste ci-dessus>,
      "matchScore": <${minMatchScore}-99>,
      "headline": "<accroche enthousiaste, 8 mots max>",
      "whyItMatches": "<1 phrase positive, tutoiement, ce qui va plaire>",
      "detailedExplanation": "<2-3 phrases positives reliant le film au profil>",
      "perfectFor": "<1 phrase ex: Parfait pour une soirée...>",
      "funFact": "<1 anecdote courte et intéressante sur le film ou sa réalisation>",
      "matchingReasons": ["<2-4 mots>", "<2-4 mots>", "<2-4 mots>"]
    }
  ]
}`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            max_tokens: 3000,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Sélectionne ${targetLLMCount} films et génère leurs fiches.` },
            ],
          }),
        });

        if (response.ok) {
          const raw = await response.text();
          const aiData = JSON.parse(raw);
          const content = aiData?.choices?.[0]?.message?.content || "";
          const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed.selections && Array.isArray(parsed.selections)) {
            // Validate: tmdb_id must be in our candidate list, score must meet floor
            const validIds = new Set(candidates.map((c: any) => c.tmdb_id));
            llmSelections = parsed.selections.filter((s: any) =>
              s.tmdb_id && validIds.has(s.tmdb_id) && (s.matchScore || 0) >= minMatchScore
            );
          }
        }
      } catch (e) {
        console.error("LLM selection failed:", e);
      }
    }

    // ── ÉTAPE 3 : TMDB — enrichissement en batch pour les films sélectionnés ──
    const movies: any[] = [];
    const usedIds = new Set<number>();

    if (llmSelections.length > 0) {
      const tmdbResults = await Promise.all(
        llmSelections.slice(0, requestedCount + 3).map(async (sel: any) => {
          const detail = await getMovieDetails(sel.tmdb_id, searchType);
          if (!detail || !isMovieAllowed(detail) || usedIds.has(detail.id)) return null;
          if (maxDuration && searchType === "movie" && (detail.runtime || 0) > maxDuration) return null;
          return { detail, sel };
        })
      );

      for (const r of tmdbResults) {
        if (!r || movies.length >= requestedCount) continue;
        usedIds.add(r.detail.id);
        movies.push({
          movie: r.detail,
          reason: r.sel.whyItMatches || "Ce film correspond à tes goûts.",
          confidence: r.sel.matchScore || 75,
          recommendationTexts: {
            matchScore: r.sel.matchScore || 75,
            score: r.sel.matchScore || 75,
            headline: r.sel.headline || null,
            whyItMatches: r.sel.whyItMatches || null,
            detailedExplanation: r.sel.detailedExplanation || null,
            perfectFor: r.sel.perfectFor || null,
            funFact: r.sel.funFact || null,
            matchingReasons: r.sel.matchingReasons || [],
          },
        });
      }
    }

    // ── ÉTAPE 4 : Fallback discover si pas assez de résultats ──
    if (movies.length < requestedCount) {
      const needed = requestedCount - movies.length;
      for (let attempt = 0; attempt < needed * 6 && movies.length < requestedCount; attempt++) {
        const params = new URLSearchParams({
          api_key: TMDB_API_KEY, language: "fr-FR", sort_by: "popularity.desc",
          "vote_count.gte": attempt < 3 ? "100" : "20",
          page: String(Math.floor(Math.random() * 10) + 1),
        });
        if (minRating > 0 && attempt < 4) params.set("vote_average.gte", String(minRating));
        if (maxDuration && searchType === "movie") params.set("with_runtime.lte", String(maxDuration));
        if (excludedGenreIds.size > 0 && attempt < 4) params.set("without_genres", [...excludedGenreIds].join(","));
        if (topGenres.length > 0 && explorationLevel < 7 && attempt < 3) {
          const gids = topGenres.map((g: string) => genreNameToId[g]).filter(Boolean).slice(0, 3);
          if (gids.length > 0) params.set("with_genres", gids.join("|"));
        }
        if (platformIds?.length > 0 && attempt < 4) {
          params.set("with_watch_providers", platformIds.join("|"));
          params.set("watch_region", "FR");
        }
        const data = await safeFetchJson(`https://api.themoviedb.org/3/discover/${searchType}?${params}`);
        const found = (data?.results || []).find((r: any) => isMovieAllowed(r) && !usedIds.has(r.id));
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

    // Ultimate fallback: trending
    if (movies.length === 0) {
      for (const url of [
        `https://api.themoviedb.org/3/trending/${searchType}/week?api_key=${TMDB_API_KEY}&language=fr-FR`,
        `https://api.themoviedb.org/3/${searchType}/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`,
      ]) {
        if (movies.length > 0) break;
        const data = await safeFetchJson(url);
        const found = (data?.results || []).find((r: any) => !excludedSet.has(r.id));
        if (!found) continue;
        const detail = await getMovieDetails(found.id, searchType);
        if (detail) {
          movies.push({ movie: detail, reason: "Tendance du moment.", confidence: minMatchScore, recommendationTexts: null });
        }
      }
    }

    return new Response(JSON.stringify({
      movies,
      movie: movies[0]?.movie || null,
      reason: movies[0]?.reason || "",
      confidence: movies[0]?.confidence || minMatchScore,
      engineMeta: {
        profileConfidence: confidence.score,
        mode: llmSelections.length > 0 ? "retrieve-rerank" : "discover-fallback",
        candidatesFound: candidates.length,
        llmSelected: llmSelections.length,
        finalCount: movies.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("surprise-personalized error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
