import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VECTOR_DIM = 32;

function parseVector(v: any): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return null;
}

async function getDetails(id: number, type: "movie" | "tv" = "movie"): Promise<any> {
  const res = await fetch(tmdbUrl(`/${type}/${id}`, { language: "fr-FR" }));
  return res.json();
}

async function getWatchProvidersFR(tmdbId: number, mediaType = "movie"): Promise<any[]> {
  const res = await fetch(tmdbUrl(`/${mediaType}/${tmdbId}/watch/providers`));
  const data = await res.json();
  return data.results?.FR?.flatrate || [];
}

interface SessionWish {
  summary?: string | null;
  genres?: string[];
  mood?: string | null;
  keywords?: string[];
  era?: string | null;
  maxDuration?: number | null;
}

interface ParticipantHint {
  name?: string | null;
  ageHint?: string | null;
  relation?: string | null;
  genres?: string[];
  excludedGenres?: string[];
  era?: string | null;
  notes?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;
    const body = await req.json();
    const {
      memberIds = [],
      guests = [],
      mood,
      mediaType: rawMediaType,
      sessionWish: rawWish,
      participantHints = [],
      audience = "group_now",
    } = body || {};

    const mediaType: "movie" | "tv" | "both" =
      rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";

    const sessionWish: SessionWish = rawWish || {};
    const guestProfiles: { name: string; favoriteGenres?: string[]; hint?: string }[] = guests || [];
    const totalMembers = (memberIds?.length || 0) + guestProfiles.length;

    if (totalMembers < 1) {
      return new Response(JSON.stringify({ error: "Au moins 1 membre requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Member data — sources of truth: user_preferences (tags) + user_item_feedback ──
    const [profilesRes, vectorsRes, feedbackRes, prefsRes] = await Promise.all([
      supabase.from("profiles")
        .select("id, display_name, preferred_platforms, excluded_genres, min_rating, media_preference, favorite_genres")
        .in("id", memberIds),
      supabase.from("user_taste_vectors")
        .select("user_id, taste_vector, avoidance_vector, recent_taste_vector, rejected_clusters, fatigue_state, stable_confidence")
        .in("user_id", memberIds),
      supabase.from("user_item_feedback")
        .select("user_id, item_id, action, label, score")
        .in("user_id", memberIds)
        .limit(1500),
      supabase.from("user_preferences")
        .select("user_id, tag_id, weight, source")
        .in("user_id", memberIds)
        .limit(1500),
    ]);

    const profiles = profilesRes.data || [];
    const vectors = vectorsRes.data || [];
    const feedbackRows: any[] = (feedbackRes.data as any[]) || [];
    const prefsRows: any[] = (prefsRes.data as any[]) || [];

    // Resolve item_id -> tmdb_id for exclusions
    const itemIds = [...new Set(feedbackRows.map((f) => f.item_id).filter(Boolean))];
    let itemMap = new Map<string, { tmdb_id: number; media_type: string }>();
    if (itemIds.length > 0) {
      const { data: items } = await supabase
        .from("catalog_items")
        .select("id, tmdb_id, media_type")
        .in("id", itemIds);
      (items || []).forEach((it: any) => itemMap.set(it.id, { tmdb_id: it.tmdb_id, media_type: it.media_type }));
    }

    const seenIds = new Set<number>();
    for (const f of feedbackRows) {
      if (!["seen", "not_for_me", "love", "like", "watchlist"].includes(f.action)) continue;
      const ci = itemMap.get(f.item_id);
      if (ci?.tmdb_id) seenIds.add(ci.tmdb_id);
    }
    const excludeIds = [...seenIds];

    // Resolve tag_id -> label/category
    const tagIds = [...new Set(prefsRows.map((p) => p.tag_id).filter(Boolean))];
    let tagMap = new Map<string, { label: string; category: string }>();
    if (tagIds.length > 0) {
      const { data: tags } = await supabase
        .from("preference_tags")
        .select("id, key, label, category")
        .in("id", tagIds);
      (tags || []).forEach((t: any) => tagMap.set(t.id, { label: t.label || t.key, category: t.category }));
    }
    const memberTags = new Map<string, { label: string; category: string; weight: number }[]>();
    for (const row of prefsRows) {
      const t = tagMap.get(row.tag_id);
      if (!t) continue;
      const arr = memberTags.get(row.user_id) || [];
      arr.push({ label: t.label, category: t.category, weight: Number(row.weight) || 1 });
      memberTags.set(row.user_id, arr);
    }

    // ── 2. Group constraints ──
    const platformSets = profiles.map((p: any) => new Set(p.preferred_platforms || [])).filter((s: Set<number>) => s.size > 0);
    let sharedPlatforms: number[] = [];
    if (platformSets.length > 0) {
      sharedPlatforms = [...platformSets[0]].filter((pid) => platformSets.every((s: Set<number>) => s.has(pid)));
      if (sharedPlatforms.length === 0) {
        const union = new Set<number>();
        platformSets.forEach((s: Set<number>) => s.forEach((pid) => union.add(pid)));
        sharedPlatforms = [...union];
      }
    }

    const excludedGenresSet = new Set<string>();
    profiles.forEach((p: any) => (p.excluded_genres || []).forEach((g: string) => excludedGenresSet.add(g)));
    // Add per-participant hint exclusions (session-only, NOT persisted)
    (participantHints as ParticipantHint[]).forEach((h) => (h.excludedGenres || []).forEach((g) => excludedGenresSet.add(g)));
    const excludedGenres = [...excludedGenresSet];

    const minRating = profiles.length > 0 ? Math.max(...profiles.map((p: any) => p.min_rating || 0)) : 0;

    // ── 3. Group taste vector (stable) ──
    const memberVectors: { userId: string; stable: number[] | null; avoidance: number[] | null; rejectedClusters: string[]; confidence: number }[] = [];
    for (const v of vectors) {
      memberVectors.push({
        userId: (v as any).user_id,
        stable: parseVector((v as any).taste_vector),
        avoidance: parseVector((v as any).avoidance_vector),
        rejectedClusters: (v as any).rejected_clusters || [],
        confidence: (v as any).stable_confidence || 50,
      });
    }

    let groupVector: number[] | null = null;
    const stableVectors = memberVectors.filter((mv) => mv.stable && mv.stable.length === VECTOR_DIM);
    if (stableVectors.length > 0) {
      groupVector = new Array(VECTOR_DIM).fill(0);
      for (const mv of stableVectors) {
        for (let i = 0; i < VECTOR_DIM; i++) groupVector[i] += mv.stable![i];
      }
      for (let i = 0; i < VECTOR_DIM; i++) groupVector[i] /= stableVectors.length;
    }

    const allRejectedClusters = [...new Set(memberVectors.flatMap((mv) => mv.rejectedClusters))];

    // ── 4. Embedding candidates ──
    let embeddingCandidates: { tmdb_id: number; title: string; similarity: number; taste_tags: string[] }[] = [];
    if (groupVector) {
      const vectorStr = `[${groupVector.join(",")}]`;
      const { data: matches } = await supabase.rpc("match_movies_by_taste", {
        query_vector: vectorStr, match_count: 30, exclude_ids: excludeIds,
      });
      if (matches) embeddingCandidates = (matches as any[]).filter((m) => m.similarity > 0.55);
    }

    // ── 5. Build member summaries (no liked_movies / watchlist as truth) ──
    const memberSummaries = profiles.map((p: any) => {
      const tags = memberTags.get(p.id) || [];
      const genreTags = tags.filter((t) => t.category === "genre").map((t) => t.label).slice(0, 6);
      const moodTags = tags.filter((t) => t.category === "mood" || t.category === "vibe").map((t) => t.label).slice(0, 4);
      const memberFb = feedbackRows.filter((f) => f.user_id === p.id);
      const liked = memberFb.filter((f) => f.action === "like" || f.action === "love").length;
      const seen = memberFb.filter((f) => f.action === "seen").length;
      const rejected = memberFb.filter((f) => f.action === "not_for_me").length;
      return {
        name: p.display_name || "Membre",
        favoriteGenres: genreTags.length > 0 ? genreTags : (p.favorite_genres || []),
        moods: moodTags,
        excludedGenres: p.excluded_genres || [],
        platforms: p.preferred_platforms || [],
        minRating: p.min_rating || 0,
        likedCount: liked,
        seenCount: seen,
        rejectedCount: rejected,
        isGuest: false,
      };
    });

    // Guests (session-only, not persisted as taste)
    for (const guest of guestProfiles) {
      memberSummaries.push({
        name: guest.name,
        favoriteGenres: guest.favoriteGenres || (guest.hint ? [guest.hint] : []),
        moods: [],
        excludedGenres: [],
        platforms: [],
        minRating: 0,
        likedCount: 0,
        seenCount: 0,
        rejectedCount: 0,
        isGuest: true,
      });
    }

    // Participant hints (parsed from prompt) — boost session-only context
    const hintLines = (participantHints as ParticipantHint[])
      .filter((h) => h.name)
      .map((h) => `- ${h.name}${h.relation ? ` (${h.relation})` : ""}: ${[
        h.genres?.length ? `aime ${h.genres.join(", ")}` : null,
        h.era,
        h.notes,
      ].filter(Boolean).join(" · ") || "préférence non précisée"}`)
      .join("\n");

    // ── 6. AI prompt with explicit session_wish vs participant_taste separation ──
    const candidateList = embeddingCandidates.slice(0, 15).map((c, i) =>
      `${i + 1}. "${c.title}" (TMDB: ${c.tmdb_id}, sim groupe: ${Math.round(c.similarity * 100)}%, tags: ${c.taste_tags.join(", ")})`
    ).join("\n");

    const mediaTypeInstruction = mediaType === "tv"
      ? "TYPE : SÉRIES TV uniquement."
      : mediaType === "movie"
        ? "TYPE : FILMS uniquement."
        : "TYPE : MIXTE (films et séries).";

    const contentLabel = mediaType === "tv" ? "séries" : mediaType === "movie" ? "films" : "films et séries";

    const wishLine = [
      sessionWish.summary,
      sessionWish.genres?.length ? `genres: ${sessionWish.genres.join(", ")}` : null,
      sessionWish.mood,
      sessionWish.era,
      sessionWish.maxDuration ? `max ${sessionWish.maxDuration}min` : null,
      sessionWish.keywords?.length ? `mots-clés: ${sessionWish.keywords.join(", ")}` : null,
    ].filter(Boolean).join(" · ") || "(non précisée)";

    const systemPrompt = `Tu es un moteur de recommandation GROUPE. Tu équilibres deux signaux distincts :
1) ENVIE DU MOMENT (ponctuelle, ce soir) : ${wishLine}
2) GOÛTS DURABLES des participants (à respecter sans dénaturer l'envie du moment)

${audience === "group_now" ? "Mode : décision immédiate." : "Mode : planifié."}
${mediaTypeInstruction}

PARTICIPANTS (${memberSummaries.length}) :
${memberSummaries.map((m: any, i: number) => `${i + 1}. ${m.name}${m.isGuest ? " (invité)" : ""} — Goûts durables: ${m.favoriteGenres.join(", ") || "?"}${m.moods.length ? ` | Vibes: ${m.moods.join(", ")}` : ""} | Exclus: ${m.excludedGenres.join(", ") || "∅"} | Aimés: ${m.likedCount} | Refus: ${m.rejectedCount}`).join("\n")}

${hintLines ? `INDICES PROMPT (session uniquement, NE PAS confondre avec goûts durables) :\n${hintLines}\n` : ""}
CONTRAINTES :
- Genres EXCLUS (union profils + hints): ${excludedGenres.join(", ") || "aucun"}
- Note minimale: ${minRating}/10
- Plateformes communes: ${sharedPlatforms.join(", ") || "toutes"}
${mood ? `- Humeur additionnelle: ${mood}` : ""}
${allRejectedClusters.length > 0 ? `- Clusters rejetés par au moins un membre : ${allRejectedClusters.join(", ")} — pénalité forte` : ""}
- ${excludeIds.length} films déjà connus à NE PAS recommander

${candidateList ? `CANDIDATS VECTORIELS :\n${candidateList}\n` : ""}

CONSIGNE :
- Recommande EXACTEMENT 5 ${contentLabel}, score 80-100.
- Pour chaque reco, fournis OBLIGATOIREMENT :
  * title, type ("movie"|"tv")
  * groupScore (80-100), fairnessScore (0-100)
  * reasonType : un parmi "session_wish" (colle à l'envie du moment) | "taste_match" (correspond aux goûts durables) | "constraint_ok" (respecte les contraintes — durée, plateforme, exclusions) | "tonight_fit" (bon match général ce soir)
  * reasonText : UNE phrase courte, positive, qui justifie le reasonType (ex: "Pile dans l'envie historique de ce soir.", "Match parfait avec les comédies 80s d'Elisa.")
  * reason : 2 phrases positives globales
  * memberNotes : 1 phrase positive par participant
- TON : positif, enthousiaste. Jamais de "malgré", "cependant".
- Réponds UNIQUEMENT en JSON valide sans backticks.

Structure :
{"recommendations":[{"title":"...","type":"movie","reasonType":"session_wish","reasonText":"...","reason":"...","groupScore":85,"fairnessScore":80,"memberNotes":{"nom1":"..."}}]}`;

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GOOGLE_AI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Trouve les 5 meilleurs ${contentLabel} pour ce groupe ce soir.` },
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
    const content = (aiData.choices?.[0]?.message?.content || "")
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/```(?:json)?\s*/g, "")
      .trim();
    let aiResult: any;
    try {
      aiResult = JSON.parse(content);
    } catch { throw new Error("Failed to parse AI response"); }

    const recommendations = aiResult.recommendations || [];

    // ── 7. Resolve to TMDB ──
    const resolvedMovies = [];
    const resolvedIds = new Set<number>();

    for (const rec of recommendations.slice(0, 8)) {
      if (resolvedMovies.length >= 5) break;
      try {
        const recType: "movie" | "tv" = rec.type === "tv" ? "tv" : mediaType === "tv" ? "tv" : mediaType === "movie" ? "movie" : (rec.type || "movie");
        const searchUrl = tmdbUrl(`/search/${recType}`, {
          language: "fr-FR",
          query: rec.title,
          page: "1",
          region: "FR",
        });
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const found = (searchData.results || []).find((r: any) => !seenIds.has(r.id) && !resolvedIds.has(r.id));

        if (found) {
          resolvedIds.add(found.id);
          const detail = await getDetails(found.id, recType);
          const providers = await getWatchProvidersFR(found.id, recType);

          const validReason = ["session_wish", "taste_match", "constraint_ok", "tonight_fit"].includes(rec.reasonType)
            ? rec.reasonType
            : "tonight_fit";

          resolvedMovies.push({
            movie: detail,
            groupScore: rec.groupScore,
            fairnessScore: rec.fairnessScore || null,
            reasonType: validReason,
            reasonText: rec.reasonText || rec.reason || "",
            reason: rec.reason,
            memberNotes: rec.memberNotes || {},
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
        sessionWish,
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
