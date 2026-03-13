import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function getMovieDetails(id: number): Promise<any> {
  const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const res = await fetch(url);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { likedMovies, tasteProfile, userTasteVector, platformIds } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const titles = (likedMovies || []).map((m: any) => m.title).slice(0, 20);
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
        const excludeIds = (likedMovies || []).map((m: any) => m.tmdb_id || m.id);
        const vectorStr = `[${userTasteVector.join(",")}]`;
        
        const { data: matches } = await supabase.rpc("match_movies_by_taste", {
          query_vector: vectorStr,
          match_count: 10,
          exclude_ids: excludeIds,
        });

        if (matches && matches.length > 0) {
          embeddingCandidates = matches
            .filter((m: any) => m.similarity > 0.7)
            .map((m: any) => `${m.title} (similarité: ${Math.round(m.similarity * 100)}%, tags: ${(m.taste_tags || []).join(", ")})`);
        }
      } catch (e) {
        console.error("Embedding search failed:", e);
      }
    }

    // ── Extract enriched profile data ──
    const confidence = tasteProfile?.confidence || { score: 50, discoveryRatio: 0.2 };
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const skipPatterns = tasteProfile?.skipPatterns || {};
    const stats = tasteProfile?.stats || {};
    const session = tasteProfile?.session || {};
    const scoringWeights = tasteProfile?.scoringWeights || {};
    const acceptanceRate = stats.acceptanceRate || 0;

    const shouldDiscover = Math.random() < confidence.discoveryRatio;

    const skipInsights = skipPatterns.avgSkipRate > 0.6
      ? "L'utilisateur skip souvent — sois plus sélectif et surprenant."
      : skipPatterns.recentSkipStreak > 3
        ? "L'utilisateur vient de skip plusieurs films d'affilée — change radicalement de direction."
        : "";

    const embeddingSection = embeddingCandidates.length > 0
      ? `\n\nFILMS SIMILAIRES PAR EMBEDDING (du plus proche au moins proche) :\n${embeddingCandidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}\nCes films ont été trouvés par similarité vectorielle avec le profil de goût. Tu peux en recommander un ou t'en inspirer pour trouver un film encore meilleur.`
      : "";

    const systemPrompt = `Tu es un moteur de recommandation cinéma de niveau Netflix. Tu combines plusieurs signaux pour trouver LE film parfait.

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
${embeddingSection}

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide sans backticks
- Structure : {"title": "<titre exact>", "reason": "<2-3 phrases>", "confidence": <0-100>, "scores": {"taste": <0-100>, "context": <0-100>, "embedding": <0-100>, "behaviour": <0-100>, "rating": <0-100>, "novelty": <0-100>}}
- Ne recommande JAMAIS un film déjà dans la liste
- ${shouldDiscover ? "MODE DÉCOUVERTE : propose une pépite inattendue, un micro-genre adjacent, ou un film sous-estimé. Surprends." : "MODE PRÉCISION : colle au plus près des micro-genres et clusters identifiés. Si des candidats par embedding sont disponibles, privilégie-les."}
- Calibre le score de confiance selon la qualité du match`;

    const userPrompt = `Films aimés (${titles.length}, pondérés par récence) : ${titles.join(", ")}
Genres préférés (pondérés) : ${topGenres.join(", ")}
Micro-genres : ${tasteClusters.join(", ") || "à déduire des films aimés"}
Films regardés : ${stats.watchCount || 0} | Films skippés : ${stats.skipCount || 0}
${shouldDiscover ? "→ MODE DÉCOUVERTE" : "→ MODE PRÉCISION"}

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

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    let suggestion;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestion = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI suggestion");
    }

    // Search TMDB
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(suggestion.title)}&page=1`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const results = searchData.results || [];

    if (results.length === 0) {
      throw new Error("Movie not found on TMDB");
    }

    const movieDetail = await getMovieDetails(results[0].id);

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
          title: movieDetail.title,
          overview: movieDetail.overview,
          genres: (movieDetail.genres || []).map((g: any) => g.name),
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      movie: movieDetail,
      reason: suggestion.reason,
      confidence: suggestion.confidence || 75,
      isDiscovery: shouldDiscover,
      scores: suggestion.scores || null,
      engineMeta: {
        profileConfidence: confidence.score,
        discoveryRatio: confidence.discoveryRatio,
        acceptanceRate,
        mode: shouldDiscover ? "discovery" : "precision",
        embeddingCandidatesCount: embeddingCandidates.length,
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
