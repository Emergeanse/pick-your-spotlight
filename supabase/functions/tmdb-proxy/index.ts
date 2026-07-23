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

    const res = await fetch(tmdbUrl(path, safeParams));
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
