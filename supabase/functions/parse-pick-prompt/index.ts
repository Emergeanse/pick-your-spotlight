import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const SYSTEM = `Tu es un parseur d'envies de soirées cinéma en français.
À partir d'une phrase libre, sépare clairement DEUX choses :
1) "sessionWish" : ce que le groupe a envie de voir CE SOIR (envie ponctuelle, NE doit PAS être stocké comme un goût permanent). Ex: "un film historique pour ce soir", "quelque chose de léger ce soir".
2) "participantHints" : préférences DURABLES propres à une personne mentionnée. Ex: "Elisa aime les comédies des années 80" -> { name:"Elisa", genres:["Comédie"], era:"1980s" }.

Réponds UNIQUEMENT en JSON valide, aucun texte autour.

Schéma:
{
  "audience": "solo" | "group",
  "mediaType": "movie" | "tv" | "both",
  "sessionWish": {
    "summary": string | null,         // résumé court de l'envie commune ce soir
    "genres": string[],               // genres voulus pour ce soir
    "mood": string | null,            // ex: "feel-good", "intense"
    "keywords": string[],             // mots-clés thématiques
    "era": string | null,             // ex: "années 80", "récent"
    "maxDuration": number | null      // minutes
  },
  "participantHints": [
    {
      "name": string | null,
      "ageHint": string | null,
      "relation": string | null,
      "genres": string[],             // genres durables aimés par cette personne
      "excludedGenres": string[],
      "era": string | null,
      "notes": string | null
    }
  ],
  "timeOfDay": "now" | "tonight" | "later" | null,
  "scheduledHint": string | null,
  "platforms": string[],
  "blocking": string | null           // contrainte bloquante détectée (ex: "aucun genre commun"), sinon null
}

Règles :
- "Elisa aime X" => participantHint pour Elisa, PAS sessionWish.
- "on cherche X ce soir" => sessionWish, PAS un goût permanent.
- Si la phrase évoque "avec ma copine / mes amis / ma famille", audience="group".
- Mentionne les enfants => sessionWish.genres += "Famille", participantHints inchangés.
- Si rien, mets null ou tableau vide.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 1000) {
      return new Response(JSON.stringify({ error: "invalid prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const strArr = (v: any) => Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : [];
    const sw = parsed.sessionWish || {};
    const result = {
      audience: parsed.audience === "group" ? "group" : "solo",
      mediaType: ["movie", "tv", "both"].includes(parsed.mediaType) ? parsed.mediaType : "both",
      sessionWish: {
        summary: typeof sw.summary === "string" ? sw.summary : null,
        genres: strArr(sw.genres),
        mood: typeof sw.mood === "string" ? sw.mood : null,
        keywords: strArr(sw.keywords),
        era: typeof sw.era === "string" ? sw.era : null,
        maxDuration: typeof sw.maxDuration === "number" ? sw.maxDuration : null,
      },
      participantHints: Array.isArray(parsed.participantHints)
        ? parsed.participantHints
            .filter((p: any) => p && typeof p === "object")
            .map((p: any) => ({
              name: typeof p.name === "string" ? p.name : null,
              ageHint: typeof p.ageHint === "string" ? p.ageHint : null,
              relation: typeof p.relation === "string" ? p.relation : null,
              genres: strArr(p.genres),
              excludedGenres: strArr(p.excludedGenres),
              era: typeof p.era === "string" ? p.era : null,
              notes: typeof p.notes === "string" ? p.notes : null,
            }))
        : [],
      timeOfDay: ["now", "tonight", "later"].includes(parsed.timeOfDay) ? parsed.timeOfDay : null,
      scheduledHint: typeof parsed.scheduledHint === "string" ? parsed.scheduledHint : null,
      platforms: strArr(parsed.platforms),
      blocking: typeof parsed.blocking === "string" && parsed.blocking.trim() ? parsed.blocking : null,
    };

    return new Response(JSON.stringify({ parsed: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-pick-prompt error", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
