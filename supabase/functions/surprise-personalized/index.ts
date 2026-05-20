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
    if (!res.ok) {
      console.error(`TMDB ${type}/${id} returned ${res.status}`);
      return null;
    }
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    console.error(`getMovieDetails ${type}/${id} failed:`, e);
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function parseVector(v: any): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { return JSON.parse(v.replace(/^\[/, "[").replace(/\]$/, "]")); } catch { return null; }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      likedMovies, tasteProfile, userTasteVector, recentTasteVector, avoidanceVector,
      platformIds, excludeIds, excludedPlatformIds, excludedGenres,
      minRating: rawMinRating, rejectionContext, outOfComfortZone,
      explorationLevel: rawExplorationLevel, mediaType: rawMediaType,
      count: rawCount, maxDuration: rawMaxDuration,
      minMatchScore: rawMinMatchScore,
    } = await req.json();

    const maxDuration = typeof rawMaxDuration === "number" && rawMaxDuration > 0 ? rawMaxDuration : null;
    const requestedCount = typeof rawCount === "number" && rawCount >= 1 && rawCount <= 10 ? rawCount : 1;
    const minRating = typeof rawMinRating === "number" ? Math.min(rawMinRating, 8) : 0;
    const explorationLevel = typeof rawExplorationLevel === "number" ? Math.max(0, Math.min(10, rawExplorationLevel)) : 5;
    const mediaType: "movie" | "tv" | "both" = rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";
    const minMatchScore = typeof rawMinMatchScore === "number" ? Math.max(0, Math.min(100, rawMinMatchScore)) : 80;
    // For single requests, pick randomly. For multi-requests with "both", we'll force a mix below.
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
    const topGenres = Object.entries(genreCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([g]) => g);

    // ── Multi-vector embedding search ──
    let stableCandidates: string[] = [];
    let recentCandidates: string[] = [];
    let avoidanceCandidateIds: number[] = [];

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Pool 1: Stable taste candidates
      if (userTasteVector) {
        try {
          const { data: matches } = await supabase.rpc("match_movies_by_taste", {
            query_vector: `[${userTasteVector.join(",")}]`,
            match_count: 15,
            exclude_ids: normalizedExcludeIds,
          });
          if (matches) {
            const threshold = explorationLevel <= 2 ? 0.85 : explorationLevel <= 5 ? 0.7 : 0.5;
            stableCandidates = matches
              .filter((m: any) => m.similarity > threshold)
              .map((m: any) => `${m.title} (sim_stable: ${Math.round(m.similarity * 100)}%, tags: ${(m.taste_tags || []).join(", ")})`);
          }
        } catch (e) { console.error("Stable embedding search failed:", e); }
      }

      // Pool 2: Recent taste candidates (different results if recent taste diverges)
      const parsedRecent = parseVector(recentTasteVector);
      if (parsedRecent) {
        try {
          const { data: matches } = await supabase.rpc("match_movies_by_taste", {
            query_vector: `[${parsedRecent.join(",")}]`,
            match_count: 10,
            exclude_ids: normalizedExcludeIds,
          });
          if (matches) {
            recentCandidates = matches
              .filter((m: any) => m.similarity > 0.65)
              .map((m: any) => `${m.title} (sim_recent: ${Math.round(m.similarity * 100)}%)`);
          }
        } catch (e) { console.error("Recent embedding search failed:", e); }
      }

      // Pool 3: Avoidance - find movies SIMILAR to avoidance vector to PENALIZE
      const parsedAvoidance = parseVector(avoidanceVector);
      if (parsedAvoidance) {
        try {
          const { data: matches } = await supabase.rpc("match_movies_by_taste", {
            query_vector: `[${parsedAvoidance.join(",")}]`,
            match_count: 20,
            exclude_ids: normalizedExcludeIds,
          });
          if (matches) {
            avoidanceCandidateIds = matches
              .filter((m: any) => m.similarity > 0.75)
              .map((m: any) => m.tmdb_id);
          }
        } catch (e) { console.error("Avoidance search failed:", e); }
      }
    }

    // ── Extract enriched profile data ──
    const confidence = tasteProfile?.confidence || { score: 50, discoveryRatio: 0.2 };
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const rejectedClusters = tasteProfile?.rejectedClusters || [];
    const skipPatterns = tasteProfile?.skipPatterns || {};
    const stats = tasteProfile?.stats || {};
    const session = tasteProfile?.session || {};
    const scoringWeights = tasteProfile?.scoringWeights || {};
    const acceptanceRate = stats.acceptanceRate || 0;
    const fatigueState = tasteProfile?.fatigueState || {};

    const heavilySkippedGenres = Object.entries(skipPatterns?.skippedGenres || {})
      .filter(([, count]) => (count as number) >= 3)
      .map(([genre]) => genre);

    // Fatigue penalty info
    const fatiguedGenres = Object.entries(fatigueState)
      .filter(([k, v]) => k.startsWith("genre_") && (v as number) >= 3)
      .map(([k, v]) => `${k.replace("genre_", "")} (${v}x cette semaine)`);

    const shouldDiscover = explorationLevel >= 7 || Math.random() < (confidence.discoveryRatio || 0.2);
    const effectiveOutOfComfortZone = outOfComfortZone || explorationLevel >= 9;

    const explorationModeLabel = explorationLevel <= 2 ? "ULTRA-PRÉCISION" : explorationLevel <= 5 ? "ÉQUILIBRÉ" : explorationLevel <= 8 ? "DÉCOUVERTE" : "TERRE INCONNUE";

    const explorationInstruction = explorationLevel <= 2
      ? "MODE ULTRA-PRÉCISION : Colle exactement aux genres et micro-genres favoris. Privilégie les candidats à haute similarité stable (>85%). Zéro risque."
      : explorationLevel <= 5
        ? "MODE ÉQUILIBRÉ : Balance entre confort et découverte. Reste proche des goûts mais permets-toi des genres adjacents."
        : explorationLevel <= 8
          ? "MODE DÉCOUVERTE : Propose des genres adjacents, des pépites méconnues. L'utilisateur est ouvert à la surprise."
          : "MODE TERRE INCONNUE : Le contenu DOIT être RADICALEMENT différent des habitudes. Genre jamais regardé. Explique pourquoi ce choix inattendu pourrait plaire.";

    const skipInsights = skipPatterns.avgSkipRate > 0.6
      ? "⚠️ L'utilisateur skip souvent — sois très sélectif et change de direction."
      : skipPatterns.recentSkipStreak > 3
        ? "⚠️ Skip streak détecté — change radicalement de registre."
        : "";

    const mediaTypeLabel = searchType === "tv" ? "une SÉRIE TV" : "un FILM";

    const systemPrompt = `Tu es le moteur de recommandation Pick — un système multi-signal de niveau Netflix. Tu combines 4 vecteurs de goût + contexte + rejet + fatigue pour trouver ${mediaTypeLabel} parfait(e).

ARCHITECTURE MULTI-VECTEUR :
- STABLE TASTE : goût profond, historique complet, demi-vie longue (~150j)
- RECENT TASTE : tendances des 30 derniers jours, demi-vie courte (~21j) 
- AVOIDANCE : ce que l'utilisateur refuse, construit depuis les rejets
- SESSION : intention immédiate du moment

SCORING MULTI-CRITÈRE (poids) :
- stable_taste (${scoringWeights.stable_taste || 0.18}) : correspondance avec le goût profond
- recent_taste (${scoringWeights.recent_taste || 0.12}) : tendances récentes
- session_context (${scoringWeights.session_context || 0.18}) : mood + contexte + temps
- embedding_similarity (${scoringWeights.embedding_similarity || 0.12}) : proximité vectorielle
- acceptance_likelihood (${scoringWeights.acceptance_likelihood || 0.12}) : probabilité d'acceptation (basée sur patterns)
- rejection_risk (${scoringWeights.rejection_risk || -0.10}) : PÉNALITÉ si similaire au vecteur de rejet
- quality_score (${scoringWeights.quality_score || 0.06}) : note critique
- novelty_fit (${scoringWeights.novelty_fit || 0.05}) : découverte calibrée selon tolérance
- availability (${scoringWeights.availability || 0.04}) : plateformes
- fatigue_penalty (${scoringWeights.fatigue_penalty || -0.03}) : PÉNALITÉ si genre sur-exposé
- strategic_boost (${scoringWeights.strategic_boost || 0.02}) : bonus découverte prometteuse

PROFIL ENRICHI :
- Confiance : ${confidence.score}/100 (${confidence.score < 30 ? "profil naissant → reco safe + fallbacks robustes" : confidence.score < 60 ? "profil en développement → balance confort/découverte" : "profil mature → haute précision"})
- Taux d'acceptation : ${acceptanceRate}%
- Tolérance nouveauté : ${Math.round((confidence.discoveryRatio || 0.2) * 100)}%
- Genres préférés : ${topGenres.join(", ")}
- Micro-genres favoris : ${tasteClusters.join(", ") || "non déterminés"}
${rejectedClusters.length > 0 ? `- CLUSTERS REJETÉS : ${rejectedClusters.join(", ")} — ÉVITER FORTEMENT` : ""}
${skipInsights}
${session.mood ? `- Session : mood "${session.mood}", contexte "${session.context || "?"}", temps "${session.time || "?"}"` : ""}
${platformIds?.length > 0 ? `- Plateformes (IDs TMDB): ${platformIds.join(", ")}. Le contenu DOIT être disponible.` : ""}
${excludedPlatformIds?.length > 0 ? `- Plateformes exclues (IDs): ${excludedPlatformIds.join(", ")}.` : ""}
${excludedGenres?.length > 0 ? `- GENRES EXCLUS (ABSOLU): ${excludedGenres.join(", ")}` : ""}
${heavilySkippedGenres.length > 0 ? `- Genres souvent refusés (3+): ${heavilySkippedGenres.join(", ")}` : ""}
${fatiguedGenres.length > 0 ? `- FATIGUE DÉTECTÉE : ${fatiguedGenres.join(", ")} → Pénalise ces genres, diversifie.` : ""}
${minRating > 0 ? `- Note minimale TMDB: ${minRating}/10` : ""}

CANDIDATS PAR VECTEUR STABLE (les plus proches du goût profond) :
${stableCandidates.length > 0 ? stableCandidates.map((c, i) => `${i + 1}. ${c}`).join("\n") : "Aucun candidat vectoriel stable."}

${recentCandidates.length > 0 ? `CANDIDATS PAR VECTEUR RÉCENT (tendances des 30 derniers jours) :\n${recentCandidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}

${avoidanceCandidateIds.length > 0 ? `⚠️ IDs TMDB À ÉVITER (proches du vecteur de rejet) : ${avoidanceCandidateIds.join(", ")}` : ""}

TYPE : ${searchType === "tv" ? "SÉRIE TV uniquement" : "FILM uniquement"}
${maxDuration ? `DURÉE MAX : ${maxDuration} min (ABSOLU)` : ""}

EXPLORATION : ${explorationLevel}/10 (${explorationModeLabel})
${explorationInstruction}

RÈGLES DE RERANKING FINAL :
- Pas 2 films du même réalisateur
- Diversifie les sous-genres entre les suggestions
- Le top 1 = MEILLEUR compromis goût + contexte + risque minimal
- Les alternatives = diversifiées mais cohérentes

RÈGLES JSON :
- Réponds UNIQUEMENT avec un JSON valide sans backticks
${requestedCount > 1 ? `- Structure : {"suggestions": [{"title": "<titre>", "reason": "<2-3 phrases POSITIVES — mets en avant pourquoi ça va plaire, ne mentionne JAMAIS les aspects négatifs>", "confidence": <0-100>, "scores": {"stable_taste": <0-100>, "recent_taste": <0-100>, "context": <0-100>, "rejection_risk": <0-100>, "quality": <0-100>, "novelty": <0-100>, "fatigue": <0-100>}}, ...]}
- EXACTEMENT ${requestedCount} suggestions DIFFÉRENTES
- SCORE HONNÊTE : Donne un confidence SINCÈRE. Match parfait = 85-99, correct = 65-84, faible = <65. Ne gonfle PAS.
- SEUIL MINIMUM : ${minMatchScore}%. Ne propose QUE des contenus dont le confidence RÉEL est ≥ ${minMatchScore}%. Si tu n'es pas sûr que ça corresponde, ne le propose pas.` : `- Structure : {"title": "<titre>", "reason": "<2-3 phrases POSITIVES — mets en avant pourquoi ça va plaire, ne mentionne JAMAIS les aspects négatifs>", "confidence": <0-100>, "scores": {"stable_taste": <0-100>, "recent_taste": <0-100>, "context": <0-100>, "rejection_risk": <0-100>, "quality": <0-100>, "novelty": <0-100>, "fatigue": <0-100>}}
- SCORE HONNÊTE : confidence SINCÈRE basé sur la compatibilité réelle.
- SEUIL MINIMUM : ${minMatchScore}%. Ne propose QUE si le confidence RÉEL est ≥ ${minMatchScore}%.`}
- RÈGLE D'OR DU TON : La "reason" doit être EXCLUSIVEMENT POSITIVE. Valorise ce qui va plaire. Pas de "malgré", "cependant", "par contre".
- IDs TMDB exclus : ${normalizedExcludeIds.length > 0 ? normalizedExcludeIds.slice(0, 200).join(", ") : "aucun"}
${effectiveOutOfComfortZone ? `- MODE HORS ZONE DE CONFORT ACTIVÉ` : ""}`;

    const rejectionSection = rejectionContext ? `
CONTEXTE DE REJET IMMÉDIAT :
Film rejeté : "${rejectionContext.rejectedTitle}" (genres: ${(rejectionContext.rejectedGenres || []).join(", ")})
Raison : ${rejectionContext.reason === "not_my_style" ? "Pas son style → CHANGE DE GENRE ET DE TON" : rejectionContext.reason === "too_long" ? "Trop long → < 100 min" : rejectionContext.reason === "not_tonight" ? "Pas ce soir → plus léger, accessible" : rejectionContext.reason === "too_slow" ? "Trop lent → pacing plus rapide" : rejectionContext.reason === "too_intense" ? "Trop intense → plus doux, feel-good" : rejectionContext.reason === "already_seen" ? "Déjà vu → similaire mais différent" : "Raison inconnue → change de direction"}
NE PAS recommander les mêmes genres que "${rejectionContext.rejectedTitle}".` : "";

    const userPrompt = `Films aimés (${titles.length}, pondérés) : ${titles.join(", ")}
Genres (pondérés) : ${topGenres.join(", ")}
Micro-genres : ${tasteClusters.join(", ") || "à déduire"}
Stats : ${stats.likeCount || 0} aimés | ${stats.watchCount || 0} vus | ${stats.skipCount || 0} skippés
Acceptation : ${acceptanceRate}%
${rejectionSection}

Recommande ${requestedCount > 1 ? `${requestedCount} contenus` : "UN contenu"} avec scores détaillés multi-critères.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        max_tokens: requestedCount > 1 ? 1600 : 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    let aiFailed = false;
    let suggestions: any[] = [];

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway non-OK:", response.status);
      aiFailed = true;
    }

    if (!aiFailed) {
      let aiData: any;
      try {
        const rawText = await response.text();
        aiData = JSON.parse(rawText);
      } catch (e) {
        console.error("Failed to parse AI gateway response body:", e);
        aiFailed = true;
      }
      const content = aiFailed ? "" : (aiData?.choices?.[0]?.message?.content || "");
      if (!aiFailed) try {
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        if (requestedCount > 1 && parsed.suggestions) {
          // Keep only suggestions that meet the minimum match score
          const qualifying = parsed.suggestions.filter((s: any) => (s.confidence || 0) >= minMatchScore);
          if (qualifying.length >= requestedCount) {
            suggestions = qualifying.slice(0, requestedCount);
          } else if (qualifying.length > 0) {
            // Not enough qualifying — use what we have, fill rest from TMDB discover
            suggestions = qualifying;
          } else {
            // None qualify — use discover fallback entirely (don't force bad matches)
            console.warn(`All ${parsed.suggestions.length} AI suggestions below ${minMatchScore}% threshold — falling back to discover`);
            suggestions = [];
          }
        } else if (parsed.title) {
          if ((parsed.confidence || 0) >= minMatchScore) {
            suggestions = [parsed];
          } else {
            console.warn(`Single AI suggestion "${parsed.title}" at ${parsed.confidence}% — below ${minMatchScore}% threshold`);
            suggestions = [];
          }
        } else { aiFailed = true; }
      } catch { aiFailed = true; }
    }

    // ── TMDB resolution ──
    const genreNameToId: Record<string, number> = {
      "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
      "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
      "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
      "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
    };
    const excludedGenreIds = new Set((excludedGenres || []).map((g: string) => genreNameToId[g]).filter(Boolean));
    const excludedSet = new Set(normalizedExcludeIds);
    const avoidanceSet = new Set(avoidanceCandidateIds);

    const isMovieAllowed = (movie: any): boolean => {
      if (excludedSet.has(movie.id)) return false;
      if (avoidanceSet.has(movie.id)) return false; // Penalize avoidance candidates
      if (minRating > 0 && (movie.vote_average || 0) < minRating) return false;
      if (excludedGenreIds.size > 0 && movie.genre_ids?.some((gid: number) => excludedGenreIds.has(gid))) return false;
      return true;
    };

    const searchSuggestionOnTMDB = async (sug: any): Promise<any | null> => {
      if (!sug?.title) return null;
      const searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(sug.title)}&page=1`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const found = (searchData.results || []).find((r: any) => isMovieAllowed(r));
      if (!found) return null;
      const detail = await getMovieDetails(found.id, searchType);
      if (!detail) return null;
      if (maxDuration && searchType === "movie" && detail.runtime > maxDuration) return null;
      return { movie: detail, suggestion: sug };
    };

    const discoverFallback = async (): Promise<any | null> => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const params = new URLSearchParams({
          api_key: TMDB_API_KEY, language: "fr-FR", sort_by: "popularity.desc",
          "vote_count.gte": attempt < 2 ? "100" : "50",
          page: String(Math.floor(Math.random() * (attempt < 2 ? 15 : 5)) + 1),
        });
        if (minRating > 0 && attempt < 3) params.set("vote_average.gte", String(minRating));
        if (maxDuration && searchType === "movie") params.set("with_runtime.lte", String(maxDuration));
        if (excludedGenreIds.size > 0 && attempt < 3) params.set("without_genres", [...excludedGenreIds].join(","));
        if (topGenres.length > 0 && !effectiveOutOfComfortZone && explorationLevel < 7 && attempt < 2) {
          const gids = topGenres.map(g => genreNameToId[g]).filter(Boolean).slice(0, 3);
          if (gids.length > 0) params.set("with_genres", gids.join("|"));
        }
        if (platformIds?.length > 0 && attempt < 3) {
          params.set("with_watch_providers", platformIds.join("|"));
          params.set("watch_region", "FR");
        }
        const res = await fetch(`https://api.themoviedb.org/3/discover/${searchType}?${params}`);
        const data = await res.json();
        const movie = (data.results || []).find((r: any) => isMovieAllowed(r));
        if (movie) {
          const detail = await getMovieDetails(movie.id, searchType);
          if (detail) return detail;
        }
      }
      // Ultimate fallback: trending
      const res = await fetch(`https://api.themoviedb.org/3/trending/${searchType}/week?api_key=${TMDB_API_KEY}&language=fr-FR`);
      const data = await res.json();
      const movie = (data.results || []).find((r: any) => !excludedSet.has(r.id));
      return movie ? await getMovieDetails(movie.id, searchType) : null;
    };

    const contentLabel = searchType === "tv" ? "Cette série" : "Ce film";
    const foundMovieIds = new Set<number>();

    // Generate embeddings fire & forget helper
    const fireEmbedding = (m: any) => {
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ tmdbId: m.id, title: m.title || m.name, overview: m.overview, genres: (m.genres || []).map((g: any) => g.name) }),
        }).catch(() => {});
      }
    };

    const buildFallbackMovies = async (targetCount: number): Promise<any[]> => {
      const movies: any[] = [];
      let attempts = 0;
      while (movies.length < targetCount && attempts < targetCount * 8) {
        attempts += 1;
        const fallback = await discoverFallback();
        if (!fallback || foundMovieIds.has(fallback.id)) continue;
        foundMovieIds.add(fallback.id);
        movies.push({ movie: fallback, reason: `Ce contenu correspond à tes genres préférés.`, confidence: minMatchScore, scores: null });
        fireEmbedding(fallback);
      }
      return movies;
    };

    if (requestedCount > 1) {
      // For "both" mode: enforce a true mix (3 movies, 2 series for count=5; ceil/floor for other counts)
      const isMixed = mediaType === "both";
      const targetMovies = isMixed ? Math.ceil(requestedCount * 0.6) : (mediaType === "movie" ? requestedCount : 0);
      const targetTV = isMixed ? requestedCount - targetMovies : (mediaType === "tv" ? requestedCount : 0);

      const searchSuggestionTyped = async (sug: any, forceType: "movie" | "tv"): Promise<any | null> => {
        if (!sug?.title) return null;
        const searchUrl = `https://api.themoviedb.org/3/search/${forceType}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(sug.title)}&page=1`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const found = (searchData.results || []).find((r: any) => isMovieAllowed(r) && !foundMovieIds.has(r.id));
        if (!found) return null;
        const detail = await getMovieDetails(found.id, forceType);
        if (!detail) return null;
        if (maxDuration && forceType === "movie" && detail.runtime > maxDuration) return null;
        return { movie: detail, suggestion: sug };
      };

      const movies: any[] = [];
      let movieCount = 0, tvCount = 0;

      if (suggestions.length > 0) {
        for (const sug of suggestions) {
          if (movies.length >= requestedCount) break;
          // Decide which type to search for this suggestion
          let type: "movie" | "tv" = searchType;
          if (isMixed) {
            if (movieCount < targetMovies && tvCount < targetTV) {
              type = movieCount <= tvCount ? "movie" : "tv";
            } else if (movieCount < targetMovies) {
              type = "movie";
            } else {
              type = "tv";
            }
          }
          const result = await searchSuggestionTyped(sug, type);
          if (result && !foundMovieIds.has(result.movie.id)) {
            foundMovieIds.add(result.movie.id);
            movies.push({
              movie: result.movie,
              reason: result.suggestion.reason || `Ce contenu est recommandé par Pick.`,
              confidence: result.suggestion.confidence || 75,
              scores: result.suggestion.scores || null,
            });
            fireEmbedding(result.movie);
            if (type === "movie") movieCount++; else tvCount++;
          }
        }
      }

      // Fill remaining slots if needed
      for (const type of (["movie", "tv"] as const)) {
        const target = type === "movie" ? targetMovies : targetTV;
        const current = type === "movie" ? movieCount : tvCount;
        for (let i = current; i < target && movies.length < requestedCount; i++) {
          const params = new URLSearchParams({
            api_key: TMDB_API_KEY, language: "fr-FR", sort_by: "popularity.desc",
            "vote_count.gte": "100", page: String(Math.floor(Math.random() * 10) + 1),
          });
          if (minRating > 0) params.set("vote_average.gte", String(minRating));
          const res = await fetch(`https://api.themoviedb.org/3/discover/${type}?${params}`);
          const data = await res.json();
          const found = (data.results || []).find((r: any) => isMovieAllowed(r) && !foundMovieIds.has(r.id));
          if (found) {
            const detail = await getMovieDetails(found.id, type);
            if (detail) {
              foundMovieIds.add(detail.id);
              movies.push({ movie: detail, reason: `Recommandé par Pick pour diversifier.`, confidence: minMatchScore, scores: null });
              fireEmbedding(detail);
              if (type === "movie") movieCount++; else tvCount++;
            }
          }
        }
      }

      if (movies.length < requestedCount) {
        const fallbackMovies = await buildFallbackMovies(requestedCount - movies.length);
        movies.push(...fallbackMovies);
      }

      if (movies.length === 0) {
        const fallback = await discoverFallback();
        if (!fallback) throw new Error("No movie found");
        movies.push({ movie: fallback, reason: `Ce contenu correspond à tes genres préférés.`, confidence: minMatchScore, scores: null });
      }

      return new Response(JSON.stringify({
        movies, movie: movies[0].movie, reason: movies[0].reason,
        confidence: movies[0].confidence, scores: movies[0].scores,
        isDiscovery: shouldDiscover,
        engineMeta: {
          profileConfidence: confidence.score, discoveryRatio: confidence.discoveryRatio, acceptanceRate,
          mode: aiFailed ? "fallback" : (shouldDiscover ? "discovery" : "precision"),
          explorationLevel, mediaType,
          stableCandidates: stableCandidates.length, recentCandidates: recentCandidates.length,
          avoidancePenalized: avoidanceCandidateIds.length, aiFallback: aiFailed,
          multiVector: true, movieCount, tvCount,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Single movie mode
    let selectedMovie: any = null;
    const singleSuggestion = suggestions[0] || null;
    if (singleSuggestion?.title) {
      const result = await searchSuggestionOnTMDB(singleSuggestion);
      if (result) selectedMovie = result.movie;
    }
    if (!selectedMovie) selectedMovie = await discoverFallback();
    if (!selectedMovie) throw new Error("No movie found");

    fireEmbedding(selectedMovie);

    return new Response(JSON.stringify({
      movie: selectedMovie,
      reason: aiFailed
        ? `${contentLabel} correspond à tes genres préférés (${topGenres.slice(0, 3).join(", ")}).`
        : singleSuggestion?.reason || `${contentLabel} est recommandé par Pick.`,
      confidence: aiFailed ? minMatchScore : (singleSuggestion?.confidence || minMatchScore),
      isDiscovery: shouldDiscover,
      scores: aiFailed ? null : (singleSuggestion?.scores || null),
      engineMeta: {
        profileConfidence: confidence.score, discoveryRatio: confidence.discoveryRatio, acceptanceRate,
        mode: aiFailed ? "fallback" : (shouldDiscover ? "discovery" : "precision"),
        explorationLevel, mediaType: searchType,
        stableCandidates: stableCandidates.length, recentCandidates: recentCandidates.length,
        avoidancePenalized: avoidanceCandidateIds.length, aiFallback: aiFailed,
        multiVector: true,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("surprise-personalized error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
