import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const VECTOR_DIM = 32;

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function parseVector(v: any): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { return JSON.parse(v.replace(/^\[/, "[").replace(/\]$/, "]")); } catch { return null; } }
  return null;
}

async function getDetails(id: number, type: "movie" | "tv" = "movie"): Promise<any> {
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
  return res.json();
}

async function getWatchProvidersFR(tmdbId: number, mediaType = "movie"): Promise<any[]> {
  const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
  const data = await res.json();
  return data.results?.FR?.flatrate || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { memberIds, guests, mood, context, timeAvailable, mediaType: rawMediaType } = await req.json();
    const mediaType: "movie" | "tv" | "both" = rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";

    const guestProfiles: { name: string; age?: number; gender?: string; favoriteGenres?: string[] }[] = guests || [];
    const totalMembers = (memberIds?.length || 0) + guestProfiles.length;

    if (totalMembers < 2) {
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
    const [profilesRes, vectorsRes, likedRes, watchlistRes, interactionsRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, preferred_platforms, excluded_genres, min_rating, media_preference, favorite_genres").in("id", memberIds),
      supabase.from("user_taste_vectors").select("user_id, taste_vector, avoidance_vector, recent_taste_vector, rejected_clusters, fatigue_state, stable_confidence").in("user_id", memberIds),
      supabase.from("liked_movies").select("user_id, tmdb_id, title, genres").in("user_id", memberIds),
      supabase.from("watchlist").select("user_id, tmdb_id").in("user_id", memberIds),
      supabase.from("user_interactions").select("user_id, tmdb_id, action_type, context").in("user_id", memberIds).in("action_type", ["skipped", "already_seen"]).limit(500),
    ]);

    const profiles = profilesRes.data || [];
    const vectors = vectorsRes.data || [];
    const likedMovies = likedRes.data || [];
    const watchlistItems = watchlistRes.data || [];
    const interactions = interactionsRes.data || [];

    // ── 2. Group constraints ──
    const platformSets = profiles.map(p => new Set(p.preferred_platforms || [])).filter(s => s.size > 0);
    let sharedPlatforms: number[] = [];
    if (platformSets.length > 0) {
      sharedPlatforms = [...platformSets[0]].filter(pid => platformSets.every(s => s.has(pid)));
      if (sharedPlatforms.length === 0) {
        const union = new Set<number>();
        platformSets.forEach(s => s.forEach(pid => union.add(pid)));
        sharedPlatforms = [...union];
      }
    }

    const excludedGenresSet = new Set<string>();
    profiles.forEach(p => (p.excluded_genres || []).forEach((g: string) => excludedGenresSet.add(g)));
    const excludedGenres = [...excludedGenresSet];

    const minRating = Math.max(...profiles.map(p => p.min_rating || 0));

    const seenIds = new Set<number>();
    likedMovies.forEach(m => seenIds.add(m.tmdb_id));
    watchlistItems.forEach(w => seenIds.add(w.tmdb_id));
    interactions.forEach((i: any) => seenIds.add(i.tmdb_id));
    const excludeIds = [...seenIds];

    // ── 3. Multi-vector group analysis ──
    const memberVectors: { userId: string; stable: number[] | null; recent: number[] | null; avoidance: number[] | null; rejectedClusters: string[]; confidence: number }[] = [];

    for (const v of vectors) {
      memberVectors.push({
        userId: v.user_id,
        stable: parseVector(v.taste_vector),
        recent: parseVector((v as any).recent_taste_vector),
        avoidance: parseVector((v as any).avoidance_vector),
        rejectedClusters: (v as any).rejected_clusters || [],
        confidence: (v as any).stable_confidence || 50,
      });
    }

    // Group taste vector (weighted average of stable vectors)
    let groupVector: number[] | null = null;
    const stableVectors = memberVectors.filter(mv => mv.stable && mv.stable.length === VECTOR_DIM);
    if (stableVectors.length > 0) {
      groupVector = new Array(VECTOR_DIM).fill(0);
      for (const mv of stableVectors) {
        for (let i = 0; i < VECTOR_DIM; i++) groupVector[i] += mv.stable![i];
      }
      for (let i = 0; i < VECTOR_DIM; i++) groupVector[i] /= stableVectors.length;
    }

    // Group avoidance vector (union — average of all avoidance vectors)
    let groupAvoidanceVector: number[] | null = null;
    const avoidanceVectors = memberVectors.filter(mv => mv.avoidance && mv.avoidance.length === VECTOR_DIM);
    if (avoidanceVectors.length > 0) {
      groupAvoidanceVector = new Array(VECTOR_DIM).fill(0);
      for (const mv of avoidanceVectors) {
        for (let i = 0; i < VECTOR_DIM; i++) groupAvoidanceVector[i] += mv.avoidance![i];
      }
      for (let i = 0; i < VECTOR_DIM; i++) groupAvoidanceVector[i] /= avoidanceVectors.length;
    }

    // Rejected clusters: union across all members
    const allRejectedClusters = [...new Set(memberVectors.flatMap(mv => mv.rejectedClusters))];

    // ── 4. Embedding-based candidates ──
    let embeddingCandidates: { tmdb_id: number; title: string; similarity: number; taste_tags: string[] }[] = [];
    let avoidanceCandidateIds: number[] = [];

    if (groupVector) {
      const vectorStr = `[${groupVector.join(",")}]`;
      const { data: matches } = await supabase.rpc("match_movies_by_taste", {
        query_vector: vectorStr, match_count: 30, exclude_ids: excludeIds,
      });
      if (matches) {
        embeddingCandidates = matches.filter((m: any) => m.similarity > 0.55);
      }
    }

    // Find movies to AVOID (close to group avoidance vector)
    if (groupAvoidanceVector) {
      const vectorStr = `[${groupAvoidanceVector.join(",")}]`;
      const { data: matches } = await supabase.rpc("match_movies_by_taste", {
        query_vector: vectorStr, match_count: 20, exclude_ids: excludeIds,
      });
      if (matches) {
        avoidanceCandidateIds = matches.filter((m: any) => m.similarity > 0.7).map((m: any) => m.tmdb_id);
      }
    }

    // ── 5. Build member summaries for AI ──
    const memberSummaries = profiles.map(p => {
      const liked = likedMovies.filter(m => m.user_id === p.id);
      const topGenres = new Map<string, number>();
      liked.forEach(m => (m.genres || []).forEach((g: string) => topGenres.set(g, (topGenres.get(g) || 0) + 1)));
      const sortedGenres = [...topGenres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);

      const memberVec = memberVectors.find(mv => mv.userId === p.id);
      const memberSkips = interactions.filter((i: any) => i.user_id === p.id);
      const skippedGenres = new Map<string, number>();
      memberSkips.forEach((i: any) => {
        const ctx = i.context || {};
        if (ctx.genres) (ctx.genres as string[]).forEach((g: string) => skippedGenres.set(g, (skippedGenres.get(g) || 0) + 1));
      });
      const heavilySkipped = [...skippedGenres.entries()].filter(([, c]) => c >= 2).map(([g]) => g);

      return {
        name: p.display_name || "Membre",
        favoriteGenres: sortedGenres.length > 0 ? sortedGenres : (p.favorite_genres || []),
        excludedGenres: p.excluded_genres || [],
        skippedGenres: heavilySkipped,
        rejectedClusters: memberVec?.rejectedClusters || [],
        platforms: p.preferred_platforms || [],
        minRating: p.min_rating || 0,
        likedCount: liked.length,
        confidence: memberVec?.confidence || 0,
        isGuest: false,
      };
    });

    for (const guest of guestProfiles) {
      memberSummaries.push({
        name: guest.name,
        favoriteGenres: guest.favoriteGenres || [],
        excludedGenres: [], skippedGenres: [], rejectedClusters: [],
        platforms: [], minRating: 0, likedCount: 0, confidence: 0, isGuest: true,
      });
    }

    // ── 6. AI arbitration with fairness scoring ──
    const candidateList = embeddingCandidates.slice(0, 15).map((c, i) =>
      `${i + 1}. "${c.title}" (TMDB: ${c.tmdb_id}, similarité groupe: ${Math.round(c.similarity * 100)}%, tags: ${c.taste_tags.join(", ")})`
    ).join("\n");

    const genreNameToId: Record<string, number> = {
      "Action": 28, "Aventure": 12, "Animation": 16, "Comédie": 35, "Crime": 80,
      "Documentaire": 99, "Drame": 18, "Famille": 10751, "Fantastique": 14,
      "Histoire": 36, "Horreur": 27, "Musique": 10402, "Mystère": 9648,
      "Romance": 10749, "Science-Fiction": 878, "Thriller": 53, "Guerre": 10752, "Western": 37,
    };
    const excludedGenreIds = excludedGenres.map(g => genreNameToId[g]).filter(Boolean);

    const mediaTypeInstruction = mediaType === "tv"
      ? "\n- TYPE : SÉRIES TV UNIQUEMENT."
      : mediaType === "movie"
        ? "\n- TYPE : FILMS UNIQUEMENT."
        : "\n- TYPE : MIXTE (au moins 2 films ET 2 séries).";

    const contentLabel = mediaType === "tv" ? "séries" : mediaType === "movie" ? "films" : "films et séries";

    const systemPrompt = `Tu es un moteur de recommandation GROUPE avec scoring d'ÉQUITÉ MULTI-VECTEUR. Tu dois trouver les ${contentLabel} qui satisferont TOUT le monde en minimisant le risque de rejet individuel.

MEMBRES DU GROUPE (${memberSummaries.length} personnes) :
${memberSummaries.map((m, i) => `${i + 1}. ${m.name}${m.isGuest ? " (invité)" : ""} — Favoris: ${m.favoriteGenres.join(", ") || "?"} | Exclus: ${m.excludedGenres.join(", ") || "∅"} | Souvent refusés: ${m.skippedGenres.join(", ") || "∅"} | Clusters rejetés: ${m.rejectedClusters.join(", ") || "∅"} | Aimés: ${m.likedCount} | Confiance: ${m.confidence}/100`).join("\n")}

CONTRAINTES :
- Genres EXCLUS (union): ${excludedGenres.join(", ") || "aucun"}
- Note minimale: ${minRating}/10
- Plateformes: ${sharedPlatforms.join(", ") || "toutes"}
${mood ? `- Humeur: ${mood}` : ""}${context ? ` | Contexte: ${context}` : ""}${timeAvailable ? ` | Temps: ${timeAvailable}` : ""}
${allRejectedClusters.length > 0 ? `- ⛔ CLUSTERS REJETÉS PAR AU MOINS UN MEMBRE : ${allRejectedClusters.join(", ")} — FORTE PÉNALITÉ` : ""}
${avoidanceCandidateIds.length > 0 ? `- ⚠️ IDs TMDB proches du vecteur d'ÉVITEMENT groupe : ${avoidanceCandidateIds.join(", ")} — NE PAS RECOMMANDER` : ""}
${mediaTypeInstruction}

${candidateList ? `CANDIDATS VECTORIELS :\n${candidateList}\n\nTu peux en choisir OU proposer d'autres.` : "Aucun candidat vectoriel. Propose des films populaires bien notés."}

ALGORITHME DE SCORING GROUPE AVEC ÉQUITÉ :
GroupScore = 0.50 × moyenne(scores_individuels)
           + 0.20 × min(scores_individuels)   ← PÉNALITÉ MIN-MEMBER (crucial!)
           + 0.15 × context_score
           + 0.10 × availability_score
           + 0.05 × novelty_fit
           - PÉNALITÉ si un genre rejeté/exclu par un membre

RÈGLE D'ÉQUITÉ : Un film adoré par 3 membres mais détesté par 1 = ÉLIMINÉ.
Le min_member_score empêche un film subi par quelqu'un.

RÈGLES :
- Recommande EXACTEMENT 5 ${contentLabel} avec un groupScore ≥ 80
- Pour chaque reco : title, type ("movie"/"tv"), reason (2 phrases POSITIVES — mets en avant pourquoi ce contenu va plaire au groupe, ne mentionne JAMAIS les aspects négatifs), groupScore (80-100), fairnessScore (0-100 = combien c'est équitable), memberNotes (1 phrase POSITIVE par membre, citant ses goûts et pourquoi ça va lui plaire)
- RÈGLE D'OR DU TON : Que du POSITIF, de l'enthousiasme. Pas de "malgré", "cependant", "par contre". Vends le contenu comme un ami enthousiaste.
- NE recommande PAS genres exclus / déjà vus (${excludeIds.length} IDs exclus)
- Réponds UNIQUEMENT en JSON valide sans backticks

Structure :
{"recommendations": [{"title": "...", "type": "movie", "reason": "...", "groupScore": 85, "fairnessScore": 80, "memberNotes": {"nom1": "...", "nom2": "..."}}]}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Trouve les 5 meilleurs ${contentLabel} pour ce groupe en optimisant l'équité.` },
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
    } catch { throw new Error("Failed to parse AI response"); }

    const recommendations = aiResult.recommendations || [];

    // ── 7. Resolve to TMDB detail (with dedup) ──
    const resolvedMovies = [];
    const resolvedIds = new Set<number>();

    for (const rec of recommendations.slice(0, 8)) {
      if (resolvedMovies.length >= 5) break;
      try {
        const recType: "movie" | "tv" = rec.type === "tv" ? "tv" : mediaType === "tv" ? "tv" : mediaType === "movie" ? "movie" : (rec.type || "movie");
        const searchUrl = `https://api.themoviedb.org/3/search/${recType}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(rec.title)}&page=1`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const found = (searchData.results || []).find((r: any) => !seenIds.has(r.id) && !resolvedIds.has(r.id));

        if (found) {
          resolvedIds.add(found.id);
          const detail = await getDetails(found.id, recType);
          const providers = await getWatchProvidersFR(found.id, recType);

          resolvedMovies.push({
            movie: detail,
            groupScore: rec.groupScore,
            fairnessScore: rec.fairnessScore || null,
            reason: rec.reason,
            memberNotes: rec.memberNotes,
            providers: providers.map((p: any) => ({
              name: p.provider_name, logo_path: p.logo_path, provider_id: p.provider_id,
            })),
          });
        }
      } catch (e) { console.error(`Failed to resolve "${rec.title}":`, e); }
    }

    return new Response(JSON.stringify({
      recommendations: resolvedMovies,
      groupInfo: {
        memberCount: totalMembers,
        sharedPlatforms,
        excludedGenres,
        minRating,
        rejectedClusters: allRejectedClusters,
        hasAvoidanceVector: !!groupAvoidanceVector,
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
