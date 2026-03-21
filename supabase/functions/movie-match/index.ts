import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
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
    const { movie, userCriteria, tasteProfile, userTasteVector, likedMovieTitles, searchTags, cinematicProfile, peoplePreferences } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isYouTube = !!(movie._youtube);
    const youtubeData = movie._youtubeData || {};
    const title = movie.title || movie.name || "Contenu inconnu";
    const genres = (movie.genres || []).map((g: any) => g.name).join(", ");
    const overview = movie.overview || "";
    const rating = movie.vote_average || 0;
    const runtime = movie.runtime || 0;
    const tmdbId = movie.id;

    // ── Embedding similarities (stable + recent + avoidance) ──
    let embeddingSimilarity: number | null = null;
    let recentSimilarity: number | null = null;
    let avoidanceSimilarity: number | null = null;
    let movieTasteTags: string[] = [];
    let movieSemanticAxes: any = {};
    let movieSafetyTags: string[] = [];
    let movieSuitabilityTags: string[] = [];
    let movieClusterLabels: string[] = [];

    if (!isYouTube && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: movieEmb } = await supabase
        .from("movie_embeddings")
        .select("embedding, taste_tags, semantic_axes, safety_tags, suitability_tags, cluster_labels")
        .eq("tmdb_id", tmdbId)
        .maybeSingle();

      let movieVector: number[] | null = null;

      if (movieEmb) {
        movieVector = typeof movieEmb.embedding === "string"
          ? JSON.parse(movieEmb.embedding.replace(/^\[/, "[").replace(/\]$/, "]"))
          : movieEmb.embedding;
        movieTasteTags = movieEmb.taste_tags || [];
        movieSemanticAxes = (movieEmb as any).semantic_axes || {};
        movieSafetyTags = (movieEmb as any).safety_tags || [];
        movieSuitabilityTags = (movieEmb as any).suitability_tags || [];
        movieClusterLabels = (movieEmb as any).cluster_labels || [];
      } else {
        try {
          const embResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ tmdbId, title, overview, genres: (movie.genres || []).map((g: any) => g.name) }),
          });
          if (embResponse.ok) {
            const embData = await embResponse.json();
            movieVector = embData.embedding;
            movieTasteTags = embData.tasteTags || [];
          }
        } catch (e) { console.error("Embedding generation failed:", e); }
      }

      if (movieVector) {
        // Stable taste similarity
        if (userTasteVector) {
          embeddingSimilarity = cosineSimilarity(userTasteVector, movieVector);
        }
        // Recent taste similarity
        const recentVec = parseVector(tasteProfile?.recentTasteVector);
        if (recentVec) {
          recentSimilarity = cosineSimilarity(recentVec, movieVector);
        }
        // Avoidance similarity (high = BAD)
        const avoidVec = parseVector(tasteProfile?.avoidanceVector);
        if (avoidVec) {
          avoidanceSimilarity = cosineSimilarity(avoidVec, movieVector);
        }
      }
    }

    // ── Session context ──
    const searchTagsText = (searchTags && searchTags.length > 0) 
      ? `\nTAGS DE RECHERCHE (ce que l'utilisateur a dit/demandé) : ${searchTags.join(", ")}`
      : "";
    const criteriaText = userCriteria
      ? `SESSION ACTUELLE : humeur "${userCriteria.mood || "non précisée"}", contexte "${userCriteria.context || "non précisé"}", temps "${userCriteria.time || "non précisé"}".${searchTagsText}`
      : `L'utilisateur a demandé une surprise aléatoire.${searchTagsText}`;

    // ── Enriched taste context ──
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const rejectedClusters = tasteProfile?.rejectedClusters || [];
    const confidence = tasteProfile?.confidence || { score: 50 };
    const skipPatterns = tasteProfile?.skipPatterns || {};
    const stats = tasteProfile?.stats || {};
    const topGenres = tasteProfile?.topGenres || [];
    const scoringWeights = tasteProfile?.scoringWeights || {};
    const fatigueState = tasteProfile?.fatigueState || {};

    const likedTitlesStr = (likedMovieTitles || []).slice(0, 30).join(", ");

    // Fatigue info
    const fatiguedGenres = Object.entries(fatigueState)
      .filter(([k, v]) => k.startsWith("genre_") && (v as number) >= 3)
      .map(([k, v]) => `${k.replace("genre_", "")} (${v}x cette semaine)`);

    const tasteSection = tasteProfile ? `
PROFIL DE GOÛTS ENRICHI (MULTI-VECTEUR) :
- Genres préférés (pondérés par récence) : ${topGenres.join(", ")}
- Micro-genres / clusters favoris : ${tasteClusters.join(", ") || "non déterminés"}
${rejectedClusters.length > 0 ? `- ⛔ CLUSTERS REJETÉS (fréquemment refusés) : ${rejectedClusters.join(", ")} — FORTE PÉNALITÉ` : ""}
- Films aimés : ${likedTitlesStr || "aucun encore"}
- ${stats.likeCount || 0} films aimés, ${stats.watchCount || 0} vus, ${stats.skipCount || 0} skippés
- Confiance profil : ${confidence.score}/100
- Taux d'acceptation : ${stats.acceptanceRate || 0}%
${embeddingSimilarity !== null ? `- 🧬 Similarité STABLE (goût profond) : ${Math.round(embeddingSimilarity * 100)}%` : ""}
${recentSimilarity !== null ? `- 🔄 Similarité RÉCENTE (30 derniers jours) : ${Math.round(recentSimilarity * 100)}%` : ""}
${avoidanceSimilarity !== null ? `- ⚠️ Similarité ÉVITEMENT : ${Math.round(avoidanceSimilarity * 100)}% ${avoidanceSimilarity > 0.6 ? "— RISQUE ÉLEVÉ DE REJET" : avoidanceSimilarity > 0.4 ? "— risque modéré" : "— risque faible"}` : ""}
${movieTasteTags.length > 0 ? `- 🏷️ Taste tags du film : ${movieTasteTags.join(", ")}` : ""}
${movieClusterLabels.length > 0 ? `- 📂 Clusters : ${movieClusterLabels.join(", ")}` : ""}
${movieSafetyTags.length > 0 ? `- ⚠️ Contenu sensible : ${movieSafetyTags.join(", ")}` : ""}
${movieSuitabilityTags.length > 0 ? `- 👥 Adapté pour : ${movieSuitabilityTags.join(", ")}` : ""}
${Object.keys(movieSemanticAxes).length > 0 ? `- 📊 Axes sémantiques : ${Object.entries(movieSemanticAxes).filter(([,v]) => (v as number) > 0.6).map(([k,v]) => `${k}=${v}`).join(", ")}` : ""}
${skipPatterns.avgSkipRate > 0.5 ? `- ⚠️ Skip rate élevé (${Math.round(skipPatterns.avgSkipRate * 100)}%) — l'utilisateur est exigeant` : ""}
${skipPatterns.recentSkipStreak > 2 ? `- ⚠️ ${skipPatterns.recentSkipStreak} skips consécutifs récents` : ""}
${fatiguedGenres.length > 0 ? `- 🔄 FATIGUE genre : ${fatiguedGenres.join(", ")} — pénalise ces genres dans le score` : ""}

SYSTÈME DE SCORING MULTI-CRITÈRE :
Le matchScore FINAL doit être la combinaison pondérée de :
- stable_taste (${scoringWeights.stable_taste || 0.18}) : similarité avec le goût profond${embeddingSimilarity !== null ? ` (brut: ${Math.round(embeddingSimilarity * 100)})` : ""}
- recent_taste (${scoringWeights.recent_taste || 0.12}) : tendances récentes${recentSimilarity !== null ? ` (brut: ${Math.round(recentSimilarity * 100)})` : ""}
- session_context (${scoringWeights.session_context || 0.18}) : adéquation session
- acceptance_likelihood (${scoringWeights.acceptance_likelihood || 0.12}) : probabilité d'acceptation
- rejection_risk (${scoringWeights.rejection_risk || -0.10}) : PÉNALITÉ${avoidanceSimilarity !== null ? ` (brut: ${Math.round(avoidanceSimilarity * 100)})` : ""}
- quality_score (${scoringWeights.quality_score || 0.06}) : note critique
- novelty_fit (${scoringWeights.novelty_fit || 0.05}) : découverte calibrée
- fatigue_penalty (${scoringWeights.fatigue_penalty || -0.03}) : pénalité si genre sur-exposé
${cinematicProfile ? `\nPROFIL CINÉMATOGRAPHIQUE :\n- Personnalité : "${cinematicProfile.personality_title}"\n- Description : ${cinematicProfile.narrative}\n- Traits : ${(cinematicProfile.taste_traits || []).join(", ")}\nUtilise ce profil pour enrichir tes explications.` : ""}` : "";

    const contentType = isYouTube ? "vidéo YouTube" : "film";

    const systemPrompt = isYouTube
      ? `Tu es Pick, un ami passionné de culture audiovisuelle qui calcule un match score. On te donne une vidéo YouTube, le profil de goûts d'un utilisateur, et sa session actuelle.

TON : Tu parles comme un pote — chaleureux, direct, jamais robotique.
- "headline" → une accroche naturelle et enthousiaste.
- "whyItMatches" → 1 phrase courte, style pote.
- "detailedExplanation" → 3-5 phrases. REPRENDS LES MOTS EXACTS de l'utilisateur.

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks
- Structure :
{
  "matchScore": <number 40-99>,
  "headline": "<accroche naturelle, 10 mots max>",
  "pickNote": "<1 phrase qui montre que Pick a compris la demande. Si aucun profil connu, null.>",
  "whyItMatches": "<1 phrase perso, ton conversationnel, tutoiement>",
  "detailedExplanation": "<3-5 phrases détaillées reprenant les mots de l'utilisateur>",
  "emotionalJourney": "<2-3 phrases sur l'expérience de visionnage>",
  "perfectFor": "<1 phrase, style 'Parfait pour apprendre un truc en 20 min'>",
  "funFact": "<1 info intéressante sur le sujet ou la chaîne>",
  "similarLikedMovies": [],
  "matchingReasons": ["<raison courte, 2-4 mots>", ...max 4]
}
- Score calibré : pas aligné → 40-60. Match parfait → 85-99.`
      : `Tu es Pick, un ami cinéphile passionné qui calcule un match score MULTI-VECTEUR. On te donne un film, le profil de goûts multi-dimensionnel d'un utilisateur, et sa session actuelle.

TON : Tu parles comme un pote cinéphile — chaleureux, direct, jamais robotique.
- "headline" → accroche naturelle, comme un ami dirait
- "whyItMatches" → 1 phrase courte, style pote
- "detailedExplanation" → 3-5 phrases. REPRENDS LES MOTS EXACTS de l'utilisateur

SCORING MULTI-VECTEUR :
- La SESSION prime sur le profil global quand elle est explicite
- Le score STABLE ancre le goût profond
- Le score RÉCENT capte les envies du moment
- Le score d'ÉVITEMENT PÉNALISE fortement (un film proche du vecteur de rejet = score bas)
- La FATIGUE pénalise les genres sur-exposés cette semaine
${embeddingSimilarity !== null ? `- Similarité stable (${Math.round(embeddingSimilarity * 100)}%) : >80% = très bon, <40% = décalage` : ""}
${avoidanceSimilarity !== null ? `- Similarité évitement (${Math.round(avoidanceSimilarity * 100)}%) : >60% = forte pénalité, <30% = OK` : ""}

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks
- Structure :
{
  "matchScore": <number 40-99>,
  "headline": "<accroche naturelle et chaleureuse, 10 mots max>",
  "pickNote": "<1 phrase courte citant un goût spécifique de l'utilisateur. Si profil vide, null.>",
  "whyItMatches": "<1 phrase perso, ton conversationnel, tutoiement>",
  "detailedExplanation": "<3-5 phrases détaillées reprenant les mots de l'utilisateur>",
  "emotionalJourney": "<2-3 phrases sur l'expérience émotionnelle>",
  "perfectFor": "<1 phrase, style 'Parfait pour une soirée solo sous la couette'>",
  "funFact": "<1 anecdote cool>",
  "similarLikedMovies": ["<titre exact d'un film aimé similaire>", ...max 3],
  "matchingReasons": ["<raison courte, 2-4 mots>", ...max 4],
  "scores": {
    "stable_taste": <0-100>,
    "recent_taste": <0-100>,
    "context": <0-100>,
    "rejection_risk": <0-100>,
    "quality": <0-100>,
    "novelty": <0-100>,
    "fatigue": <0-100>
  }
}
- "scores.rejection_risk" : 0 = aucun risque, 100 = certain rejet. Basé sur similarité évitement + clusters rejetés.
- "scores.fatigue" : 0 = aucune fatigue, 100 = genre totalement sur-exposé.
- Score final calibré : session pas alignée → 40-60 max. Match parfait → 85-99.
- Profil jeune (confiance < 40) = scores plus modérés`;

    const youtubeExtra = isYouTube ? `\nChaîne YouTube : ${youtubeData.channelTitle || "inconnue"}\nVues : ${youtubeData.viewCount || 0}\nDurée : ${runtime} min` : "";

    const userPrompt = `${isYouTube ? "Vidéo YouTube" : "Film"} : "${title}" (${genres}, ${runtime}min${!isYouTube ? `, note ${rating}/10` : ""})
Synopsis : ${overview}${youtubeExtra}
${criteriaText}${tasteSection}

Génère la fiche de match multi-vecteur.`;

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

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let matchData;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      matchData = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      matchData = {
        matchScore: 70,
        headline: "Celui-là pourrait bien te plaire",
        whyItMatches: "Vu ce que tu cherches, ça devrait coller.",
        detailedExplanation: "C'est le genre de film qui surprend — laisse-toi porter et tu verras.",
        emotionalJourney: "Une expérience qui vaut le détour.",
        perfectFor: "Parfait pour une soirée ciné sans prise de tête.",
        funFact: "Un film qui a marqué son genre.",
        scores: {
          stable_taste: embeddingSimilarity ? Math.round(embeddingSimilarity * 100) : 50,
          recent_taste: recentSimilarity ? Math.round(recentSimilarity * 100) : 50,
          context: 70,
          rejection_risk: avoidanceSimilarity ? Math.round(avoidanceSimilarity * 100) : 20,
          quality: 70,
          novelty: 50,
          fatigue: 0,
        },
      };
    }

    // Inject raw similarities for client-side use
    if (embeddingSimilarity !== null) matchData.embeddingSimilarity = Math.round(embeddingSimilarity * 100);
    if (recentSimilarity !== null) matchData.recentSimilarity = Math.round(recentSimilarity * 100);
    if (avoidanceSimilarity !== null) matchData.avoidanceSimilarity = Math.round(avoidanceSimilarity * 100);
    if (movieTasteTags.length > 0) matchData.movieTasteTags = movieTasteTags;
    if (movieClusterLabels.length > 0) matchData.clusterLabels = movieClusterLabels;
    if (movieSafetyTags.length > 0) matchData.safetyTags = movieSafetyTags;
    if (movieSuitabilityTags.length > 0) matchData.suitabilityTags = movieSuitabilityTags;
    if (Object.keys(movieSemanticAxes).length > 0) matchData.semanticAxes = movieSemanticAxes;

    return new Response(JSON.stringify(matchData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("movie-match error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
