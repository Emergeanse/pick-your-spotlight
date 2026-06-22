import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchMulti(query: string): Promise<any[]> {
  const res = await fetch(tmdbUrl("/search/multi", { language: "fr-FR", query, page: "1" }));
  const data = await res.json();
  return (data.results || [])
    .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10);
}

async function getMovieDetails(id: number): Promise<any> {
  const res = await fetch(tmdbUrl(`/movie/${id}`, { language: "fr-FR" }));
  return res.json();
}

async function getTVDetails(id: number): Promise<any> {
  const res = await fetch(tmdbUrl(`/tv/${id}`, { language: "fr-FR" }));
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;
    const { messages, userTasteContext } = await req.json();
    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY is not configured");

    const currentYear = new Date().getFullYear();

    // Build taste context section if available
    let tasteSection = "";
    if (userTasteContext) {
      const { likedMovies, favoriteGenres, excludedGenres } = userTasteContext;
      if (likedMovies?.length > 0) {
        const recentLikes = likedMovies.slice(0, 15).map((m: any) => m.title).join(", ");
        tasteSection += `\nFILMS AIMÉS PAR L'UTILISATEUR (du plus récent au plus ancien) : ${recentLikes}`;
      }
      if (favoriteGenres?.length > 0) {
        tasteSection += `\nGENRES PRÉFÉRÉS : ${favoriteGenres.join(", ")}`;
      }
      if (excludedGenres?.length > 0) {
        tasteSection += `\nGENRES À ÉVITER : ${excludedGenres.join(", ")}`;
      }
    }

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
  • JAMAIS de formulations robotiques comme "Recommended movie:", "This matches your preferences", "Voici ma suggestion"

RÈGLE CRITIQUE — QUAND RECOMMANDER VS QUAND DEMANDER :

RECOMMANDE IMMÉDIATEMENT (appelle suggest_movie) si l'utilisateur donne AU MOINS UN des éléments suivants :
- Une humeur ("je suis fatigué", "envie de rigoler", "un truc intense")
- Un contexte ("avec ma copine", "entre potes", "seul ce soir")
- Un type de contenu ("un film", "une série", "un anime")
- Un genre ou registre ("un truc drôle", "de la SF", "un thriller")
- Une référence ("un truc comme Inception", "dans le style Tarantino")
- Une description même vague ("un truc cool", "un bon film", "quelque chose de bien")

Exemples où tu DOIS recommander DIRECTEMENT sans poser de question :
- "Je veux un film cool avec ma copine" → RECOMMANDE (humeur + contexte = assez d'infos)
- "Un thriller ce soir" → RECOMMANDE (genre = assez)
- "Un truc léger" → RECOMMANDE (humeur = assez)
- "J'ai envie de rigoler" → RECOMMANDE (humeur = assez)
- "Un film pour ce soir" → RECOMMANDE (utilise ses goûts connus pour choisir)
- "Quelque chose de bien" → RECOMMANDE (utilise ses goûts connus)

POSE UNE QUESTION UNIQUEMENT si le message ne contient AUCUN signal exploitable, par exemple :
- "Salut" (juste un bonjour)
- "J'sais pas quoi regarder" (aucun indice)
- "Aide-moi" (aucun contexte)

Dans ces cas-là, pose UNE SEULE question courte et naturelle, jamais plusieurs.
Maximum 1 échange de questions avant de proposer un film. Si après ta question l'utilisateur reste vague, surprends-le avec un film basé sur ses goûts connus.
${tasteSection}

DÉTECTION D'HUMEUR — PRIORITÉ MAXIMALE :
Avant même de penser au genre, détecte l'état émotionnel de l'utilisateur à partir de ses mots. L'humeur prime TOUJOURS sur le genre.

Mapping d'expressions → signaux d'humeur :
- "fatigué", "crevé", "épuisé", "besoin de décompresser", "longue journée" → COMFORT/RELAXING → films doux, réconfortants, pas de tension
- "réconfortant", "cocooning", "doudou", "feel-good", "me remonter le moral" → COMFORT → comédie douce, drame chaleureux, animation Pixar/Ghibli
- "rire", "marrer", "rigoler", "drôle", "humour" → FUNNY → comédies, stand-up films, comédies absurdes
- "intense", "fort", "puissant", "prenant", "haletant" → INTENSE → thrillers, drames forts, films de guerre
- "retourner le cerveau", "plot twist", "WTF", "complexe", "réfléchir" → MIND-BLOWING → sci-fi cérébrale, thrillers psychologiques, films à twist
- "pleurer", "émouvant", "touchant", "bouleversant", "larmes" → EMOTIONAL → drames, romances dramatiques, films d'auteur
- "léger", "pas prise de tête", "simple", "tranquille", "chill" → LIGHT → comédies légères, romcoms, films d'aventure fun
- "peur", "flipper", "horreur", "frissons", "flippant" → SCARY → horreur, thriller horrifique
- "romantique", "love", "amour", "en couple" → ROMANTIC → romances, drames romantiques
- "aventure", "évasion", "voyage", "dépaysement" → ADVENTUROUS → aventure, fantasy, road movies

RÈGLE CLÉ : Si l'utilisateur dit "je suis fatigué, je veux un truc bien", ne recommande PAS un thriller intense. Recommande un film doux et réconfortant. L'humeur détectée FILTRE les genres possibles.

RÈGLES ABSOLUES :
- Tu ne parles QUE de films et séries. Si l'utilisateur parle d'autre chose : "Hé, moi c'est les films mon truc ! 🎬 Dis-moi plutôt ce que t'as envie de regarder ce soir."
- Réponds TOUJOURS en français
- Recommande UN SEUL film ou série à la fois
- Sois bref : 2-3 phrases max pour la raison, style conversationnel

PERTINENCE :
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
- Reprends les mots de l'utilisateur et explique pourquoi ça colle à son HUMEUR
- Mélange : pourquoi ça répond à son état émotionnel + un détail passionnant sur le film
- Exemple : "T'es crevé et t'as besoin d'un truc doux ? Celui-là c'est comme une couverture chaude — l'ambiance est hyper enveloppante et ça te laisse avec le sourire."

OUTIL :
- Utilise suggest_movie pour donner ta reco
- "recap" = 2-4 tags courts résumant la recherche. INCLUS le signal d'humeur détecté (ex: ["Réconfortant", "Film", "Soirée solo"])
- Appelle suggest_movie DÈS QUE tu as le moindre signal. En cas de doute, recommande plutôt que de poser une question.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
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
