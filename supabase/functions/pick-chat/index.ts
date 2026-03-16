import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function searchMulti(query: string): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1&region=FR`;
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
    const body = await req.json();
    const { messages, mode, movieTitle, movieYear, movieOverview, spoilerMode, movieProgress } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentYear = new Date().getFullYear();

    // Build system prompt based on mode
    let systemPrompt: string;

    if (mode === "companion" && movieTitle) {
      // --- COMPANION MODE ---
      let spoilerInstruction = "NE JAMAIS révéler de spoilers.";
      if (spoilerMode === "up-to-current") {
        spoilerInstruction = `L'utilisateur est à la phase "${movieProgress}" du film. Tu peux discuter de ce qui s'est passé AVANT ce point mais JAMAIS révéler ce qui arrive APRÈS.`;
      } else if (spoilerMode === "full-spoilers") {
        spoilerInstruction = `L'utilisateur accepte les spoilers. Tu peux discuter librement de TOUT le film.`;
      }

      systemPrompt = `Tu es Pick, un compagnon de visionnage pour "${movieTitle}" (${movieYear}).

Synopsis : ${movieOverview || "Non disponible"}

${spoilerInstruction}

Tu es chaleureux, passionné de cinéma, et tu parles comme un ami cinéphile. Tes réponses sont COURTES (2-3 phrases max sauf si l'utilisateur demande plus de détails).

CE QUE TU PEUX FAIRE :
- Partager des anecdotes de tournage, des faits sur les acteurs, le réalisateur
- Expliquer le contexte culturel ou historique
- Parler de la musique, de la bande-son
- Expliquer des scènes (en respectant le mode spoiler)
- Donner des infos sur les lieux de tournage
- Comparer avec d'autres films similaires
- Répondre aux questions sur les acteurs
- Expliquer comment fonctionne l'application Pick (voir section APP ci-dessous)

${getAppKnowledgeSection()}

HORS SUJET :
- Si l'utilisateur parle de quelque chose qui n'a AUCUN rapport avec le cinéma, les séries, ou l'application Pick, refuse poliment : "Moi c'est le ciné et Pick, mon domaine ! 🎬 Pose-moi une question sur le film ou l'appli."

STYLE :
- Utilise des emojis avec modération (1-2 par message max)
- Tutoie toujours l'utilisateur
- Réponds TOUJOURS en français`;

    } else {
      // --- DISCOVERY / GENERAL MODE ---
      systemPrompt = `Tu es Pick, l'assistant intelligent de l'application Pick — une appli de recommandation de films et séries.

Tu es un ami cinéphile passionné, chaleureux et drôle. Tu tutoies toujours l'utilisateur.

TU SAIS TOUT FAIRE (dans ton domaine) :

1. RECOMMANDER des films/séries — Si l'utilisateur donne une humeur, un genre, un contexte ou n'importe quel signal, utilise l'outil suggest_movie pour recommander.
2. RÉPONDRE à des questions sur le cinéma — acteurs, réalisateurs, anecdotes, histoire du cinéma, oscars, festivals, techniques de tournage, etc.
3. EXPLIQUER l'application Pick — comment elle marche, ses fonctionnalités, Pick+, etc.
4. COMPARER des films, donner ton avis, discuter de cinéma en général.

${getAppKnowledgeSection()}

RÈGLE CRITIQUE — RECOMMANDATION :
Recommande immédiatement (appelle suggest_movie) si l'utilisateur donne AU MOINS UN signal :
- Une humeur ("fatigué", "envie de rigoler", "intense")
- Un contexte ("avec ma copine", "entre potes", "seul")
- Un genre ("thriller", "comédie", "SF")
- Une référence ("comme Inception", "style Tarantino")
- Une demande même vague ("un bon film", "quelque chose de bien", "un truc ce soir")

Pose une question UNIQUEMENT si le message ne contient AUCUN signal (ex: juste "Salut").
Maximum 1 question avant de proposer un film.

DÉTECTION D'HUMEUR (priorité maximale) :
- "fatigué/crevé" → films doux, réconfortants
- "rire/rigoler" → comédies
- "intense/puissant" → thrillers, drames forts
- "retourner le cerveau" → SF cérébrale, films à twist
- "pleurer/émouvant" → drames touchants
- "léger/chill" → comédies légères, romcoms
- "peur/flipper" → horreur

L'humeur FILTRE les genres. "Fatigué" + "bon film" ≠ thriller intense.

HORS SUJET :
- Si l'utilisateur parle de quelque chose qui n'a AUCUN rapport avec le cinéma, les séries, la culture audiovisuelle ou l'application Pick → refuse poliment : "Hé, moi c'est le ciné et Pick, mon domaine ! 🎬 Dis-moi plutôt ce que t'as envie de regarder."
- Exemples de hors sujet : maths, cuisine, sport, politique, code, météo, etc.
- Exemples OK : acteurs, réalisateurs, oscars, anecdotes de films, techniques cinéma, son Dolby, IMAX, plateformes de streaming, etc.

STYLE :
- Tutoie toujours
- 2-3 phrases max, conversationnel
- Emojis avec modération (1-2 max)
- Réponds TOUJOURS en français
- Jamais de formulations robotiques

ANNÉE EN COURS : ${currentYear}`;
    }

    // Decide if we need tools (only in discovery mode for reco)
    const tools = mode !== "companion" ? [
      {
        type: "function",
        function: {
          name: "suggest_movie",
          description: "Suggest a movie or TV show to the user.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "The movie or TV show title to search for" },
              type: { type: "string", enum: ["movie", "tv"] },
              reason: { type: "string", description: "Brief reason why this fits (in French, 2-3 sentences)" },
              recap: {
                type: "array",
                items: { type: "string" },
                description: "2-4 short tags summarizing the search",
              },
            },
            required: ["title", "type", "reason", "recap"],
            additionalProperties: false,
          },
        },
      },
    ] : undefined;

    const useStreaming = mode === "companion";

    const aiBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: useStreaming,
    };
    if (tools) aiBody.tools = tools;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming mode (companion) — pass through SSE
    if (useStreaming) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming mode (discovery) — handle tool calls
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
          detail = bestMatch.media_type === "tv"
            ? await getTVDetails(bestMatch.id)
            : await getMovieDetails(bestMatch.id);
        }

        return new Response(JSON.stringify({
          type: "recommendation",
          reply: args.reason,
          movie: detail,
          recap: args.recap || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      type: "text",
      reply: message?.content || "Hmm, dis-moi en plus !",
      movie: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pick-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getAppKnowledgeSection(): string {
  return `
CONNAISSANCES SUR L'APPLICATION PICK :
Pick est une application de recommandation de films et séries personnalisée. Voici ses fonctionnalités :

- **Page d'accueil** : L'utilisateur peut lancer une recherche guidée (humeur → contexte → durée → plateformes) ou parler directement à Pick via le chat.
- **Recommandation guidée** : Pick pose 4 questions rapides puis propose LE film parfait avec une fiche détaillée (note, synopsis, plateformes de streaming, bande-annonce).
- **Watchlist** : L'utilisateur peut sauvegarder des films pour plus tard. Accessible depuis la barre de navigation.
- **Mon Cinéma** : Section profil cinématographique avec les films aimés, l'ADN cinématique de l'utilisateur, et des statistiques.
- **Mode Compagnon** : Quand l'utilisateur choisit de regarder un film, Pick devient un compagnon de visionnage — il peut répondre à des questions sur le film en cours, partager des anecdotes, expliquer des scènes, etc.
- **Pick+** : Version premium (2,49€/mois) avec recommandations illimitées, questions compagnon illimitées, ADN cinématique avancé, et alertes plateforme.
- **Version gratuite** : 3 recommandations/jour et 1 question compagnon par film.
- **Profil** : L'utilisateur peut configurer ses plateformes de streaming préférées, ses genres favoris/exclus, et activer le rituel du soir.

Si l'utilisateur demande comment faire quelque chose dans l'appli, explique-lui clairement en le guidant vers la bonne section.`;
}
