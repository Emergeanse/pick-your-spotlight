import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function getProviderIdsFR(tmdbId: number, mediaType: "movie" | "tv"): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    const fr = data?.results?.FR;
    if (!fr) return [];
    return [...(fr.flatrate || []), ...(fr.free || []), ...(fr.ads || [])].map((p: any) => Number(p.provider_id));
  } catch {
    return [];
  }
}

const TASTE_DIMENSIONS = [
  "epic_scale",
  "emotional_depth",
  "pacing",
  "humor",
  "darkness",
  "visual_style",
  "complexity",
  "romance",
  "action_intensity",
  "suspense",
  "originality",
  "realism",
  "nostalgia",
  "cerebral",
  "warmth",
  "violence",
  "dialogue_driven",
  "ensemble_cast",
  "world_building",
  "twist_factor",
  "coming_of_age",
  "social_commentary",
  "supernatural",
  "artistic",
  "family_friendly",
  "musical",
  "documentary_feel",
  "animation_style",
  "cult_potential",
  "franchise",
  "time_period",
  "international",
];

type EmbedResult = { ok: true } | { ok: false; step: string; detail: string };

async function generateEmbeddingWithGoogleAI(
  detail: any,
  mediaType: string,
  googleApiKey: string,
  supabase: any,
  platformIds: number[] = [],
): Promise<EmbedResult> {
  const title = detail.title || detail.name;

  // Skip if already in DB
  const { data: existing } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id")
    .eq("tmdb_id", detail.id)
    .maybeSingle();
  if (existing) return { ok: true };

  const prompt = `Tu es un expert en analyse cinématographique. Positionne ce contenu sur 32 dimensions de goût et génère des métadonnées enrichies.

Dimensions (0.0 à 1.0) :
${TASTE_DIMENSIONS.map((d, i) => `${i}: ${d}`).join("\n")}

Film : "${title}"
Genres : ${(detail.genres || []).map((g: any) => g.name).join(", ")}
Synopsis : ${detail.overview || "Non disponible"}
${detail.release_date || detail.first_air_date ? `Année : ${(detail.release_date || detail.first_air_date).split("-")[0]}` : ""}
${detail.runtime ? `Durée : ${detail.runtime} min` : ""}

Réponds UNIQUEMENT avec ce JSON valide, sans backticks :
{"vector":[32 floats 0.0-1.0],"tags":["tag1","tag2","tag3"],"semantic_axes":{"emotional_depth":0.0,"pacing":0.0,"darkness":0.0,"humor":0.0,"complexity":0.0,"romance":0.0,"suspense":0.0,"action_intensity":0.0,"visual_richness":0.0,"philosophical_depth":0.0,"realism":0.0,"weirdness":0.0,"comfort_level":0.0,"prestige_level":0.0,"mainstreamness":0.0,"twist_factor":0.0,"rewatchability":0.0,"intimacy":0.0,"epic_scale":0.0,"low_cognitive_load":0.0,"surprise_tolerance":0.0},"safety_tags":[],"suitability_tags":["solo","couple"],"cluster_labels":["label1","label2"]}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        thinkingConfig: { thinkingBudget: 0 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, step: "gemini_api", detail: `HTTP ${res.status}: ${body.slice(0, 120)}` };
  }

  const aiData = await res.json();
  // gemini-2.5-flash peut inclure une partie "thought" — on cherche la vraie réponse texte
  const parts: any[] = aiData.candidates?.[0]?.content?.parts ?? [];
  const content = parts.find((p: any) => p.text && !p.thought)?.text ?? parts[0]?.text ?? "";
  if (!content) {
    return { ok: false, step: "gemini_empty", detail: JSON.stringify(aiData).slice(0, 120) };
  }

  let parsed: any;
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, step: "json_parse", detail: content.slice(0, 120) };
  }

  const vector = parsed.vector;
  if (!Array.isArray(vector) || vector.length < 28) {
    return { ok: false, step: "vector_invalid", detail: `length=${vector?.length}` };
  }

  const padded = [...vector];
  while (padded.length < 32) padded.push(0.5);
  const normalized = padded.slice(0, 32).map((v: number) => Math.max(0, Math.min(1, v)));

  const { error } = await supabase.from("movie_embeddings").upsert(
    {
      tmdb_id: detail.id,
      title,
      embedding: `[${normalized.join(",")}]`,
      taste_tags: parsed.tags || [],
      genres: (detail.genres || []).map((g: any) => g.name),
      semantic_axes: parsed.semantic_axes || {},
      safety_tags: parsed.safety_tags || [],
      suitability_tags: parsed.suitability_tags || [],
      cluster_labels: parsed.cluster_labels || [],
      year: (detail.release_date || detail.first_air_date || "").split("-")[0] || null,
      runtime: detail.runtime || detail.episode_run_time?.[0] || null,
      popularity: detail.popularity || 0,
      vote_average: detail.vote_average || 0,
      media_type: mediaType,
      platform_ids: platformIds,
      platform_ids_updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "tmdb_id" },
  );

  if (error) {
    return { ok: false, step: "db_insert", detail: error.message };
  }
  return { ok: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      mode = "seed",           // "seed" | "refresh-platforms"
      pages = 1,
      startPage = 1,
      type = "movie",
      source = "popular",
      batchSize = 3,
      minVoteCount = 50,
      genreId,
      minRating,
      sortBy = "popularity.desc",
      releaseYearMin,          // ex: 1980 → primary_release_date.gte=1980-01-01
      releaseYearMax,          // ex: 1999 → primary_release_date.lte=1999-12-31
      noStreamingFilter = false, // true → retire le filtre with_watch_providers
      originalLanguage,        // ex: "fr" → with_original_language=fr (films français)
      refreshLimit = 20,       // nb de films à rafraîchir en mode refresh-platforms
    } = body;

    // deno-lint-ignore no-undef
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    // deno-lint-ignore no-undef
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // deno-lint-ignore no-undef
    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY not configured — add it in Supabase Secrets");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Mode refresh-platforms : mettre à jour platform_ids des films stales ──
    if (mode === "refresh-platforms") {
      // Films les plus populaires dont platform_ids_updated_at est NULL ou > 30 jours
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleMovies, error: staleErr } = await supabase
        .from("movie_embeddings")
        .select("tmdb_id, title, media_type")
        .or(`platform_ids_updated_at.is.null,platform_ids_updated_at.lt.${cutoff}`)
        .order("popularity", { ascending: false })
        .limit(refreshLimit);

      if (staleErr || !staleMovies?.length) {
        return new Response(
          JSON.stringify({ success: true, mode: "refresh-platforms", stats: { refreshed: 0, stale: 0 } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let refreshed = 0;
      const batchRefresh = staleMovies.slice(0, refreshLimit);
      await Promise.all(
        batchRefresh.map(async (film: any) => {
          try {
            const mediaType: "movie" | "tv" = film.media_type === "tv" ? "tv" : "movie";
            const platformIds = await getProviderIdsFR(film.tmdb_id, mediaType);
            const { error: upErr } = await supabase
              .from("movie_embeddings")
              .update({
                platform_ids: platformIds,
                platform_ids_updated_at: new Date().toISOString(),
              })
              .eq("tmdb_id", film.tmdb_id);
            if (!upErr) refreshed++;
          } catch { /* silencieux */ }
        }),
      );

      console.log(`[refresh-platforms] ${refreshed}/${batchRefresh.length} films mis à jour`);
      return new Response(
        JSON.stringify({ success: true, mode: "refresh-platforms", stats: { refreshed, stale: staleMovies.length } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Récupération des films depuis TMDB ──
    const allMovies: any[] = [];
    for (let page = startPage; page < startPage + pages; page++) {
      let url: string;
      if (source === "trending") {
        url = `https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
      } else if (source === "discover") {
        const params = new URLSearchParams({
          api_key: TMDB_API_KEY,
          language: "fr-FR",
          sort_by: sortBy,
          "vote_count.gte": String(minVoteCount),
          page: String(page),
        });
        if (!noStreamingFilter) {
          params.set("with_watch_providers", "8|381|337|119|350|234|35|1967|11|56");
          params.set("watch_region", "FR");
          params.set("with_watch_monetization_types", "flatrate|free|ads");
        }
        if (genreId) params.set("with_genres", String(genreId));
        if (originalLanguage) params.set("with_original_language", String(originalLanguage));
        if (minRating) params.set("vote_average.gte", String(minRating));
        if (releaseYearMin) params.set("primary_release_date.gte", `${releaseYearMin}-01-01`);
        if (releaseYearMax) params.set("primary_release_date.lte", `${releaseYearMax}-12-31`);
        url = `https://api.themoviedb.org/3/discover/${type}?${params}`;
      } else {
        url = `https://api.themoviedb.org/3/${type}/${source}?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        allMovies.push(...(data.results || []).filter((m: any) => (m.vote_count || 0) >= minVoteCount));
      } catch (e) {
        console.error(`Failed to fetch page ${page}:`, e);
      }
    }

    if (allMovies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, stats: { fetched: 0, already_in_db: 0, processed: 0, errors: 0 } }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 2. Filtrage : exclure les films déjà en base ──
    const tmdbIds = allMovies.map((m) => m.id);
    const { data: existing } = await supabase.from("movie_embeddings").select("tmdb_id").in("tmdb_id", tmdbIds);
    const existingIds = new Set((existing || []).map((r: any) => r.tmdb_id));
    const toProcess = allMovies.filter((m) => !existingIds.has(m.id));

    // Cap à 40 films (Tier 1 = 1000 RPM, pas de délai nécessaire)
    const toProcessCapped = toProcess.slice(0, 40);
    console.log(`Fetched: ${allMovies.length} | Already in DB: ${existingIds.size} | To process: ${toProcessCapped.length}/${toProcess.length}`);

    // ── 3. Génération des embeddings via Google AI ──
    let processed = 0;
    const errorSamples: Record<string, string> = {};

    for (let i = 0; i < toProcessCapped.length; i += 5) {
      const batch = toProcessCapped.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (movie) => {
          try {
            const detailRes = await fetch(
              `https://api.themoviedb.org/3/${type}/${movie.id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
            );
            if (!detailRes.ok) return { ok: false, step: "tmdb_detail", detail: `HTTP ${detailRes.status}` } as EmbedResult;
            const detail = await detailRes.json();
            const platformIds = await getProviderIdsFR(movie.id, type as "movie" | "tv");
            return await generateEmbeddingWithGoogleAI(detail, type, GOOGLE_AI_KEY, supabase, platformIds);
          } catch (e) {
            return { ok: false, step: "exception", detail: String(e).slice(0, 80) } as EmbedResult;
          }
        }),
      );
      for (const r of results) {
        if (r.ok) { processed++; }
        else if (!errorSamples[r.step]) { errorSamples[r.step] = r.detail; }
      }
    }

    const errors = toProcessCapped.length - processed;
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          fetched: allMovies.length,
          already_in_db: existingIds.size,
          processed,
          errors,
          errorSamples,
          total_in_db: (existing?.length || 0) + processed,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("seed-embeddings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
