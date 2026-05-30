import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const TMDB_BASE = "https://api.themoviedb.org/3";

// Mapping genre IDs TMDB → noms français (cohérent avec movie_embeddings)
const GENRE_MAP_MOVIE: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Familial", 14: "Fantastique",
  36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
  10749: "Romance", 878: "Science-Fiction", 10770: "Téléfilm", 53: "Thriller",
  10752: "Guerre", 37: "Western",
};

const GENRE_MAP_TV: Record<number, string> = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Familial", 10762: "Kids",
  9648: "Mystère", 10763: "News", 10764: "Reality", 10765: "Science-Fiction & Fantastique",
  10766: "Soap", 10767: "Talk", 10768: "War & Politics", 37: "Western",
};

async function fetchTmdbPage(mediaType: "movie" | "tv", page: number, minVoteCount: number): Promise<{ results: any[]; totalPages: number }> {
  const endpoint = mediaType === "movie" ? "discover/movie" : "discover/tv";
  const dateField = mediaType === "movie" ? "vote_count.gte" : "vote_count.gte";
  const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&with_original_language=fr&watch_region=FR&sort_by=vote_count.desc&${dateField}=${minVoteCount}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB discover error: ${res.status}`);
  const data = await res.json();
  return { results: data.results || [], totalPages: data.total_pages || 1 };
}

async function fetchTmdbDetail(tmdbId: number, mediaType: "movie" | "tv"): Promise<any> {
  const res = await fetch(`${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
  if (!res.ok) return null;
  return res.json();
}

async function getProviderIdsFR(tmdbId: number, mediaType: "movie" | "tv"): Promise<number[]> {
  try {
    const res = await fetch(`${TMDB_BASE}/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    const fr = data?.results?.FR;
    if (!fr) return [];
    return [...(fr.flatrate || []), ...(fr.free || []), ...(fr.ads || [])]
      .map((p: any) => Number(p.provider_id));
  } catch { return []; }
}

async function processFilm(
  film: any,
  mediaType: "movie" | "tv",
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ tmdbId: number; status: "added" | "error"; title: string; error?: string }> {
  const tmdbId = film.id;
  const title = film.title || film.name || `TMDB #${tmdbId}`;

  try {
    const [detail, platformIds] = await Promise.all([
      fetchTmdbDetail(tmdbId, mediaType),
      getProviderIdsFR(tmdbId, mediaType),
    ]);

    if (!detail) throw new Error("TMDB detail fetch failed");

    const genreMap = mediaType === "movie" ? GENRE_MAP_MOVIE : GENRE_MAP_TV;
    const genres = (detail.genres || []).map((g: any) => genreMap[g.id] || g.name).filter(Boolean);
    const year = (detail.release_date || detail.first_air_date || "").substring(0, 4) || null;
    const runtime = mediaType === "movie"
      ? (detail.runtime || null)
      : (detail.episode_run_time?.[0] || null);

    const payload = {
      tmdbId,
      title: detail.title || detail.name || title,
      overview: detail.overview || "",
      genres,
      year,
      runtime,
      popularity: detail.popularity || 0,
      voteAverage: detail.vote_average || 0,
      mediaType,
      platformIds,
      originalLanguage: detail.original_language || "fr",
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-embedding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`generate-embedding failed: ${res.status} ${err}`);
    }

    return { tmdbId, status: "added", title: payload.title };
  } catch (e) {
    return { tmdbId, status: "error", title, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      page = 1,           // Page TMDB à traiter (1–500)
      batchSize = 8,      // Films à traiter par invocation (max ~10 pour le timeout)
      mediaType = "movie" as "movie" | "tv",
      minVoteCount = 20,  // Ignore les films avec moins de votes
    } = body;

    // 1. Récupère la page TMDB
    const { results: tmdbFilms, totalPages } = await fetchTmdbPage(mediaType, page, minVoteCount);
    console.log(`[enrich] Page ${page}/${totalPages} — ${tmdbFilms.length} films TMDB`);

    // 2. Récupère les IDs déjà en base (batch 1000)
    const tmdbIds = tmdbFilms.map((f: any) => f.id);
    const { data: existing } = await supabase
      .from("movie_embeddings")
      .select("tmdb_id")
      .in("tmdb_id", tmdbIds);

    const existingIds = new Set((existing || []).map((r: any) => r.tmdb_id));
    const toProcess = tmdbFilms.filter((f: any) => !existingIds.has(f.id)).slice(0, batchSize);

    console.log(`[enrich] ${existingIds.size} déjà en base, ${toProcess.length} à traiter`);

    if (toProcess.length === 0) {
      return new Response(JSON.stringify({
        page,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        processed: 0,
        added: 0,
        skipped: tmdbFilms.length,
        errors: 0,
        details: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Traite les films en parallèle (batchSize simultanés)
    const results = await Promise.all(
      toProcess.map((film: any) => processFilm(film, mediaType, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY))
    );

    const added = results.filter(r => r.status === "added").length;
    const errors = results.filter(r => r.status === "error").length;

    console.log(`[enrich] ✅ ${added} ajoutés, ❌ ${errors} erreurs`);

    return new Response(JSON.stringify({
      page,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      processed: toProcess.length,
      added,
      skipped: tmdbFilms.length - toProcess.length,
      errors,
      details: results.map(r => ({
        tmdbId: r.tmdbId,
        title: r.title,
        status: r.status,
        ...(r.error ? { error: r.error } : {}),
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[enrich-french-films] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
