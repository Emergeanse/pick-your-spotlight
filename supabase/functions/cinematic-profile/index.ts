import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const authHeader = req.headers.get("Authorization");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get user from auth
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Gather user data
    const [likedRes, interactionsRes, profileRes] = await Promise.all([
      supabase.from("liked_movies").select("title, genres, liked_at, rating").eq("user_id", userId).order("liked_at", { ascending: false }).limit(50),
      supabase.from("user_interactions").select("action_type, context, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("favorite_genres").eq("id", userId).single(),
    ]);

    const likedMovies = likedRes.data || [];
    const interactions = interactionsRes.data || [];
    const favoriteGenres = profileRes.data?.favorite_genres || [];

    if (likedMovies.length < 3 && interactions.length < 5) {
      return new Response(JSON.stringify({
        personality_title: "Explorateur en devenir",
        narrative: "Tu débutes ton aventure cinématographique avec Pick. Continue à explorer et à noter des films — ton profil se dessinera au fil de tes découvertes.",
        taste_traits: ["curieux", "en exploration"],
        representative_films: [],
        evolution_note: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for AI
    const likedTitles = likedMovies.map(m => m.title).join(", ");
    const genreCounts: Record<string, number> = {};
    likedMovies.forEach(m => {
      (m.genres || []).forEach((g: string) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCounts).sort(([, a], [, b]) => b - a).slice(0, 6).map(([g]) => g);

    const skipCount = interactions.filter(i => i.action_type === "skipped").length;
    const watchCount = interactions.filter(i => i.action_type === "watched").length;

    // Check for existing profile (for evolution)
    const { data: existingProfile } = await supabase
      .from("cinematic_profiles")
      .select("personality_title, narrative, taste_traits, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    const evolutionContext = existingProfile
      ? `\nPROFIL PRÉCÉDENT (généré le ${new Date(existingProfile.updated_at).toLocaleDateString("fr-FR")}) :\n- Titre : "${existingProfile.personality_title}"\n- Traits : ${(existingProfile.taste_traits || []).join(", ")}\nSi le profil a évolué, génère un "evolution_note" subtil et poétique.`
      : "";

    const systemPrompt = `Tu es Pick, un écureuil cinéphile qui crée des profils de personnalité cinématographique.

Tu analyses les goûts d'un utilisateur et tu génères un profil narratif, poétique et personnel — comme un curateur de festival décrirait quelqu'un.

RÈGLES :
- Le titre doit être évocateur et mémorable (2-4 mots), comme un archétype. Exemples :
  "Contemplateur Émotionnel", "Chasseur de Frissons", "Rêveur Visuel", "Architecte du Suspense", "Âme Romanesque", "Explorateur Nocturne"
- La narrative doit faire 3-4 phrases, poétiques et personnelles. Pas technique. Comme un ami qui te décrit parfaitement.
- Les taste_traits sont 4-6 mots-clés qui capturent l'essence (ex: "contemplatif", "émotionnel", "tension", "esthète", "narratif")
- Les representative_films sont 3-5 films de la liste aimée qui incarnent le mieux le profil
- L'evolution_note est optionnel : seulement si le profil a changé depuis la dernière fois

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "personality_title": "<titre évocateur>",
  "narrative": "<3-4 phrases poétiques>",
  "taste_traits": ["<trait>", ...],
  "representative_films": ["<titre>", ...],
  "evolution_note": "<phrase subtile sur l'évolution ou null>"
}`;

    const userPrompt = `DONNÉES UTILISATEUR :
- Films aimés (${likedMovies.length}) : ${likedTitles}
- Genres dominants : ${topGenres.join(", ")}
- Genres favoris déclarés : ${favoriteGenres.join(", ") || "non définis"}
- Comportement : ${watchCount} films vus, ${skipCount} skippés
- Contextes fréquents des interactions : ${JSON.stringify(interactions.slice(0, 10).map(i => i.context).filter(Boolean).slice(0, 5))}
${evolutionContext}

Génère le profil cinématographique.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let profileData;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      profileData = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse profile:", content);
      throw new Error("Failed to parse AI response");
    }

    // Upsert into DB
    const upsertData = {
      user_id: userId,
      personality_title: profileData.personality_title,
      narrative: profileData.narrative,
      taste_traits: profileData.taste_traits || [],
      representative_films: profileData.representative_films || [],
      evolution_note: profileData.evolution_note || null,
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      await supabase.from("cinematic_profiles").update(upsertData).eq("user_id", userId);
    } else {
      await supabase.from("cinematic_profiles").insert(upsertData);
    }

    return new Response(JSON.stringify(profileData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cinematic-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
