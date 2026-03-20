import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function getMovieDetails(id: number, type: "movie" | "tv" = "movie"): Promise<any> {
  const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const res = await fetch(url);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { likedMovies, tasteProfile, userTasteVector, platformIds, excludeIds, excludedPlatformIds, excludedGenres, minRating: rawMinRating, rejectionContext, outOfComfortZone, explorationLevel: rawExplorationLevel, mediaType: rawMediaType, count: rawCount } = await req.json();
    const requestedCount = typeof rawCount === "number" && rawCount >= 1 && rawCount <= 10 ? rawCount : 1;
    // Cap min_rating at 8.0 to avoid overly restrictive filtering
    const minRating = typeof rawMinRating === "number" ? Math.min(rawMinRating, 8) : 0;
    const explorationLevel = typeof rawExplorationLevel === "number" ? Math.max(0, Math.min(10, rawExplorationLevel)) : 5;
    // mediaType: "movie" | "tv" | "both" — determines which TMDB endpoints to use
    const mediaType: "movie" | "tv" | "both" = rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";
    // For "both", randomly pick one to search this time (50/50)
    const searchType: "movie" | "tv" = mediaType === "both" ? (Math.random() < 0.5 ? "movie" : "tv") : mediaType;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const titles = (likedMovies || []).map((m: any) => m.title).slice(0, 20);
    const normalizedExcludeIds = [...new Set([
      ...(likedMovies || []).map((m: any) => Number(m.tmdb_id || m.id)).filter((id: number) => Number.isFinite(id)),
      ...((excludeIds || []).map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))),
      ...(tasteProfile?.excludeIds || []).map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id)),
    ])];
    const allGenres = (likedMovies || []).flatMap((m: any) => m.genres || []);
    const genreCounts: Record<string, number> = {};
    allGenres.forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([g]) => g);

    // ── Embedding-based candidates ──
    let embeddingCandidates: string[] = [];
    if (userTasteVector && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const allExcludeIds = normalizedExcludeIds;
        const vectorStr = `[${userTasteVector.join(",")}]`;
        
        const { data: matches } = await supabase.rpc("match_movies_by_taste", {
          query_vector: vectorStr,
          match_count: 10,
          exclude_ids: allExcludeIds,
        });

        if (matches && matches.length > 0) {
          // Adjust similarity threshold based on exploration level
          const similarityThreshold = explorationLevel <= 2 ? 0.85 : explorationLevel <= 5 ? 0.7 : explorationLevel <= 8 ? 0.5 : 0.3;
          embeddingCandidates = matches
            .filter((m: any) => m.similarity > similarityThreshold)
            .map((m: any) => `${m.title} (similarité: ${Math.round(m.similarity * 100)}%, tags: ${(m.taste_tags || []).join(", ")})`);
        }
      } catch (e) {
        console.error("Embedding search failed:", e);
      }
    }

    // ── Extract enriched profile data (from client-side getUserTasteProfile or fallbacks) ──
    const confidence = tasteProfile?.confidence || { score: 50, discoveryRatio: 0.2 };
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const skipPatterns = tasteProfile?.skipPatterns || {};
    const stats = tasteProfile?.stats || {};
    const session = tasteProfile?.session || {};
    const scoringWeights = tasteProfile?.scoringWeights || {};
    const acceptanceRate = stats.acceptanceRate || 0;

    // ── Skipped genres analysis (from taste trainer & other interactions) ──
    const skippedGenreInfo = skipPatterns?.skippedGenres || {};
    const heavilySkippedGenres = Object.entries(skippedGenreInfo)
      .filter(([, count]) => (count as number) >= 3)
      .map(([genre]) => genre);

    const shouldDiscover = explorationLevel >= 7 || Math.random() < confidence.discoveryRatio;
    const effectiveOutOfComfortZone = outOfComfortZone || explorationLevel >= 9;

    const explorationModeLabel = explorationLevel <= 2 ? "ULTRA-PRÉCISION" : explorationLevel <= 5 ? "ÉQUILIBRÉ" : explorationLevel <= 8 ? "DÉCOUVERTE" : "TERRE INCONNUE";
    const explorationInstruction = explorationLevel <= 2
      ? "MODE ULTRA-PRÉCISION : Colle exactement aux genres et micro-genres favoris. Privilégie les candidats embedding à très haute similarité (>85%). Ne prends aucun risque, l'utilisateur veut du confort total."
      : explorationLevel <= 5
        ? "MODE ÉQUILIBRÉ : Balance entre confort et découverte. Reste proche des goûts mais permets-toi des genres adjacents occasionnels."
        : explorationLevel <= 8
          ? "MODE DÉCOUVERTE : Propose des genres adjacents, des films sous-estimés, des pépites méconnues. L'utilisateur est ouvert à la surprise. Ose des recommandations moins évidentes."
          : "MODE TERRE INCONNUE : Le film recommandé DOIT être RADICALEMENT différent des habitudes de l'utilisateur. Choisis un genre qu'il ne regarde JAMAIS. Propose l'exact opposé de ses goûts habituels. Explique dans 'reason' pourquoi ce choix inattendu pourrait lui plaire. Commence par 'Changement radical :'.";

    const skipInsights = skipPatterns.avgSkipRate > 0.6
      ? "L'utilisateur skip souvent — sois plus sélectif et surprenant."
      : skipPatterns.recentSkipStreak > 3
        ? "L'utilisateur vient de skip plusieurs films d'affilée — change radicalement de direction."
        : "";

    const embeddingSection = embeddingCandidates.length > 0
      ? `\n\nFILMS SIMILAIRES PAR EMBEDDING (du plus proche au moins proche) :\n${embeddingCandidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}\nCes films ont été trouvés par similarité vectorielle avec le profil de goût. Tu peux en recommander un ou t'en inspirer pour trouver un film encore meilleur.`
      : "";

    const mediaTypeLabel = searchType === "tv" ? "une SÉRIE TV" : "un FILM";
    const systemPrompt = `Tu es un moteur de recommandation cinéma de niveau Netflix. Tu combines plusieurs signaux pour trouver ${mediaTypeLabel} parfait(e).

SYSTÈME DE SCORING (poids) :
- taste_match (${scoringWeights.taste_match || 0.30}) : correspondance avec les genres et micro-genres préférés
- embedding_match (${scoringWeights.embedding_match || 0.15}) : similarité vectorielle avec le profil de goût
- context_match (${scoringWeights.context_match || 0.25}) : correspond à l'humeur et au contexte de session actuel
- behaviour_match (${scoringWeights.behaviour_match || 0.10}) : cohérent avec les patterns de comportement
- rating_score (${scoringWeights.rating_score || 0.10}) : note du film (>6.5 minimum)
- availability (${scoringWeights.availability || 0.05}) : disponible sur les plateformes de l'utilisateur
- novelty (${scoringWeights.novelty || 0.05}) : film que l'utilisateur ne connaît probablement pas

PROFIL ENRICHI :
- Confiance du profil : ${confidence.score}/100 (${confidence.score < 40 ? "profil jeune, plus de découverte" : confidence.score > 70 ? "profil mature, haute précision" : "profil en développement"})
- Taux d'acceptation : ${acceptanceRate}%
- Micro-genres favoris : ${tasteClusters.join(", ") || "non déterminés"}
${skipInsights ? `- Insight skip : ${skipInsights}` : ""}
${session.mood ? `- Session actuelle : humeur "${session.mood}", contexte "${session.context || "?"}", temps "${session.time || "?"}"` : ""}
${platformIds && platformIds.length > 0 ? `- IMPORTANT : L'utilisateur a UNIQUEMENT accès aux plateformes de streaming suivantes (IDs TMDB: ${platformIds.join(", ")}). Le film recommandé DOIT être disponible sur l'une de ces plateformes en France.` : ""}
${excludedPlatformIds && excludedPlatformIds.length > 0 ? `- PLATEFORMES EXCLUES : NE JAMAIS recommander de films uniquement disponibles sur ces plateformes (IDs TMDB: ${excludedPlatformIds.join(", ")}).` : ""}
${excludedGenres && excludedGenres.length > 0 ? `- GENRES EXCLUS (profil) : NE JAMAIS recommander de films des genres suivants : ${excludedGenres.join(", ")}. C'est une règle ABSOLUE.` : ""}
${heavilySkippedGenres.length > 0 ? `- GENRES SOUVENT REFUSÉS (taste trainer) : L'utilisateur a refusé 3+ films de ces genres : ${heavilySkippedGenres.join(", ")}. Évite-les fortement sauf en mode découverte.` : ""}
${minRating && minRating > 0 ? `- NOTE MINIMALE : Le film DOIT avoir une note TMDB supérieure ou égale à ${minRating}/10. Ne recommande JAMAIS un film noté en dessous.` : ""}

TYPE DE CONTENU DEMANDÉ : ${searchType === "tv" ? "SÉRIE TV uniquement. Tu DOIS recommander une série, PAS un film." : "FILM uniquement. Tu DOIS recommander un film, PAS une série."}

NIVEAU D'EXPLORATION : ${explorationLevel}/10 (${explorationModeLabel})
${explorationInstruction}
${embeddingSection}

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide sans backticks
- Structure : {"title": "<titre exact>", "reason": "<2-3 phrases>", "confidence": <0-100>, "scores": {"taste": <0-100>, "context": <0-100>, "embedding": <0-100>, "behaviour": <0-100>, "rating": <0-100>, "novelty": <0-100>}}
- Ne recommande JAMAIS un film déjà dans la liste ni un film avec l'un de ces IDs TMDB : ${normalizedExcludeIds.length > 0 ? normalizedExcludeIds.join(", ") : "aucun"}
- ${shouldDiscover || effectiveOutOfComfortZone ? "MODE DÉCOUVERTE/EXPLORATION activé selon le niveau d'exploration ci-dessus." : "MODE PRÉCISION : colle au plus près des micro-genres et clusters identifiés. Si des candidats par embedding sont disponibles, privilégie-les."}
${effectiveOutOfComfortZone ? `- MODE "HORS ZONE DE CONFORT" ACTIVÉ : Le film recommandé DOIT être VOLONTAIREMENT en dehors des genres et micro-genres habituels de l'utilisateur. Choisis un genre qu'il ne regarde JAMAIS. Explique dans "reason" pourquoi tu sors de ses habitudes et ce qu'il pourrait y trouver. Commence la raison par "Changement radical :".` : ""}
- Calibre le score de confiance selon la qualité du match`;

    const rejectionSection = rejectionContext ? `
CONTEXTE DE REJET :
L'utilisateur vient de rejeter "${rejectionContext.rejectedTitle}" (genres: ${(rejectionContext.rejectedGenres || []).join(", ")}).
Raison : ${rejectionContext.reason === "not_my_style" ? "Pas son style — propose un STYLE TRÈS DIFFÉRENT. Change de genre, de ton, d'époque. Évite les genres du film rejeté." : rejectionContext.reason === "too_long" ? "Trop long — propose quelque chose de plus court (< 100 min)." : rejectionContext.reason === "not_tonight" ? "Pas ce soir — propose quelque chose de plus léger, accessible, feel-good." : rejectionContext.reason === "already_seen" ? "Déjà vu — propose un film similaire en style mais différent." : "Raison inconnue — change de direction."}
IMPORTANT : NE recommande PAS un film des mêmes genres principaux que "${rejectionContext.rejectedTitle}".` : "";

    const userPrompt = `Films aimés (${titles.length}, pondérés par récence) : ${titles.join(", ")}
Genres préférés (pondérés) : ${topGenres.join(", ")}
Micro-genres : ${tasteClusters.join(", ") || "à déduire des films aimés"}
Films regardés : ${stats.watchCount || 0} | Films skippés : ${stats.skipCount || 0} | Films aimés : ${stats.likeCount || 0}
Taux d'acceptation : ${acceptanceRate}%
${heavilySkippedGenres.length > 0 ? `Genres souvent refusés : ${heavilySkippedGenres.join(", ")}` : ""}
${shouldDiscover ? "→ MODE DÉCOUVERTE" : "→ MODE PRÉCISION"} | Niveau d'exploration : ${explorationLevel}/10 (${explorationModeLabel})
${rejectionSection}

Recommande UN film avec les scores détaillés.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    let aiFailed = false;
    let suggestion: any = null;

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        console.warn("AI credits exhausted, falling back to TMDB-only recommendation");
        aiFailed = true;
      } else {
        console.error(`AI error: ${status}`);
        aiFailed = true;
      }
    }

    if (!aiFailed) {
      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        suggestion = JSON.parse(jsonStr);
      } catch {
        console.warn("Failed to parse AI suggestion, falling back to TMDB");
        aiFailed = true;
      }
    }

    // Genre name to TMDB ID mapping for filtering
    const genreNameToId: Record<string, number> = {
      "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
      "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
      "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
      "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
    };
    const excludedGenreIds = new Set((excludedGenres || []).map((g: string) => genreNameToId[g]).filter(Boolean));

    const excludedSet = new Set(normalizedExcludeIds);

    const isMovieAllowed = (movie: any): boolean => {
      if (excludedSet.has(movie.id)) return false;
      if (minRating && minRating > 0 && (movie.vote_average || 0) < minRating) return false;
      if (excludedGenreIds.size > 0 && movie.genre_ids) {
        if (movie.genre_ids.some((gid: number) => excludedGenreIds.has(gid))) return false;
      }
      return true;
    };

    // Search TMDB — either from AI suggestion or direct discover fallback
    let selectedMovie: any = null;

    if (suggestion && suggestion.title) {
      const searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(suggestion.title)}&page=1`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const results = searchData.results || [];
      selectedMovie = results.find((r: any) => isMovieAllowed(r));
    }

    if (!selectedMovie) {
      // Fallback: use discover with filters + user's favorite genres
      const genreIdMap: Record<string, number> = {
        "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
        "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
        "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
        "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
      };

      // Try multiple pages with progressively relaxed filters
      for (let attempt = 0; attempt < 4 && !selectedMovie; attempt++) {
        const discoverParams = new URLSearchParams({
          api_key: TMDB_API_KEY,
          language: "fr-FR",
          sort_by: "popularity.desc",
          "vote_count.gte": attempt < 2 ? "100" : "50",
          page: String(Math.floor(Math.random() * (attempt < 2 ? 10 : 5)) + 1),
        });
        if (minRating && minRating > 0 && attempt < 3) discoverParams.set("vote_average.gte", String(minRating));
        if (excludedGenreIds.size > 0 && attempt < 3) discoverParams.set("without_genres", [...excludedGenreIds].join(","));
        if (topGenres.length > 0 && !effectiveOutOfComfortZone && explorationLevel < 7 && attempt < 2) {
          const genreIds = topGenres.map(g => genreIdMap[g]).filter(Boolean).slice(0, 3);
          if (genreIds.length > 0) discoverParams.set("with_genres", genreIds.join("|"));
        } else if (topGenres.length > 0 && explorationLevel >= 7 && attempt < 2) {
          // For high exploration: exclude preferred genres to force discovery
          const genreIds = topGenres.map(g => genreIdMap[g]).filter(Boolean).slice(0, 3);
          if (genreIds.length > 0) discoverParams.set("without_genres", [...new Set([...(discoverParams.get("without_genres") || "").split(",").filter(Boolean), ...genreIds.map(String)])].join(","));
        }
        if (platformIds && platformIds.length > 0 && attempt < 3) {
          discoverParams.set("with_watch_providers", platformIds.join("|"));
          discoverParams.set("watch_region", "FR");
        }
        const fallbackUrl = `https://api.themoviedb.org/3/discover/${searchType}?${discoverParams}`;
        const fallbackRes = await fetch(fallbackUrl);
        const fallbackData = await fallbackRes.json();
        selectedMovie = (fallbackData.results || []).find((r: any) => isMovieAllowed(r));
        // If strict filter found nothing, try any non-excluded movie from results
        if (!selectedMovie && (fallbackData.results || []).length > 0) {
          selectedMovie = (fallbackData.results || []).find((r: any) => !excludedSet.has(r.id));
        }
      }
    }

    if (!selectedMovie) {
      // Ultimate fallback: trending
      const trendingRes = await fetch(`https://api.themoviedb.org/3/trending/${searchType}/week?api_key=${TMDB_API_KEY}&language=fr-FR`);
      const trendingData = await trendingRes.json();
      selectedMovie = (trendingData.results || []).find((r: any) => !excludedSet.has(r.id));
    }

    if (!selectedMovie) {
      throw new Error("No non-excluded movie found on TMDB");
    }

    const movieDetail = await getMovieDetails(selectedMovie.id, searchType);

    // Generate embedding for the recommended movie (fire & forget)
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tmdbId: movieDetail.id,
          title: movieDetail.title || movieDetail.name,
          overview: movieDetail.overview,
          genres: (movieDetail.genres || []).map((g: any) => g.name),
        }),
      }).catch(() => {});
    }

    const contentLabel = searchType === "tv" ? "Cette série" : "Ce film";
    const fallbackReason = aiFailed
      ? `${contentLabel} correspond à tes genres préférés (${topGenres.slice(0, 3).join(", ")}). Pick n'a pas pu utiliser l'IA pour affiner la recommandation, mais ce titre est populaire et bien noté !`
      : suggestion?.reason || `${contentLabel} est recommandé par Pick.`;

    return new Response(JSON.stringify({
      movie: movieDetail,
      reason: fallbackReason,
      confidence: aiFailed ? 50 : (suggestion?.confidence || 75),
      isDiscovery: shouldDiscover,
      scores: aiFailed ? null : (suggestion?.scores || null),
      engineMeta: {
        profileConfidence: confidence.score,
        discoveryRatio: confidence.discoveryRatio,
        acceptanceRate,
        mode: aiFailed ? "fallback" : (shouldDiscover ? "discovery" : "precision"),
        explorationLevel,
        mediaType: searchType,
        embeddingCandidatesCount: embeddingCandidates.length,
        aiFallback: aiFailed,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("surprise-personalized error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
