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

    const systemPrompt = `Tu es un assistant spécialisé UNIQUEMENT dans la recommandation de films et séries. Tu es chaleureux et passionné de cinéma.

RÈGLES ABSOLUES :
- Tu ne réponds QU'AUX demandes liées aux films et séries
- Si l'utilisateur parle d'autre chose, réponds poliment : "Je suis spécialisé dans les films et séries 🎬 Dis-moi plutôt ce que tu as envie de regarder !"
- Réponds TOUJOURS en français
- Recommande UN SEUL film ou série à la fois
- Sois bref et enthousiaste (2-3 phrases max pour la raison)

RÈGLES DE PERTINENCE — C'EST LA PRIORITÉ NUMÉRO 1 :
- CHAQUE critère de l'utilisateur DOIT être respecté. Si l'utilisateur dit "pour enfants", le film DOIT être adapté aux enfants (pas de violence, pas de thèmes adultes).
- Si l'utilisateur demande une SÉRIE → type "tv", PAS un film
- Si l'utilisateur demande un FILM → type "movie", PAS une série
- "récent" ou "récente" → sorti après ${currentYear - 2}
- Si l'utilisateur est vague sur film/série, tu peux proposer l'un ou l'autre

RÈGLES SUR LES ORIGINES GÉOGRAPHIQUES :
- "asiatique" = Chine, Corée du Sud, Japon, Thaïlande, Inde, Vietnam, Philippines, Taïwan, Hong Kong, etc. NE PAS toujours proposer du japonais. Varie les pays.
- "européen" = France, Italie, Espagne, Allemagne, UK, Scandinavie, etc. Varie les pays.
- "africain" = tous les pays d'Afrique. Varie.
- "latino" ou "sud-américain" = Mexique, Brésil, Argentine, Colombie, etc. Varie.
- De manière générale, quand l'utilisateur mentionne une RÉGION, propose des films de DIFFÉRENTS PAYS de cette région, pas toujours le même.

RÈGLES SUR LE PUBLIC CIBLE :
- "pour enfants" ou "adapté aux enfants" ou "familial" → le film doit être RÉELLEMENT adapté aux enfants. Pas de violence, pas de sang, pas de thèmes adultes (drogue, crime, sexe).
- "pas un dessin animé" ou "pas d'animation" → le film doit être en prises de vues réelles (live action), PAS un film d'animation
- Vérifie mentalement que ta suggestion respecte TOUS les critères avant de la proposer

OUTIL :
- Utilise l'outil suggest_movie pour donner ta recommandation
- Le champ "recap" doit contenir 2 à 4 critères courts résumant ce que l'utilisateur recherche (ex: ["Série", "Récente", "Feel-good", "Courte"])
- Si tu manques d'infos, pose UNE question courte`;

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
