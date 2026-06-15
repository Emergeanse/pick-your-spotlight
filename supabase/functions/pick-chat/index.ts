import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";


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
  const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits,watch/providers,videos`;
  const res = await fetch(url);
  return res.json();
}

async function getTVDetails(id: number): Promise<any> {
  const url = `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits,watch/providers,videos`;
  const res = await fetch(url);
  return res.json();
}

async function getSimilarMovies(id: number, mediaType: string, minRating: number, count: number = 4): Promise<any[]> {
  const endpoint = mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${endpoint}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=fr-FR&page=1&watch_region=FR`;
  const res = await fetch(url);
  const data = await res.json();
  const candidates = (data.results || [])
    .filter((r: any) => (r.vote_average || 0) >= (minRating > 0 ? minRating - 0.5 : 0))
    .slice(0, count);
  
  const details = await Promise.all(
    candidates.map((c: any) =>
      (c.media_type === "tv" || mediaType === "tv" ? getTVDetails(c.id) : getMovieDetails(c.id))
    )
  );
  return details.filter((d: any) => d && (d.title || d.name));
}

// Discover high-rated movies from TMDB as fallback
async function discoverHighRated(minRating: number, mediaType: string = "movie"): Promise<any[]> {
  const endpoint = mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/discover/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_average.gte=${minRating}&vote_count.gte=200&page=${Math.floor(Math.random() * 3) + 1}&watch_region=FR`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;
    const body = await req.json();
    const {
      messages, mode, movieTitle, movieYear, movieOverview, spoilerMode, movieProgress,
      minRating: userMinRating, excludedGenres, isPremium, timeContext,
      tasteClusters, rejectedClusters, likedMovieTitles, likedOrigins, excludedOrigins, confidence,
      voiceMode,
    } = body;

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY is not configured");

    const currentYear = new Date().getFullYear();
    const effectiveMinRating = userMinRating || 0;
    const RATING_TOLERANCE = 0.5;

    // Time-aware instruction from client
    const timeInstruction = timeContext ? `\n\nCONTEXTE TEMPOREL : ${timeContext}` : "";

    // Build taste profile block from enriched voice context
    const tasteProfileNote = (() => {
      const lines: string[] = [];
      if (likedMovieTitles?.length > 0) lines.push(`- Films aimés : ${likedMovieTitles.slice(0, 8).join(", ")}`);
      if (tasteClusters?.length > 0) lines.push(`- Styles favoris : ${tasteClusters.join(", ")}`);
      if (rejectedClusters?.length > 0) lines.push(`- ⛔ Styles à éviter absolument : ${rejectedClusters.join(", ")}`);
      if (likedOrigins?.length > 0) lines.push(`- Cinémas préférés : ${likedOrigins.join(", ")}`);
      if (excludedOrigins?.length > 0) lines.push(`- ⛔ Cinémas à éviter : ${excludedOrigins.join(", ")}`);
      if (confidence) lines.push(`- Confiance profil : ${confidence}/100`);
      return lines.length > 0 ? `\nPROFIL CINÉPHILE PERSONNALISÉ :\n${lines.join("\n")}\nUtilise ce profil pour orienter ta recommandation même si l'utilisateur ne le mentionne pas explicitement.` : "";
    })();

    // Build rating instruction for the prompt
    let ratingInstruction = "";
    if (effectiveMinRating > 0) {
      ratingInstruction = `\n\nRÈGLE NOTE MINIMALE — TRÈS IMPORTANT :
L'utilisateur a configuré une note minimale de ${effectiveMinRating}/10 dans ses préférences.
Tu DOIS recommander UNIQUEMENT des films/séries ayant une note TMDB d'au moins ${effectiveMinRating}/10.
Si l'utilisateur demande explicitement une note dans son message (ex: "au moins 8/10"), utilise la note la plus élevée entre sa demande et ses préférences.
Ne propose JAMAIS un film en dessous de cette note. C'est une règle stricte.`;
    }

    // Build excluded genres instruction
    let genreInstruction = "";
    if (excludedGenres && excludedGenres.length > 0) {
      genreInstruction = `\nGENRES À ÉVITER ABSOLUMENT : ${excludedGenres.join(", ")}. Ne recommande JAMAIS de films de ces genres.`;
    }

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

    } else if (isPremium) {
      // --- PICK+ FULL CHATBOT MODE ---
      systemPrompt = `Tu es Pick, l'assistant intelligent de l'application Pick — une appli de recommandation de films et séries.

Tu es un ami cinéphile passionné, chaleureux et drôle. Tu tutoies toujours l'utilisateur.

TU SAIS TOUT FAIRE (dans ton domaine) :

1. RECOMMANDER des films/séries — Si l'utilisateur donne une humeur, un genre, un contexte ou n'importe quel signal, utilise l'outil suggest_movie pour recommander.
2. RÉPONDRE à des questions sur le cinéma — acteurs, réalisateurs, anecdotes, histoire du cinéma, oscars, festivals, techniques de tournage, etc.
3. EXPLIQUER l'application Pick — comment elle marche, ses fonctionnalités, Pick+, etc.
4. COMPARER des films, donner ton avis, discuter de cinéma en général.

${getAppKnowledgeSection()}
${tasteProfileNote}
${ratingInstruction}
${genreInstruction}

CHOIX D'OUTIL — IMPORTANT :
- L'utilisateur cite un titre précis, un réalisateur ou acteur précis → suggest_movie
- L'utilisateur décrit des CRITÈRES (genre, langue/origine, durée, type) → extract_search_intent
- L'utilisateur est vague ou exprime une humeur → suggest_movie (le moteur SQL adaptera)
- L'utilisateur mélange titre + critères → priorité à extract_search_intent si les critères sont les plus importants

RÈGLE CRITIQUE — RECOMMANDATION :
Appelle un outil immédiatement si l'utilisateur donne AU MOINS UN signal :
- Une humeur ("fatigué", "envie de rigoler", "intense") → suggest_movie
- Un contexte SOLO ("seul ce soir", "rien à faire") → suggest_movie
- Un genre/origine/durée ("thriller", "film français", "moins de 2h") → extract_search_intent
- Une référence ("comme Inception", "style Tarantino") → suggest_movie
- Une demande même vague ("un bon film", "quelque chose de bien", "un truc ce soir") → suggest_movie

RÈGLE GROUPE — TRÈS IMPORTANT :
Si l'utilisateur mentionne qu'il est avec d'autres personnes (copine, potes, famille, groupe, "on est deux/trois/plusieurs", "soirée entre amis", "avec ma meuf", "entre potes"...), appelle l'outil suggest_pick_together au lieu de suggest_movie. Le mode Pick Together est conçu pour les groupes.

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
- Si l'utilisateur parle de quelque chose qui n'a AUCUN rapport avec le cinéma, les séries, ou l'application Pick → refuse poliment : "Hé, moi c'est le ciné et Pick, mon domaine ! 🎬 Dis-moi plutôt ce que t'as envie de regarder."

STYLE :
- Tutoie toujours
- 2-3 phrases max, conversationnel
- Emojis avec modération (1-2 max)
- Réponds TOUJOURS en français
- Jamais de formulations robotiques

ANNÉE EN COURS : ${currentYear}${timeInstruction}`;

    } else {
      // --- FREE USER: DISCOVERY ONLY MODE ---
      systemPrompt = `Tu es Pick, l'assistant de l'application Pick — une appli de recommandation de films et séries.

Tu es un ami cinéphile chaleureux. Tu tutoies toujours l'utilisateur.

TON UNIQUE MISSION : Aider l'utilisateur à trouver LE film ou LA série parfait(e) à regarder.

Tu dois :
1. Comprendre rapidement l'humeur, le contexte et les envies de l'utilisateur
2. Poser 1-2 questions courtes si nécessaire pour cerner ce qu'il cherche
3. Proposer un film/série via suggest_movie
${tasteProfileNote}
${ratingInstruction}
${genreInstruction}

RÈGLE CRITIQUE : Tu fais de la recommandation de films et séries uniquement.
- Si l'utilisateur pose des questions sur le cinéma → réponds gentiment : "Super question ! 🎬 Avec Pick+, tu pourras me poser toutes tes questions ciné. Pour l'instant, dis-moi ce que t'as envie de regarder !"
- Si l'utilisateur parle de hors-sujet → "Hé, moi c'est trouver ton film ! 🎬 Dis-moi ton humeur."

CHOIX D'OUTIL :
- Critères (genre, langue, durée, type) → extract_search_intent
- Titre précis / humeur / demande vague → suggest_movie

Appelle un outil immédiatement si l'utilisateur donne AU MOINS UN signal.

RÈGLE GROUPE — TRÈS IMPORTANT :
Si l'utilisateur mentionne qu'il est avec d'autres personnes (copine, potes, famille, groupe, "on est deux/trois/plusieurs", "soirée entre amis", "avec ma meuf", "entre potes"...), appelle l'outil suggest_pick_together au lieu de suggest_movie.

Pose une question UNIQUEMENT si le message ne contient AUCUN signal.
Maximum 1 question avant de proposer.

DÉTECTION D'HUMEUR :
- "fatigué/crevé" → films doux, réconfortants
- "rire/rigoler" → comédies
- "intense/puissant" → thrillers, drames forts
- "retourner le cerveau" → SF cérébrale, films à twist
- "pleurer/émouvant" → drames touchants
- "léger/chill" → comédies légères, romcoms
- "peur/flipper" → horreur

STYLE :
- Tutoie toujours
- 2-3 phrases max, direct et efficace
- Emojis avec modération (1-2 max)
- Réponds TOUJOURS en français

ANNÉE EN COURS : ${currentYear}${timeInstruction}`;
    }

    // Decide if we need tools (only in discovery mode for reco)
    const tools = mode !== "companion" ? [
      {
        type: "function",
        function: {
          name: "suggest_movie",
          description: "Suggest a specific movie or TV show by title. Use this when the user mentions a specific title, director, or actor they want something similar to. IMPORTANT: only suggest titles rated above the user's minimum rating preference.",
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
      {
        type: "function",
        function: {
          name: "extract_search_intent",
          description: "Utilise cet outil quand l'utilisateur décrit des CRITÈRES généraux (genre, langue/origine, durée, type film/série) SANS mentionner un titre précis. Les critères énoncés remplacent le profil utilisateur de façon exclusive, ceux non mentionnés restent aux valeurs du profil. Exemples : 'un film d'action français' → genres=['Action'], originalLanguage='fr' / 'une série coréenne' → mediaType='tv', originalLanguage='ko' / 'un film court ce soir' → maxDuration=90.",
          parameters: {
            type: "object",
            properties: {
              genres: {
                type: "array",
                items: { type: "string" },
                description: "Genres demandés en français. Valeurs valides UNIQUEMENT : Action, Aventure, Animation, Comédie, Crime, Documentaire, Drame, Famille, Fantastique, Histoire, Horreur, Musique, Mystère, Romance, Science-Fiction, Thriller, Guerre, Western. null si aucun genre mentionné.",
              },
              originalLanguage: {
                type: "string",
                description: "Code ISO 639-1 si une langue/origine est mentionnée : 'fr' (français/franco), 'en' (anglais/américain/britannique), 'ko' (coréen), 'ja' (japonais/anime), 'zh' (chinois), 'es' (espagnol/latino), 'pt' (portugais/brésilien). null si non mentionné.",
              },
              mediaType: {
                type: "string",
                enum: ["movie", "tv"],
                description: "'movie' si l'utilisateur dit 'film', 'tv' si 'série'. Omis si non précisé.",
              },
              maxDuration: {
                type: "number",
                description: "Durée maximale en minutes si mentionnée. Exemples : 'court' ou 'pas trop long' → 95, '2h' → 120, '1h30' → 90, 'marathon' → null. null si non mentionné.",
              },
              decade: {
                type: "number",
                description: "Décennie de sortie si mentionnée. Exemples : 'années 80' → 1980, 'années 90' → 1990, 'années 70' → 1970, 'récent' ou 'moderne' → null. null si non mentionné.",
              },
              recap: {
                type: "array",
                items: { type: "string" },
                description: "2-4 tags courts résumant la demande vocale pour l'interface (ex: ['Action', 'Français', 'Court'])",
              },
            },
            required: ["recap"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "suggest_pick_together",
          description: "Propose le mode Pick Together quand l'utilisateur mentionne qu'il est avec d'autres personnes (copine, potes, famille, groupe, 'on est deux/trois/plusieurs', soirée entre amis, etc.)",
          parameters: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message amical en français expliquant que Pick Together est parfait pour eux" },
            },
            required: ["message"],
            additionalProperties: false,
          },
        },
      },
    ] : undefined;

    const useStreaming = mode === "companion";

    const aiBody: any = {
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: useStreaming,
    };
    if (tools) aiBody.tools = tools;
    // En mode vocal : forcer extract_search_intent — le LLM ne doit JAMAIS inventer un titre
    if (voiceMode && tools) {
      aiBody.tool_choice = { type: "function", function: { name: "extract_search_intent" } };
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_KEY}`,
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

    // Non-streaming mode (discovery) — handle tool calls with retry
    const MAX_RETRIES = 3;
    let retryMessages = [...messages];
    let lastAiData = await response.json();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const choice = lastAiData.choices?.[0];
      const message = choice?.message;

      if (!message?.tool_calls?.length) {
        // No tool call — just a text reply
        return new Response(JSON.stringify({
          type: "text",
          reply: message?.content || "Hmm, dis-moi en plus !",
          movie: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCall = message.tool_calls[0];

      // Handle suggest_pick_together tool
      if (toolCall.function.name === "suggest_pick_together") {
        const args = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({
          type: "pick_together",
          reply: args.message || "Vous êtes plusieurs ? Parfait, lance Pick Together pour trouver un film qui plaît à tout le monde ! 🎬",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle extract_search_intent tool — return structured filters to the client
      if (toolCall.function.name === "extract_search_intent") {
        const args = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({
          type: "search_intent",
          filters: {
            genres: args.genres ?? null,
            originalLanguage: args.originalLanguage ?? null,
            mediaType: args.mediaType ?? null,
            maxDuration: args.maxDuration ?? null,
            decade: args.decade ?? null,
          },
          recap: args.recap || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolCall.function.name !== "suggest_movie") break;

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

      // SERVER-SIDE RATING CHECK
      if (detail && effectiveMinRating > 0) {
        const movieRating = detail.vote_average || 0;
        if (movieRating < effectiveMinRating - RATING_TOLERANCE) {
          console.log(`Rating check failed (attempt ${attempt + 1}): ${detail.title || detail.name} has ${movieRating}, min is ${effectiveMinRating}. Retrying...`);
          
          if (attempt >= MAX_RETRIES - 1) {
            // Last attempt — give up gracefully
            return new Response(JSON.stringify({
              type: "text",
              reply: `J'ai du mal à trouver un film noté au-dessus de ${effectiveMinRating}/10 pour ce que tu cherches. Essaie de préciser un genre ou une ambiance et je réessaie ! 🎬`,
              movie: null,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Retry: feed the failed result back to the AI so it picks something else
          const retrySystemMsg = {
            role: "user" as const,
            content: `[SYSTÈME] Le film "${detail.title || detail.name}" n'a que ${movieRating.toFixed(1)}/10 sur TMDB, c'est en dessous du minimum de ${effectiveMinRating}/10. Propose un AUTRE film DIFFÉRENT avec une note TMDB d'au moins ${effectiveMinRating}/10. Ne propose PAS "${detail.title || detail.name}".`,
          };

          const retryBody: any = {
            model: "gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              ...retryMessages,
              { role: "assistant", content: null, tool_calls: message.tool_calls },
              { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: `Rating too low: ${movieRating.toFixed(1)}/10. Need >= ${effectiveMinRating}/10. Suggest a DIFFERENT movie.` }) },
              retrySystemMsg,
            ],
            tools,
            tool_choice: { type: "function", function: { name: "suggest_movie" } },
          };

          const retryResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GOOGLE_AI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(retryBody),
          });

          if (!retryResp.ok) break;
          lastAiData = await retryResp.json();
          continue;
        }
      }

      // If detail is null, no valid movie was found
      if (!detail) {
        return new Response(JSON.stringify({
          type: "text",
          reply: "Je n'ai pas trouvé ce titre. Peux-tu reformuler ou me donner plus de détails ? 🎬",
          movie: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rating check passed — fetch 4 similar movies to build a pool of 5
      const similarMovies = await getSimilarMovies(
        detail.id,
        bestMatch.media_type,
        effectiveMinRating,
        4
      );
      const allMovies = [detail, ...similarMovies];

      return new Response(JSON.stringify({
        type: "recommendation",
        reply: args.reason,
        movie: detail,
        movies: allMovies,
        recap: args.recap || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback
    return new Response(JSON.stringify({
      type: "text",
      reply: "Dis-moi un peu plus ce que tu cherches et je te trouve le film parfait ! 🎬",
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

- **Page d'accueil** : L'utilisateur peut lancer "Pick pour ce soir" (recommandation instantanée) ou parler directement à Pick via le chat.
- **Recommandations** : Pick propose LE film ou LA série parfait(e) avec une fiche détaillée (note, synopsis, plateformes de streaming, bande-annonce).
- **Watchlist** : L'utilisateur peut sauvegarder des films pour plus tard. Accessible depuis la barre de navigation.
- **Mon Cinéma** : Section profil cinématographique avec les films aimés, l'ADN cinématique de l'utilisateur, et des statistiques.
- **Mode Compagnon** : Quand l'utilisateur choisit de regarder un film, Pick devient un compagnon de visionnage — il peut répondre à des questions sur le film en cours, partager des anecdotes, expliquer des scènes, etc.
- **Pick+** : Version premium avec chatbot complet (poser toutes les questions ciné), recommandations illimitées, compagnon illimité, ADN avancé, alertes plateforme.
- **Profil** : L'utilisateur peut configurer ses plateformes de streaming préférées, ses genres favoris/exclus, sa note minimale, et son pseudo/photo de profil.

Si l'utilisateur demande comment faire quelque chose dans l'appli, explique-lui clairement en le guidant vers la bonne section.`;
}
