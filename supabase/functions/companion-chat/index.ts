import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { consumeQuota, quotaExceededResponse } from "../_shared/quota.ts";

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
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;

    // Avant tout appel facture : consommer le jeton une fois la depense
    // engagee ne protegerait de rien.
    const quota = await consumeQuota(auth.user!.id, "chat");
    if (!quota.allowed) return quotaExceededResponse("chat", quota, corsHeaders);
    const { messages, movieTitle, movieYear, movieOverview, spoilerMode, movieProgress } = await req.json();
    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY is not configured");

    let spoilerInstruction = "";
    switch (spoilerMode) {
      case "no-spoilers":
        spoilerInstruction = `RÈGLE ABSOLUE : NE JAMAIS révéler de spoilers. Ne mentionne AUCUN événement, retournement, mort de personnage, fin, ou surprise du film/de la série. Si l'utilisateur demande un spoiler, refuse poliment et propose plutôt une anecdote de tournage ou un fait culturel.`;
        break;
      case "up-to-current":
        spoilerInstruction = `L'utilisateur est à la phase "${movieProgress}" du film. Tu peux discuter de ce qui s'est passé AVANT ce point mais JAMAIS révéler ce qui arrive APRÈS. Si l'utilisateur est au "beginning", ne parle que du setup. Si au "middle", tu peux discuter de la première moitié. Si "near-end", tu peux discuter de presque tout sauf la fin.`;
        break;
      case "full-spoilers":
        spoilerInstruction = `L'utilisateur accepte les spoilers. Tu peux discuter librement de TOUT le film, y compris la fin, les retournements, et les surprises.`;
        break;
      default:
        spoilerInstruction = `NE JAMAIS révéler de spoilers.`;
    }

    const systemPrompt = `Tu es un compagnon de visionnage pour le film/la série "${movieTitle}" (${movieYear}).

Synopsis : ${movieOverview}

Tu es chaleureux, passionné de cinéma, et tu parles comme un ami cinéphile. Tes réponses sont COURTES (2-3 phrases max sauf si l'utilisateur demande plus de détails).

${spoilerInstruction}

CE QUE TU PEUX FAIRE :
- Partager des anecdotes de tournage, des faits sur les acteurs, le réalisateur
- Expliquer le contexte culturel ou historique
- Parler de la musique, de la bande-son
- Expliquer des scènes (en respectant le mode spoiler)
- Donner des infos sur les lieux de tournage
- Comparer avec d'autres films similaires
- Répondre aux questions sur les acteurs ("Qui joue ce personnage ?")

CE QUE TU NE PEUX PAS FAIRE :
- Parler de sujets sans rapport avec le cinéma/les séries
- Si l'utilisateur parle d'autre chose, ramène-le gentiment au film : "On revient au film ? 🎬"

STYLE :
- Utilise des emojis avec modération (1-2 par message max)
- Sois enthousiaste mais pas excessif
- Réponds TOUJOURS en français`;

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
        stream: true,
      }),
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("companion-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
