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

async function fetchTmdbPage(mediaType: "movie" | "tv", page: number, minVoteCount: number): Promise<{ results: any[]; totalPages: number }> {
  const endpoint = mediaType === "movie" ? "discover/movie" : "discover/tv";
  const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&with_original_language=fr&watch_region=FR&sort_by=vote_count.desc&vote_count.gte=${minVoteCount}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB discover error: ${res.status}`);
  const data = await res.json();
  return { results: data.results || [], totalPages: Math.min(data.total_pages || 1, 500) };
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

async function processFilm(film: any, mediaType: "movie" | "tv", supabaseUrl: string, serviceKey: string) {
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
    if (!res.ok) throw new Error(`generate-embedding ${res.status}`);
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      startPage = 1,       // Page de départ
      maxPages = 1,        // Nombre de pages à traiter en une invocation (défaut 1)
      batchSize = 8,       // Films max à traiter par page
      mediaType = "movie" as "movie" | "tv",
      minVoteCount = 20,
    } = body;

    let totalAdded = 0, totalSkipped = 0, totalErrors = 0;
    let lastPage = startPage;
    let finalTotalPages = 1;
    const allDetails: any[] = [];

    for (let page = startPage; page < startPage + maxPages; page++) {
      const { results: tmdbFilms, totalPages } = await fetchTmdbPage(mediaType, page, minVoteCount);
      finalTotalPages = totalPages;
      lastPage = page;

      const tmdbIds = tmdbFilms.map((f: any) => f.id);
      const { data: existing } = await supabase
        .from("movie_embeddings").select("tmdb_id").in("tmdb_id", tmdbIds);

      const existingIds = new Set((existing || []).map((r: any) => r.tmdb_id));
      const toProcess = tmdbFilms.filter((f: any) => !existingIds.has(f.id)).slice(0, batchSize);
      const skipped = tmdbFilms.length - toProcess.length;
      totalSkipped += skipped;

      if (toProcess.length > 0) {
        const results = await Promise.all(
          toProcess.map((film: any) => processFilm(film, mediaType, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY))
        );
        const added = results.filter(r => r.status === "added").length;
        const errors = results.filter(r => r.status === "error").length;
        totalAdded += added;
        totalErrors += errors;
        allDetails.push(...results.map(r => ({ page, ...r })));
        console.log(`[enrich] Page ${page}/${totalPages} — +${added} ajoutés, ${skipped} ignorés, ${errors} erreurs`);
      } else {
        console.log(`[enrich] Page ${page}/${totalPages} — tout déjà en base, on continue`);
      }

      if (page >= totalPages) break;
    }

    const nextPage = lastPage < finalTotalPages ? lastPage + 1 : null;

    return new Response(JSON.stringify({
      pagesTraitées: `${startPage}→${lastPage}`,
      totalPages: finalTotalPages,
      nextPage,
      totalAdded,
      totalSkipped,
      totalErrors,
      details: allDetails,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[enrich-french-films] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
