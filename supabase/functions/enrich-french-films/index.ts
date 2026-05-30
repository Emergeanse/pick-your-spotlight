import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const TMDB_BASE = "https://api.themoviedb.org/3";

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

async function fetchTmdbPage(mediaType: "movie" | "tv", page: number, minVoteCount: number) {
  const endpoint = mediaType === "movie" ? "discover/movie" : "discover/tv";
  const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&with_original_language=fr&watch_region=FR&sort_by=vote_count.desc&vote_count.gte=${minVoteCount}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return { results: data.results || [], totalPages: Math.min(data.total_pages || 1, 500) };
}

async function fetchTmdbDetail(tmdbId: number, mediaType: "movie" | "tv") {
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

async function processFilm(film: any, mediaType: "movie" | "tv", supabaseUrl: string, serviceKey: string) {
  const tmdbId = film.id;
  const title = film.title || film.name || `TMDB #${tmdbId}`;
  try {
    const [detail, platformIds] = await Promise.all([
      fetchTmdbDetail(tmdbId, mediaType),
      getProviderIdsFR(tmdbId, mediaType),
    ]);
    if (!detail) throw new Error("TMDB detail failed");

    const genreMap = mediaType === "movie" ? GENRE_MAP_MOVIE : GENRE_MAP_TV;
    const genres = (detail.genres || []).map((g: any) => genreMap[g.id] || g.name).filter(Boolean);
    const year = (detail.release_date || detail.first_air_date || "").substring(0, 4) || null;
    const runtime = mediaType === "movie" ? (detail.runtime || null) : (detail.episode_run_time?.[0] || null);

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-embedding`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({
        tmdbId, title: detail.title || detail.name || title,
        overview: detail.overview || "", genres, year, runtime,
        popularity: detail.popularity || 0, voteAverage: detail.vote_average || 0,
        mediaType, platformIds, originalLanguage: detail.original_language || "fr",
      }),
    });
    if (!res.ok) throw new Error(`embedding ${res.status}`);
    return { tmdbId, status: "added" as const, title: detail.title || detail.name || title };
  } catch (e) {
    return { tmdbId, status: "error" as const, title, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      startPage = 1,
      scanUntilPage = 500, // Scanne jusqu'à cette page pour trouver des nouveaux films
      batchSize = 8,       // Films à traiter quand on en trouve
      mediaType = "movie" as "movie" | "tv",
      minVoteCount = 20,
    } = body;

    let scannedPages = 0;
    let processedPage: number | null = null;
    let totalAdded = 0, totalErrors = 0, totalSkipped = 0;
    let finalTotalPages = 1;
    let details: any[] = [];

    // Scanne les pages rapidement jusqu'à en trouver une avec des nouveaux films
    for (let page = startPage; page <= scanUntilPage; page++) {
      const { results: tmdbFilms, totalPages } = await fetchTmdbPage(mediaType, page, minVoteCount);
      finalTotalPages = totalPages;

      if (tmdbFilms.length === 0 || page > totalPages) break;

      // Vérifie quels films sont déjà en base (rapide, pas de Gemini)
      const tmdbIds = tmdbFilms.map((f: any) => f.id);
      const { data: existing } = await supabase
        .from("movie_embeddings").select("tmdb_id").in("tmdb_id", tmdbIds);

      const existingIds = new Set((existing || []).map((r: any) => r.tmdb_id));
      const newFilms = tmdbFilms.filter((f: any) => !existingIds.has(f.id));
      scannedPages++;

      if (newFilms.length === 0) {
        // Page entièrement couverte → on passe à la suivante (rapide, ~200ms)
        console.log(`[enrich] Page ${page} — déjà couverte, scan suivant`);
        continue;
      }

      // Nouveaux films trouvés → on les traite (Gemini, ~3s chacun)
      processedPage = page;
      const toProcess = newFilms.slice(0, batchSize);
      totalSkipped += tmdbFilms.length - toProcess.length;
      console.log(`[enrich] Page ${page} — ${toProcess.length} nouveaux films à traiter`);

      const results = await Promise.all(
        toProcess.map((film: any) => processFilm(film, mediaType, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY))
      );

      totalAdded = results.filter(r => r.status === "added").length;
      totalErrors = results.filter(r => r.status === "error").length;
      details = results;
      break; // On s'arrête après avoir traité une page avec des nouveaux films
    }

    const nextPage = processedPage !== null
      ? processedPage + 1
      : (startPage + scannedPages <= finalTotalPages ? startPage + scannedPages : null);

    return new Response(JSON.stringify({
      scannedPages,
      processedPage,
      totalPages: finalTotalPages,
      nextPage,
      added: totalAdded,
      skipped: totalSkipped,
      errors: totalErrors,
      details: details.map(r => ({ tmdbId: r.tmdbId, title: r.title, status: r.status, ...(r.error ? { error: r.error } : {}) })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[enrich] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
