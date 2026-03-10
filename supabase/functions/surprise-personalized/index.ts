import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function getMovieDetails(id: number): Promise<any> {
  const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const res = await fetch(url);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { likedMovies } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build taste profile from liked movies
    const titles = (likedMovies || []).map((m: any) => m.title).slice(0, 10);
    const allGenres = (likedMovies || []).flatMap((m: any) => m.genres || []);
    const genreCounts: Record<string, number> = {};
    allGenres.forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([g]) => g);

    const systemPrompt = `Tu es un expert cinéma. On te donne le profil de goûts d'un utilisateur. Tu dois recommander UN film qu'il n'a probablement pas vu mais qui va lui plaire.

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide sans backticks
- Structure : {"title": "<titre exact du film>", "reason": "<2 phrases expliquant pourquoi>"}
- Ne recommande JAMAIS un film déjà dans sa liste
- Privilégie les films populaires mais aussi des pépites moins connues
- Le film doit correspondre à ses genres préférés`;

    const userPrompt = `Films aimés : ${titles.join(", ")}
Genres préférés : ${topGenres.join(", ")}

Recommande UN film surprise.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    let suggestion;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestion = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI suggestion");
    }

    // Search TMDB for the suggested movie
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(suggestion.title)}&page=1`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const results = searchData.results || [];

    if (results.length === 0) {
      throw new Error("Movie not found on TMDB");
    }

    const movieDetail = await getMovieDetails(results[0].id);

    return new Response(JSON.stringify({
      movie: movieDetail,
      reason: suggestion.reason,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("surprise-personalized error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
