import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

// Search both movies and TV shows via multi-search
async function searchMulti(query: string): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  // Only keep movies and TV shows
  return (data.results || [])
    .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10);
}

async function getMovieDetails(id: number): Promise<any> {
  const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const res = await fetch(url);
  return res.json();
}

async function getTVDetails(id: number): Promise<any> {
  const url = `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const res = await fetch(url);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentYear = new Date().getFullYear();

    const systemPrompt = `Tu es un assistant spécialisé UNIQUEMENT dans la recommandation de films et séries. Tu es chaleureux et passionné de cinéma.

RÈGLES ABSOLUES :
- Tu ne réponds QU'AUX demandes liées aux films et séries (recommandations, suggestions, aide au choix)
- Si l'utilisateur parle d'autre chose, réponds poliment : "Je suis spécialisé dans les films et séries 🎬 Dis-moi plutôt ce que tu as envie de regarder !"
- Réponds TOUJOURS en français
- Recommande UN SEUL film ou série à la fois
- Sois bref et enthousiaste (3-4 phrases max)
- Explique pourquoi ce film/série correspond à son humeur/envie

RÈGLES DE PERTINENCE CRITIQUES :
- Si l'utilisateur demande une SÉRIE, recommande OBLIGATOIREMENT une série TV (type "tv"), PAS un film
- Si l'utilisateur demande un FILM, recommande OBLIGATOIREMENT un film (type "movie"), PAS une série
- Si l'utilisateur dit "récent" ou "récente", recommande quelque chose sorti après ${currentYear - 2} (${currentYear - 2} ou plus récent)
- Si l'utilisateur mentionne une décennie (ex: "années 80"), respecte scrupuleusement cette période
- Si l'utilisateur est vague sur film/série, tu peux proposer l'un ou l'autre
- RESPECTE TOUJOURS les critères explicites de l'utilisateur : année, genre, durée, ambiance, plateforme

OUTIL :
- Utilise l'outil suggest_movie pour donner ta recommandation
- Mets le bon type ("movie" ou "tv") selon ce que tu recommandes
- Si l'utilisateur est vague ou que tu manques d'infos, pose UNE question courte pour mieux cerner son envie`;

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
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_movie",
              description: "Suggest a movie or TV show to the user. Call this when you have a recommendation.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "The movie or TV show title to search for" },
                  type: { type: "string", enum: ["movie", "tv"], description: "Whether this is a movie or a TV series" },
                  reason: { type: "string", description: "Brief reason why this fits the user's request (in French)" },
                },
                required: ["title", "type", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const choice = aiData.choices?.[0];
    const message = choice?.message;

    // Check if AI wants to call the suggest_movie tool
    if (message?.tool_calls?.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function.name === "suggest_movie") {
        const args = JSON.parse(toolCall.function.arguments);
        const mediaType = args.type || "movie";

        // Search TMDB using multi-search
        const searchResults = await searchMulti(args.title);

        // Prefer results matching the requested media type
        const preferredResults = searchResults.filter((r: any) => r.media_type === mediaType);
        const bestMatch = preferredResults.length > 0 ? preferredResults[0] : searchResults[0];

        let detail = null;
        if (bestMatch) {
          if (bestMatch.media_type === "tv") {
            detail = await getTVDetails(bestMatch.id);
          } else {
            detail = await getMovieDetails(bestMatch.id);
          }
        }

        return new Response(JSON.stringify({
          reply: args.reason,
          movie: detail,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Regular text response (e.g., asking a follow-up question)
    return new Response(JSON.stringify({
      reply: message?.content || "Hmm, dis-moi en plus !",
      movie: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("movie-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
