// Shared auth gates for Lovable edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function unauthorized(corsHeaders: Record<string, string>, msg = "Non authentifié", status = 401) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireAuth(req: Request, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null as null, response: unauthorized(corsHeaders) };
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return { user: null as null, response: unauthorized(corsHeaders, "Auth not configured", 500) };
  }
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return { user: null as null, response: unauthorized(corsHeaders) };
  }
  return { user: data.user, response: null as Response | null };
}

export async function requireAdmin(req: Request, corsHeaders: Record<string, string>) {
  const auth = await requireAuth(req, corsHeaders);
  if (!auth.user) return auth;
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  const { data: roleCheck } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleCheck) {
    return { user: null as null, response: unauthorized(corsHeaders, "Accès refusé", 403) };
  }
  return auth;
}
