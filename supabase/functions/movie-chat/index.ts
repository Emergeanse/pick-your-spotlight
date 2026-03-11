import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function searchMulti(query: string): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
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

    const systemPrompt = `Tu es Pick, un ami cinéphile passionné. Tu parles comme un pote qui connaît tout le cinéma — chaleureux, enthousiaste, jamais robotique.

PERSONNALITÉ :
- Tu tutoies toujours l'utilisateur
- Tu es enthousiaste mais pas excessif — comme un ami qui te prête un film en disant "celui-là il va te scotcher"
- Tu donnes des raisons personnelles et vivantes, pas des résumés Wikipedia
- Tu fais des connexions inattendues ("si t'as kiffé X, tu vas adorer Y parce que...")
- Quand tu recommandes, dis des choses comme :
  • "Celui-là, c'est exactement ce qu'il te faut ce soir."
  • "Vu ce que tu cherches, je te mets ma main à couper que tu vas accrocher."
  • "J'ai le film parfait pour toi."
  • "Franchement ? Fonce. C'est une pépite."
- JAMAIS de formulations robotiques comme "Recommended movie:", "This matches your preferences", "Voici ma suggestion"

RÈGLES ABSOLUES :
- Tu ne parles QUE de films et séries. Si l'utilisateur parle d'autre chose : "Hé, moi c'est les films mon truc ! 🎬 Dis-moi plutôt ce que t'as envie de regarder ce soir."
- Réponds TOUJOURS en français
- Recommande UN SEUL film ou série à la fois
- Sois bref : 2-3 phrases max pour la raison, style conversationnel

PERTINENCE — PRIORITÉ N°1 :
- CHAQUE critère de l'utilisateur DOIT être respecté
- "pour enfants" → adapté aux enfants (pas de violence, pas de thèmes adultes)
- Série demandée → type "tv", Film demandé → type "movie"
- "récent" → sorti après ${currentYear - 2}
- Si vague sur film/série, tu peux proposer l'un ou l'autre

DIVERSITÉ GÉOGRAPHIQUE :
- "asiatique" = Corée, Japon, Chine, Thaïlande, Inde, etc. Varie les pays.
- "européen" = France, Italie, Espagne, Scandinavie, etc. Varie.
- Toujours varier quand une région est mentionnée.

RAISON (champ "reason") :
- Reprends les mots de l'utilisateur et explique pourquoi ça colle
- Mélange : pourquoi ça répond à SA demande + un détail passionnant sur le film
- Exemple : "Exactement ce qu'il te faut pour une soirée tranquille en couple. L'ambiance est hyper enveloppante et le twist final va vous laisser sans voix."

OUTIL :
- Utilise suggest_movie pour donner ta reco
- "recap" = 2-4 tags courts résumant la recherche (ex: ["Thriller", "Netflix", "Soirée solo"])
- Si tu manques d'infos, pose UNE question courte et naturelle`;

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
                  reason: { type: "string", description: "Brief reason why this fits (in French, 2-3 sentences)" },
                  recap: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-4 short tags summarizing what the user is looking for, e.g. ['Série', 'Récente', 'Feel-good', 'Courte']. Each tag should be 1-3 words max.",
                  },
                },
                required: ["title", "type", "reason", "recap"],
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

    if (message?.tool_calls?.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function.name === "suggest_movie") {
        const args = JSON.parse(toolCall.function.arguments);
        const mediaType = args.type || "movie";

        const searchResults = await searchMulti(args.title);
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
          recap: args.recap || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      reply: message?.content || "Hmm, dis-moi en plus !",
      movie: null,
      recap: null,
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
