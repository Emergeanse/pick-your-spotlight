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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { movie, userCriteria, tasteProfile, userTasteVector, likedMovieTitles } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const title = movie.title || movie.name || "Film inconnu";
    const genres = (movie.genres || []).map((g: any) => g.name).join(", ");
    const overview = movie.overview || "";
    const rating = movie.vote_average || 0;
    const runtime = movie.runtime || 0;
    const tmdbId = movie.id;

    // ── Embedding similarity (new signal) ──
    let embeddingSimilarity: number | null = null;
    let movieTasteTags: string[] = [];

    if (userTasteVector && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get or generate movie embedding
      const { data: movieEmb } = await supabase
        .from("movie_embeddings")
        .select("embedding, taste_tags")
        .eq("tmdb_id", tmdbId)
        .maybeSingle();

      if (movieEmb) {
        // Parse embedding - could be string "[0.1,0.2,...]" or array
        let movieVector: number[];
        if (typeof movieEmb.embedding === "string") {
          movieVector = JSON.parse(movieEmb.embedding.replace(/^\[/, "[").replace(/\]$/, "]"));
        } else {
          movieVector = movieEmb.embedding;
        }
        embeddingSimilarity = cosineSimilarity(userTasteVector, movieVector);
        movieTasteTags = movieEmb.taste_tags || [];
      } else {
        // Generate embedding on-the-fly (fire & forget cache)
        try {
          const embResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              tmdbId,
              title,
              overview,
              genres: (movie.genres || []).map((g: any) => g.name),
            }),
          });
          if (embResponse.ok) {
            const embData = await embResponse.json();
            embeddingSimilarity = cosineSimilarity(userTasteVector, embData.embedding);
            movieTasteTags = embData.tasteTags || [];
          }
        } catch (e) {
          console.error("Embedding generation failed:", e);
        }
      }
    }

    // ── Session context ──
    const criteriaText = userCriteria
      ? `SESSION ACTUELLE : humeur "${userCriteria.mood || "non précisée"}", contexte "${userCriteria.context || "non précisé"}", temps "${userCriteria.time || "non précisé"}".`
      : "L'utilisateur a demandé une surprise aléatoire.";

    // ── Enriched taste context ──
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const confidence = tasteProfile?.confidence || { score: 50 };
    const skipPatterns = tasteProfile?.skipPatterns || {};
    const stats = tasteProfile?.stats || {};
    const topGenres = tasteProfile?.topGenres || [];
    const scoringWeights = tasteProfile?.scoringWeights || {};

    const likedTitlesStr = (likedMovieTitles || []).slice(0, 30).join(", ");

    const tasteSection = tasteProfile ? `
PROFIL DE GOÛTS ENRICHI :
- Genres préférés (pondérés par récence) : ${topGenres.join(", ")}
- Micro-genres / clusters : ${tasteClusters.join(", ") || "non déterminés"}
- Films aimés : ${likedTitlesStr || "aucun encore"}
- ${stats.likeCount || 0} films aimés, ${stats.watchCount || 0} vus, ${stats.skipCount || 0} skippés
- Confiance profil : ${confidence.score}/100
- Taux d'acceptation : ${stats.acceptanceRate || 0}%
${embeddingSimilarity !== null ? `- 🧬 Similarité embedding : ${Math.round(embeddingSimilarity * 100)}% (signal vectoriel)` : ""}
${movieTasteTags.length > 0 ? `- 🏷️ Taste tags du film : ${movieTasteTags.join(", ")}` : ""}
${skipPatterns.avgSkipRate > 0.5 ? `- ⚠️ Skip rate élevé (${Math.round(skipPatterns.avgSkipRate * 100)}%) — l'utilisateur est exigeant` : ""}
${skipPatterns.recentSkipStreak > 2 ? `- ⚠️ ${skipPatterns.recentSkipStreak} skips consécutifs récents` : ""}

SYSTÈME DE SCORING :
Le match score doit refléter ces poids :
- taste_match (${scoringWeights.taste_match || 0.30}) : genres + micro-genres + embedding similarity
- context_match (${scoringWeights.context_match || 0.25}) : session actuelle
- embedding_match (${scoringWeights.embedding_match || 0.15}) : similarité vectorielle du profil de goût${embeddingSimilarity !== null ? ` (score brut: ${Math.round(embeddingSimilarity * 100)})` : ""}
- behaviour_match (${scoringWeights.behaviour_match || 0.10}) : patterns comportementaux
- rating_score (${scoringWeights.rating_score || 0.10}) : note critique
- availability (${scoringWeights.availability || 0.05}) : plateforme
- novelty (${scoringWeights.novelty || 0.05}) : découverte` : "";

    const systemPrompt = `Tu es un moteur de match cinéma de niveau Netflix. On te donne un film, le profil de goûts enrichi d'un utilisateur (incluant un signal de similarité vectorielle), et sa session actuelle. Tu calcules un match score précis et personnalisé.

IMPORTANT : La SESSION prime sur le profil global. Si la session dit "léger" mais le profil aime les thrillers, le match doit refléter la session.
${embeddingSimilarity !== null ? `\nIMPORTANT : Le score de similarité embedding (${Math.round(embeddingSimilarity * 100)}%) est un signal objectif. Utilise-le comme ancrage pour le taste_match. Si embedding > 80%, le film correspond très probablement aux goûts. Si < 40%, il y a un décalage.` : ""}

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks
- Structure :
{
  "matchScore": <number 40-99>,
  "headline": "<phrase d'accroche, 10 mots max>",
  "whyItMatches": "<2-3 phrases personnalisées selon le profil ET la session>",
  "emotionalJourney": "<2-3 phrases sur l'expérience émotionnelle>",
  "perfectFor": "<1 phrase moment idéal>",
  "funFact": "<1 anecdote>",
  "similarLikedMovies": ["<titre exact d'un film aimé similaire>", ...max 3],
  "matchingReasons": ["<raison courte, 2-4 mots>", ...max 4],
  "scores": {
    "taste": <0-100>,
    "context": <0-100>,
    "embedding": <0-100>,
    "behaviour": <0-100>,
    "rating": <0-100>,
    "novelty": <0-100>
  }
}
- "similarLikedMovies" : choisis parmi les films aimés de l'utilisateur ceux qui partagent le plus de similarités (genre, ton, ambiance). Si aucun film aimé, retourne un tableau vide.
- "matchingReasons" : raisons courtes du match (ex: "thriller sombre", "suspense psychologique", "ambiance tendue", "soirée solo"). Inclure le mood de session si pertinent.
- Sois chaleureux et personnel (tu/toi)
- Score calibré : si le film ne colle PAS à la session → 40-60 max, même si le profil global aime ce genre
- Si match parfait session + profil + embedding → 85-99
- Un profil jeune (confiance < 40) = scores plus modérés et nuancés`;

    const userPrompt = `Film : "${title}" (${genres}, ${runtime}min, note ${rating}/10)
Synopsis : ${overview}
${criteriaText}${tasteSection}

Génère la fiche de match.`;

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
        headline: "Un choix intéressant pour toi",
        whyItMatches: "Ce film pourrait correspondre à ce que tu recherches.",
        emotionalJourney: "Une expérience cinématographique à découvrir.",
        perfectFor: "Idéal pour ce soir.",
        funFact: "Un film qui a marqué son genre.",
        scores: { taste: 70, context: 70, embedding: embeddingSimilarity ? Math.round(embeddingSimilarity * 100) : 50, behaviour: 70, rating: 70, novelty: 50 },
      };
    }

    // Inject raw embedding similarity for client-side use
    if (embeddingSimilarity !== null) {
      matchData.embeddingSimilarity = Math.round(embeddingSimilarity * 100);
      matchData.movieTasteTags = movieTasteTags;
    }

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
