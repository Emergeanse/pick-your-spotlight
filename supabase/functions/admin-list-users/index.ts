import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: caller } = await userClient.auth.getUser();
    if (!caller?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: corsHeaders });
    }

    // Fetch all auth users
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;

    // Fetch all profiles
    const { data: profiles } = await adminClient.from("profiles").select("id, display_name, birth_year, is_test_account, created_at, onboarding_completed, total_recommendations, streak_count");

    // Merge auth data with profiles
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const users = (authUsers?.users || []).map((u: any) => {
      const profile = profileMap.get(u.id) || {};
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        display_name: (profile as any).display_name || u.user_metadata?.display_name || null,
        birth_year: (profile as any).birth_year || null,
        is_test_account: (profile as any).is_test_account || false,
        onboarding_completed: (profile as any).onboarding_completed || false,
        total_recommendations: (profile as any).total_recommendations || 0,
        streak_count: (profile as any).streak_count || 0,
      };
    });

    // Sort: most recent first
    users.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any).message }), { status: 500, headers: corsHeaders });
  }
});
