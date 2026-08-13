import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_PATH = /^\/[a-z0-9/_-]+$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;

    const { path, params = {} } = await req.json();
    if (typeof path !== "string" || !ALLOWED_PATH.test(path) || path.includes("..")) {
      return new Response(JSON.stringify({ error: "Chemin TMDB invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeParams: Record<string, string> = {};
    if (params && typeof params === "object" && !Array.isArray(params)) {
      for (const [key, value] of Object.entries(params)) {
        if (typeof key === "string" && typeof value === "string") {
          safeParams[key] = value;
        }
      }
    }

    // TMDB coupe parfois la connexion (ECONNRESET) : on retente avec backoff.
    const url = tmdbUrl(path, safeParams);
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.status >= 500 && attempt < 2) {
          lastErr = new Error(`TMDB ${res.status}`);
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        res = null;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    if (!res) {
      return new Response(
        JSON.stringify({ error: `TMDB indisponible: ${lastErr instanceof Error ? lastErr.message : "réseau"}` }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (res.status === 404) {
      // Ressource TMDB inexistante — renvoyer 200 + null pour que le client ne crash pas.
      return new Response(JSON.stringify({ data: null, notFound: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `TMDB Error: ${res.status}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tmdb-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
