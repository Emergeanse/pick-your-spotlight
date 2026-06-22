import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function tmdbSearch(title: string, year?: string): Promise<any[]> {
  const params: Record<string, string> = {
    query: title,
    language: "fr-FR",
    include_adult: "false",
  };
  if (year) params.year = year;

  const res = await fetch(tmdbUrl("/search/multi", params));
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).filter(
    (r: any) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path
  );
}

async function getDetails(tmdbId: number, mediaType: "movie" | "tv"): Promise<any> {
  const res = await fetch(tmdbUrl(`/${mediaType}/${tmdbId}`, { language: "fr-FR" }));
  if (!res.ok) return null;
  const d = await res.json();
  if (mediaType === "tv") {
    d.title = d.title || d.name;
    d.release_date = d.release_date || d.first_air_date;
    d.original_title = d.original_title || d.original_name;
  }
  return d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;

    const { query, imageBase64, imageMimeType, excludeTmdbIds = [] } = await req.json();

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY manquant");

    const excludeNote = excludeTmdbIds.length > 0
      ? `\nFilms déjà proposés à EXCLURE (TMDB IDs): ${excludeTmdbIds.join(", ")} — ne propose pas ces films, même s'ils correspondent.`
      : "";

    // Build Gemini content
    let parts: any[];

    if (imageBase64) {
      parts = [
        {
          inline_data: {
            mime_type: imageMimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        {
          text: `Identifie le film ou la série depuis cette image (affiche, photo de plateau, capture d'écran, photo d'un écran de télé, couverture de DVD...).${excludeNote}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"title": "Titre exact du film", "year": "2020", "media_type": "movie"}
ou {"title": "...", "year": "...", "media_type": "tv"}
ou {"error": "not_identified"} si tu ne reconnais pas de film/série.`,
        },
      ];
    } else {
      parts = [
        {
          text: `Tu es un expert en cinéma et séries. L'utilisateur cherche un film ou une série.${excludeNote}

Demande utilisateur : "${query}"

Identifie le film ou la série le plus probable. Si c'est un titre exact, confirme-le. Si c'est une description, déduis le film le plus probable.

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"title": "Titre exact", "year": "2020", "media_type": "movie"}
ou {"title": "...", "year": "...", "media_type": "tv"}
ou {"error": "not_identified"} si tu ne peux vraiment pas identifier.`,
        },
      ];
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            maxOutputTokens: 200,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini error: ${err.slice(0, 200)}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let identified: any;
    try {
      identified = JSON.parse(rawText.trim());
    } catch {
      identified = { error: "parse_error" };
    }

    if (identified.error) {
      return new Response(
        JSON.stringify({ found: false, error: identified.error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search TMDB with the identified title
    const results = await tmdbSearch(identified.title, identified.year);
    const filtered = results.filter((r: any) => !excludeTmdbIds.includes(r.id));

    if (filtered.length === 0) {
      return new Response(
        JSON.stringify({ found: false, error: "not_found_tmdb" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const top = filtered[0];
    const mediaType: "movie" | "tv" = top.media_type === "tv" ? "tv" : "movie";
    const details = await getDetails(top.id, mediaType);

    return new Response(
      JSON.stringify({
        found: true,
        tmdbId: top.id,
        mediaType,
        identifiedTitle: identified.title,
        movie: details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[identify-film]", e);
    return new Response(
      JSON.stringify({ found: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
