import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const SYSTEM = `Tu es un parseur de demandes de séances cinéma en français.
À partir d'une phrase libre, extrais une intention structurée.
Réponds UNIQUEMENT en JSON valide, aucun texte autour.

Schéma:
{
  "audience": "solo" | "group",
  "mediaType": "movie" | "tv" | "both",
  "mood": string | null,            // ex: "feel-good", "intense", "drôle", "émouvant"
  "genres": string[],               // genres en français
  "excludedGenres": string[],
  "maxDuration": number | null,     // minutes
  "timeOfDay": "now" | "tonight" | "later" | null,
  "scheduledHint": string | null,   // ex: "samedi soir", "demain 21h"
  "guests": [                       // personnes mentionnées
    { "name": string | null, "ageHint": string | null, "relation": string | null }
  ],
  "groupSize": number | null,       // nb total de personnes (créateur inclus)
  "platforms": string[],            // ex: ["Netflix", "Prime"]
  "keywords": string[]              // mots-clés thématiques
}

Règles:
- Si la phrase évoque "avec ma copine / mes amis / ma famille / les enfants", audience="group".
- Si elle évoque les enfants, ajoute "famille" à genres et "horreur" à excludedGenres.
- Si pas d'info, mets null ou tableau vide.`;

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
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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

    // Normalize defaults
    const result = {
      audience: parsed.audience === "group" ? "group" : "solo",
      mediaType: ["movie", "tv", "both"].includes(parsed.mediaType) ? parsed.mediaType : "both",
      mood: typeof parsed.mood === "string" ? parsed.mood : null,
      genres: Array.isArray(parsed.genres) ? parsed.genres.filter((g: any) => typeof g === "string") : [],
      excludedGenres: Array.isArray(parsed.excludedGenres) ? parsed.excludedGenres.filter((g: any) => typeof g === "string") : [],
      maxDuration: typeof parsed.maxDuration === "number" ? parsed.maxDuration : null,
      timeOfDay: ["now", "tonight", "later"].includes(parsed.timeOfDay) ? parsed.timeOfDay : null,
      scheduledHint: typeof parsed.scheduledHint === "string" ? parsed.scheduledHint : null,
      guests: Array.isArray(parsed.guests)
        ? parsed.guests
            .filter((g: any) => g && typeof g === "object")
            .map((g: any) => ({
              name: typeof g.name === "string" ? g.name : null,
              ageHint: typeof g.ageHint === "string" ? g.ageHint : null,
              relation: typeof g.relation === "string" ? g.relation : null,
            }))
        : [],
      groupSize: typeof parsed.groupSize === "number" ? parsed.groupSize : null,
      platforms: Array.isArray(parsed.platforms) ? parsed.platforms.filter((p: any) => typeof p === "string") : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: any) => typeof k === "string") : [],
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
