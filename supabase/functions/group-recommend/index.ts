import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const VECTOR_DIM = 32;

async function getDetails(id: number, type: "movie" | "tv" = "movie"): Promise<any> {
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
  return res.json();
}

async function getWatchProvidersFR(tmdbId: number, mediaType = "movie"): Promise<any[]> {
  const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
  const data = await res.json();
  const fr = data.results?.FR;
  return fr?.flatrate || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { memberIds, mood, context, timeAvailable } = await req.json();

    if (!memberIds || memberIds.length < 2) {
      return new Response(JSON.stringify({ error: "Au moins 2 membres requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Fetch all member data in parallel ──
    const [profilesRes, vectorsRes, likedRes, watchlistRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, preferred_platforms, excluded_genres, min_rating, media_preference, favorite_genres").in("id", memberIds),
      supabase.from("user_taste_vectors").select("user_id, taste_vector").in("user_id", memberIds),
      supabase.from("liked_movies").select("user_id, tmdb_id, title, genres").in("user_id", memberIds),
      supabase.from("watchlist").select("user_id, tmdb_id").in("user_id", memberIds),
    ]);

    const profiles = profilesRes.data || [];
    const vectors = vectorsRes.data || [];
    const likedMovies = likedRes.data || [];
    const watchlistItems = watchlistRes.data || [];

    // ── 2. Cross-reference: compute group constraints ──

    // Platforms: intersection (movies available for ALL members)
    const platformSets = profiles
      .map(p => new Set(p.preferred_platforms || []))
      .filter(s => s.size > 0);
    let sharedPlatforms: number[] = [];
    if (platformSets.length > 0) {
      sharedPlatforms = [...platformSets[0]].filter(pid =>
        platformSets.every(s => s.has(pid))
      );
      // If intersection is empty, use union (at least one person has it)
      if (sharedPlatforms.length === 0) {
        const union = new Set<number>();
        platformSets.forEach(s => s.forEach(pid => union.add(pid)));
        sharedPlatforms = [...union];
      }
    }

    // Excluded genres: union (if anyone excludes a genre, exclude it)
    const excludedGenresSet = new Set<string>();
    profiles.forEach(p => (p.excluded_genres || []).forEach((g: string) => excludedGenresSet.add(g)));
    const excludedGenres = [...excludedGenresSet];

    // Min rating: take the highest requirement
    const minRating = Math.max(...profiles.map(p => p.min_rating || 0));

    // Already seen: union of all liked + watchlist tmdb_ids
    const seenIds = new Set<number>();
    likedMovies.forEach(m => seenIds.add(m.tmdb_id));
    watchlistItems.forEach(w => seenIds.add(w.tmdb_id));
    const excludeIds = [...seenIds];

    // ── 3. Compute group taste vector (weighted average) ──
    let groupVector: number[] | null = null;
    const parsedVectors: { userId: string; vec: number[] }[] = [];

    for (const v of vectors) {
      let vec = v.taste_vector;
      if (typeof vec === "string") {
        vec = JSON.parse(vec.replace(/^\[/, "[").replace(/\]$/, "]"));
      }
      if (Array.isArray(vec) && vec.length === VECTOR_DIM) {
        parsedVectors.push({ userId: v.user_id, vec });
      }
    }

    if (parsedVectors.length > 0) {
      groupVector = new Array(VECTOR_DIM).fill(0);
      for (const pv of parsedVectors) {
        for (let i = 0; i < VECTOR_DIM; i++) {
          groupVector[i] += pv.vec[i];
        }
      }
      for (let i = 0; i < VECTOR_DIM; i++) {
        groupVector[i] /= parsedVectors.length;
      }
    }

    // ── 4. Embedding-based candidates ──
    let embeddingCandidates: { tmdb_id: number; title: string; similarity: number; taste_tags: string[] }[] = [];
    if (groupVector) {
      const vectorStr = `[${groupVector.join(",")}]`;
      const { data: matches } = await supabase.rpc("match_movies_by_taste", {
        query_vector: vectorStr,
        match_count: 30,
        exclude_ids: excludeIds,
      });
      if (matches) {
        embeddingCandidates = matches.filter((m: any) => m.similarity > 0.6);
      }
    }

    // ── 5. Build member summaries for AI ──
    const memberSummaries = profiles.map(p => {
      const liked = likedMovies.filter(m => m.user_id === p.id);
      const topGenres = new Map<string, number>();
      liked.forEach(m => (m.genres || []).forEach((g: string) => topGenres.set(g, (topGenres.get(g) || 0) + 1)));
      const sortedGenres = [...topGenres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);

      return {
        name: p.display_name || "Membre",
        favoriteGenres: sortedGenres.length > 0 ? sortedGenres : (p.favorite_genres || []),
        excludedGenres: p.excluded_genres || [],
        platforms: p.preferred_platforms || [],
        minRating: p.min_rating || 0,
        likedCount: liked.length,
      };
    });

    // ── 6. AI arbitration ──
    const candidateList = embeddingCandidates.slice(0, 15).map((c, i) =>
      `${i + 1}. "${c.title}" (TMDB: ${c.tmdb_id}, similarité: ${Math.round(c.similarity * 100)}%, tags: ${c.taste_tags.join(", ")})`
    ).join("\n");

    const genreNameToId: Record<string, number> = {
      "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
      "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
      "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
      "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
    };
    const excludedGenreIds = excludedGenres.map(g => genreNameToId[g]).filter(Boolean);

    const systemPrompt = `Tu es un moteur de recommandation cinéma spécialisé dans les GROUPES. Tu dois trouver les films qui satisferont TOUT le monde.

MEMBRES DU GROUPE (${memberSummaries.length} personnes) :
${memberSummaries.map((m, i) => `${i + 1}. ${m.name} — Genres favoris: ${m.favoriteGenres.join(", ") || "?"} | Genres exclus: ${m.excludedGenres.join(", ") || "aucun"} | Films aimés: ${m.likedCount} | Note min: ${m.minRating}/10`).join("\n")}

CONTRAINTES GROUPE :
- Genres EXCLUS (union): ${excludedGenres.join(", ") || "aucun"}
- Note minimale: ${minRating}/10
- Plateformes partagées (IDs TMDB): ${sharedPlatforms.join(", ") || "toutes"}
${mood ? `- Humeur du groupe: ${mood}` : ""}
${context ? `- Contexte: ${context}` : ""}
${timeAvailable ? `- Temps disponible: ${timeAvailable}` : ""}

${candidateList ? `CANDIDATS PAR SIMILARITÉ VECTORIELLE :\n${candidateList}\n\nTu peux en choisir parmi ceux-ci OU proposer d'autres films.` : "Aucun candidat vectoriel disponible. Propose des films populaires et bien notés."}

ALGORITHME DE SCORING GROUPE :
- GroupScore = moyenne(scores individuels) - pénalité(si un membre a un score < 40) + bonus contexte
- Un film que quelqu'un DÉTESTERAIT (genres exclus, note trop basse) est ÉLIMINÉ
- Privilégie les films qui sont "acceptables pour tous" plutôt que "adorés par un seul"

RÈGLES :
- Recommande EXACTEMENT 5 films, du meilleur au moins bon
- Chaque film doit inclure: title, reason (2 phrases max), groupScore (0-100), memberNotes (1 phrase par membre expliquant pourquoi ça lui convient)
- NE recommande PAS de films des genres exclus
- NE recommande PAS de films déjà vus (IDs exclus: ${excludeIds.length} films)
- Réponds UNIQUEMENT en JSON valide sans backticks

Structure :
{"recommendations": [{"title": "...", "reason": "...", "groupScore": 85, "memberNotes": {"nom1": "...", "nom2": "..."}}]}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Trouve les 5 meilleurs films pour ce groupe." },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    let aiResult: any;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiResult = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    const recommendations = aiResult.recommendations || [];

    // ── 7. Resolve each recommendation to TMDB MovieDetail ──
    const resolvedMovies = [];

    for (const rec of recommendations.slice(0, 5)) {
      try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(rec.title)}&page=1`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const found = (searchData.results || [])[0];

        if (found) {
          const detail = await getMovieDetails(found.id);
          const providers = await getWatchProvidersFR(found.id);

          resolvedMovies.push({
            movie: detail,
            groupScore: rec.groupScore,
            reason: rec.reason,
            memberNotes: rec.memberNotes,
            providers: providers.map((p: any) => ({
              name: p.provider_name,
              logo_path: p.logo_path,
              provider_id: p.provider_id,
            })),
          });
        }
      } catch (e) {
        console.error(`Failed to resolve "${rec.title}":`, e);
      }
    }

    return new Response(JSON.stringify({
      recommendations: resolvedMovies,
      groupInfo: {
        memberCount: memberIds.length,
        sharedPlatforms,
        excludedGenres,
        minRating,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("group-recommend error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
