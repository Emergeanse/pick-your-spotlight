import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function searchTMDB(query: string): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).slice(0, 5);
}

async function getMovieDetails(id: number): Promise<any> {
  const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const res = await fetch(url);
  return res.json();
}

async function discoverMovies(genres: string, sortBy = "popularity.desc"): Promise<any[]> {
  const page = Math.floor(Math.random() * 3) + 1;
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&with_genres=${genres}&sort_by=${sortBy}&vote_average.gte=6&vote_count.gte=100&page=${page}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).sort(() => Math.random() - 0.5).slice(0, 5);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un expert cinéma francophone chaleureux et passionné. L'utilisateur te parle de son humeur, de ce qu'il veut regarder, ou de comment il se sent. Tu dois lui recommander UN film précis.

RÈGLES IMPORTANTES :
- Réponds TOUJOURS en français
- Recommande UN SEUL film à la fois
- Sois bref et enthousiaste (3-4 phrases max)
- Explique pourquoi ce film correspond à son humeur/envie
- Utilise l'outil suggest_movie pour donner ta recommandation
- Si l'utilisateur est vague, pose UNE question courte pour mieux comprendre
- Sois chaleureux, comme un ami cinéphile`;

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
              description: "Suggest a movie to the user. Call this when you have a recommendation.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "The movie title to search for" },
                  reason: { type: "string", description: "Brief reason why this movie fits (in French)" },
                },
                required: ["title", "reason"],
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
        
        // Search TMDB for the movie
        const searchResults = await searchTMDB(args.title);
        let movieDetail = null;
        
        if (searchResults.length > 0) {
          movieDetail = await getMovieDetails(searchResults[0].id);
        }

        return new Response(JSON.stringify({
          reply: args.reason,
          movie: movieDetail,
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
