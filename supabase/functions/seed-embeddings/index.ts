import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

// Sources disponibles :
// "popular"   → films/séries les plus populaires du moment
// "top_rated" → films/séries les mieux notés de tous les temps
// "trending"  → tendances de la semaine
// "discover"  → recherche avancée TMDB (genres, note min, etc.)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      pages = 1,          // nombre de pages TMDB à traiter (20 films par page)
      startPage = 1,      // page de départ (pour reprendre là où on s'est arrêté)
      type = "movie",     // "movie" ou "tv"
      source = "popular", // "popular", "top_rated", "trending", "discover"
      batchSize = 3,      // films traités en parallèle (ne pas dépasser 5)
      minVoteCount = 50,  // nombre minimum de votes TMDB (filtre qualité)
      genreId,            // optionnel : ID genre TMDB pour cibler un genre
      minRating,          // optionnel : note minimale TMDB (ex: 7.0)
    } = body;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Récupération des films depuis TMDB ──
    const allMovies: any[] = [];
    for (let page = startPage; page < startPage + pages; page++) {
      let url: string;

      if (source === "trending") {
        url = `https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
      } else if (source === "discover") {
        const params = new URLSearchParams({
          api_key: TMDB_API_KEY, language: "fr-FR", sort_by: "popularity.desc",
          "vote_count.gte": String(minVoteCount),
          page: String(page),
        });
        if (genreId) params.set("with_genres", String(genreId));
        if (minRating) params.set("vote_average.gte", String(minRating));
        url = `https://api.themoviedb.org/3/discover/${type}?${params}`;
      } else {
        // popular ou top_rated
        url = `https://api.themoviedb.org/3/${type}/${source}?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
      }

      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const results = (data.results || []).filter((m: any) => (m.vote_count || 0) >= minVoteCount);
        allMovies.push(...results);
      } catch (e) {
        console.error(`Failed to fetch page ${page}:`, e);
      }
    }

    if (allMovies.length === 0) {
      return new Response(JSON.stringify({ success: true, stats: { fetched: 0, skipped: 0, processed: 0, errors: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Filtrage : exclure les films déjà en base ──
    const tmdbIds = allMovies.map((m) => m.id);
    const { data: existing } = await supabase
      .from("movie_embeddings")
      .select("tmdb_id")
      .in("tmdb_id", tmdbIds);

    const existingIds = new Set((existing || []).map((r: any) => r.tmdb_id));
    const toProcess = allMovies.filter((m) => !existingIds.has(m.id));

    console.log(`Fetched: ${allMovies.length} | Already in DB: ${existingIds.size} | To process: ${toProcess.length}`);

    // ── 3. Génération des embeddings par batch ──
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);

      await Promise.all(batch.map(async (movie) => {
        try {
          // Détails complets depuis TMDB
          const detailRes = await fetch(
            `https://api.themoviedb.org/3/${type}/${movie.id}?api_key=${TMDB_API_KEY}&language=fr-FR`
          );
          if (!detailRes.ok) { errors++; return; }
          const detail = await detailRes.json();

          // Appel à generate-embedding (gère le cache DB lui-même)
          const embedRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              tmdbId: detail.id,
              title: detail.title || detail.name,
              overview: detail.overview,
              genres: (detail.genres || []).map((g: any) => g.name),
              year: (detail.release_date || detail.first_air_date || "").split("-")[0],
              runtime: detail.runtime || detail.episode_run_time?.[0],
              popularity: detail.popularity,
              voteAverage: detail.vote_average,
              mediaType: type,
            }),
          });

          if (embedRes.ok) {
            processed++;
            console.log(`✓ ${detail.title || detail.name}`);
          } else {
            const errText = await embedRes.text();
            console.error(`✗ ${detail.title || detail.name}: ${errText}`);
            errors++;
          }
        } catch (e) {
          console.error(`Error processing movie ${movie.id}:`, e);
          errors++;
        }
      }));
    }

    const totalInDb = (existing?.length || 0) + processed;

    return new Response(JSON.stringify({
      success: true,
      stats: {
        fetched: allMovies.length,
        already_in_db: existingIds.size,
        processed,
        errors,
        total_in_db: totalInDb,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("seed-embeddings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
