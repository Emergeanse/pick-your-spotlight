import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

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
    const body = await req.json().catch(() => ({}));
    const { genre, mood, mediaType } = body;

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY not configured");

    const contextHint = [
      genre ? `Le genre choisi est : ${genre}.` : "",
      mood ? `L'humeur est : ${mood}.` : "",
      mediaType === "tv" ? "L'utilisateur cherche une série." : "",
    ].filter(Boolean).join(" ");

    const prompt = `Tu es un passionné de cinéma et de séries. Génère exactement 4 anecdotes fascinantes sur le cinéma ou les séries TV, en français, courtes (1-2 phrases max chacune). Elles doivent être vraies, surprenantes et variées (histoire du cinéma, coulisses de tournage, acteurs, réalisateurs, records, anecdotes techniques...).${contextHint ? " " + contextHint + " Tu peux orienter 1 anecdote en rapport avec ce contexte si tu as quelque chose d'intéressant." : ""}

Réponds UNIQUEMENT avec ce JSON valide, sans markdown ni texte autour :
{"anecdotes":[{"text":"...","mood":"think"},{"text":"...","mood":"wave"},{"text":"...","mood":"default"},{"text":"...","mood":"think"}]}

Les moods possibles : "think", "wave", "default". Varie-les.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        max_tokens: 600,
        temperature: 1.0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Strip markdown fences if present
    const cleaned = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cinema-anecdotes error:", e);
    return new Response(JSON.stringify({ anecdotes: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
