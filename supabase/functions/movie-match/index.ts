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
    const { movie, userCriteria } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const title = movie.title || movie.name || "Film inconnu";
    const genres = (movie.genres || []).map((g: any) => g.name).join(", ");
    const overview = movie.overview || "";
    const rating = movie.vote_average || 0;
    const runtime = movie.runtime || 0;

    const criteriaText = userCriteria
      ? `L'utilisateur cherchait : humeur "${userCriteria.mood || "non précisée"}", contexte "${userCriteria.context || "non précisé"}", temps "${userCriteria.time || "non précisé"}".`
      : "L'utilisateur a demandé une surprise aléatoire.";

    const systemPrompt = `Tu es un critique de cinéma passionné et empathique. On te donne un film et les préférences d'un utilisateur. Tu dois créer une fiche de match personnalisée et détaillée.

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks
- Le JSON doit avoir cette structure exacte :
{
  "matchScore": <number 70-99>,
  "headline": "<phrase d'accroche percutante, 10 mots max>",
  "whyItMatches": "<2-3 phrases expliquant pourquoi ça correspond à ses critères>",
  "emotionalJourney": "<2-3 phrases décrivant les émotions qu'il va ressentir pendant le visionnage>",
  "perfectFor": "<1 phrase décrivant le moment idéal pour regarder ce film>",
  "funFact": "<1 anecdote intéressante sur le film>"
}
- Sois chaleureux, enthousiaste, personnel
- Parle directement à l'utilisateur (tu/toi)
- Adapte le score au vrai niveau de correspondance`;

    const userPrompt = `Film : "${title}" (${genres}, ${runtime}min, note ${rating}/10)
Synopsis : ${overview}
${criteriaText}

Génère la fiche de match personnalisée.`;

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

    // Parse JSON from response (handle potential markdown wrapping)
    let matchData;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      matchData = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      matchData = {
        matchScore: 85,
        headline: "Un excellent choix pour toi !",
        whyItMatches: "Ce film correspond parfaitement à ce que tu recherches.",
        emotionalJourney: "Prépare-toi à vivre un voyage émotionnel intense.",
        perfectFor: "Idéal pour ce soir.",
        funFact: "Un film qui a marqué des millions de spectateurs.",
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
