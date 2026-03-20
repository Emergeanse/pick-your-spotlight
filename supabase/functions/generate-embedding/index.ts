import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 32 taste dimensions — each is a spectrum from 0.0 to 1.0
const TASTE_DIMENSIONS = [
  "epic_scale",        // 0: intimate → epic
  "emotional_depth",   // 1: surface → deep emotion
  "pacing",            // 2: slow burn → fast-paced
  "humor",             // 3: serious → comedic
  "darkness",          // 4: lighthearted → dark/gritty
  "visual_style",      // 5: naturalistic → stylized
  "complexity",        // 6: simple → complex narrative
  "romance",           // 7: no romance → central romance
  "action_intensity",  // 8: calm → intense action
  "suspense",          // 9: low tension → high suspense
  "originality",       // 10: conventional → avant-garde
  "realism",           // 11: fantasy → grounded realism
  "nostalgia",         // 12: contemporary → retro/nostalgic
  "cerebral",          // 13: visceral → intellectual
  "warmth",            // 14: cold/cynical → warm/hopeful
  "violence",          // 15: peaceful → violent
  "dialogue_driven",   // 16: visual storytelling → dialogue-heavy
  "ensemble_cast",     // 17: solo protagonist → ensemble
  "world_building",    // 18: real world → rich fictional world
  "twist_factor",      // 19: predictable → twist-heavy
  "coming_of_age",     // 20: mature → youth/growth
  "social_commentary", // 21: pure entertainment → social message
  "supernatural",      // 22: natural → supernatural elements
  "artistic",          // 23: mainstream → arthouse
  "family_friendly",   // 24: adult only → family friendly
  "musical",           // 25: no music focus → music-central
  "documentary_feel",  // 26: pure fiction → documentary style
  "animation_style",   // 27: live action → animated
  "cult_potential",    // 28: mainstream appeal → cult following
  "franchise",         // 29: standalone → franchise/sequel
  "time_period",       // 30: contemporary → period piece
  "international",     // 31: Hollywood → international cinema
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tmdbId, title, overview, genres, year, runtime, popularity, voteAverage, mediaType, platformIds } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check cache first
    const { data: existing } = await supabase
      .from("movie_embeddings")
      .select("embedding, taste_tags, semantic_axes, safety_tags, suitability_tags, cluster_labels")
      .eq("tmdb_id", tmdbId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        embedding: existing.embedding,
        tasteTags: existing.taste_tags,
        semanticAxes: (existing as any).semantic_axes,
        safetyTags: (existing as any).safety_tags,
        suitabilityTags: (existing as any).suitability_tags,
        clusterLabels: (existing as any).cluster_labels,
        cached: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate embedding via AI
    const systemPrompt = `Tu es un expert en analyse cinématographique. On te donne un film et tu dois le positionner sur 32 dimensions de goût.

Chaque dimension est un spectre de 0.0 à 1.0. Voici les dimensions dans l'ordre :
${TASTE_DIMENSIONS.map((d, i) => `${i}: ${d}`).join("\n")}

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans backticks
- Structure : {"vector": [0.0, 0.1, ...], "tags": ["tag1", "tag2", ...]}
- Le vector doit contenir exactement 32 floats entre 0.0 et 1.0
- Les tags sont 3-6 micro-genres descriptifs (ex: "neo-noir", "slow burn", "twist ending", "feel-good")
- Sois précis et nuancé dans tes scores`;

    const userPrompt = `Film : "${title}"
Genres : ${(genres || []).join(", ")}
Synopsis : ${overview || "Non disponible"}

Génère le vecteur de goût 32D et les taste tags.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse embedding response:", content);
      throw new Error("Failed to parse AI embedding");
    }

    const vector = parsed.vector;
    const tags = parsed.tags || [];

    if (!Array.isArray(vector) || vector.length !== 32) {
      throw new Error(`Invalid vector length: ${vector?.length}`);
    }

    // Normalize to [0, 1]
    const normalized = vector.map((v: number) => Math.max(0, Math.min(1, v)));

    // Format as pgvector string
    const vectorStr = `[${normalized.join(",")}]`;

    // Cache in DB
    const { error: insertError } = await supabase
      .from("movie_embeddings")
      .upsert({
        tmdb_id: tmdbId,
        title,
        embedding: vectorStr,
        taste_tags: tags,
        genres: genres || [],
      }, { onConflict: "tmdb_id" });

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(JSON.stringify({
      embedding: normalized,
      tasteTags: tags,
      cached: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-embedding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
