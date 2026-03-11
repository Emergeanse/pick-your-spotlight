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
    const { likedMovies, tasteProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build taste profile from liked movies
    const titles = (likedMovies || []).map((m: any) => m.title).slice(0, 15);
    const allGenres = (likedMovies || []).flatMap((m: any) => m.genres || []);
    const genreCounts: Record<string, number> = {};
    allGenres.forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([g]) => g);

    // Use enriched taste profile if available
    const excludeTitles = titles.join(", ");
    const stats = tasteProfile?.stats || {};
    const skippedCount = stats.skipCount || 0;
    const watchedCount = stats.watchCount || 0;

    // Determine discovery vs taste ratio
    const totalInteractions = (likedMovies || []).length + skippedCount + watchedCount;
    const shouldDiscover = totalInteractions > 10 && Math.random() < 0.2;

    const systemPrompt = `Tu es un expert cinéma et un système de recommandation personnalisée. On te donne le profil de goûts détaillé d'un utilisateur. Tu dois recommander UN film qu'il n'a probablement pas vu mais qui va lui plaire.

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide sans backticks
- Structure : {"title": "<titre exact du film>", "reason": "<2-3 phrases expliquant pourquoi>", "confidence": <0-100>}
- Ne recommande JAMAIS un film déjà dans sa liste
- Le film doit correspondre à ses genres préférés${shouldDiscover ? "\n- IMPORTANT : cette fois, propose une pépite inattendue ou un genre qu'il ne connaît peut-être pas encore, pour élargir ses horizons. Reste pertinent mais surprends-le." : ""}
- Privilégie des films avec une bonne note (>6.5/10)
- Tiens compte du nombre de films aimés pour calibrer la précision`;

    const userPrompt = `Profil utilisateur :
- Films aimés (${titles.length}) : ${excludeTitles}
- Genres préférés : ${topGenres.join(", ")}
- Films regardés : ${watchedCount}
- Films passés/skippés : ${skippedCount}
${shouldDiscover ? "- Mode : DÉCOUVERTE (propose quelque chose d'inattendu)" : "- Mode : PERSONNALISÉ (colle à ses goûts)"}

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
      confidence: suggestion.confidence || 85,
      isDiscovery: shouldDiscover,
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
