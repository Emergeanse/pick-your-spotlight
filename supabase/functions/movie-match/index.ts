import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { movie, userCriteria, tasteProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const title = movie.title || movie.name || "Film inconnu";
    const genres = (movie.genres || []).map((g: any) => g.name).join(", ");
    const overview = movie.overview || "";
    const rating = movie.vote_average || 0;
    const runtime = movie.runtime || 0;

    // ── Session context (takes priority over global profile) ──
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

    const tasteSection = tasteProfile ? `
PROFIL DE GOÛTS ENRICHI :
- Genres préférés (pondérés par récence) : ${topGenres.join(", ")}
- Micro-genres / clusters : ${tasteClusters.join(", ") || "non déterminés"}
- ${stats.likeCount || 0} films aimés, ${stats.watchCount || 0} vus, ${stats.skipCount || 0} skippés
- Confiance profil : ${confidence.score}/100
- Taux d'acceptation : ${stats.acceptanceRate || 0}%
${skipPatterns.avgSkipRate > 0.5 ? `- ⚠️ Skip rate élevé (${Math.round(skipPatterns.avgSkipRate * 100)}%) — l'utilisateur est exigeant` : ""}
${skipPatterns.recentSkipStreak > 2 ? `- ⚠️ ${skipPatterns.recentSkipStreak} skips consécutifs récents` : ""}

SYSTÈME DE SCORING :
Le match score doit refléter ces poids :
- taste_match (${scoringWeights.taste_match || 0.35}) : genres + micro-genres
- context_match (${scoringWeights.context_match || 0.25}) : session actuelle
- behaviour_match (${scoringWeights.behaviour_match || 0.15}) : patterns comportementaux
- rating_score (${scoringWeights.rating_score || 0.10}) : note critique
- availability (${scoringWeights.availability || 0.10}) : plateforme
- novelty (${scoringWeights.novelty || 0.05}) : découverte` : "";

    const systemPrompt = `Tu es un moteur de match cinéma de niveau Netflix. On te donne un film, le profil de goûts enrichi d'un utilisateur, et sa session actuelle. Tu calcules un match score précis et personnalisé.

IMPORTANT : La SESSION prime sur le profil global. Si la session dit "léger" mais le profil aime les thrillers, le match doit refléter la session.

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
  "scores": {
    "taste": <0-100>,
    "context": <0-100>,
    "behaviour": <0-100>,
    "rating": <0-100>,
    "novelty": <0-100>
  }
}
- Sois chaleureux et personnel (tu/toi)
- Score calibré : si le film ne colle PAS à la session → 40-60 max, même si le profil global aime ce genre
- Si match parfait session + profil → 85-99
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
        scores: { taste: 70, context: 70, behaviour: 70, rating: 70, novelty: 50 },
      };
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
