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
    const { data: roleCheck } = await adminClient.from("user_roles").select("role").eq("user_id", caller.user.id).eq("role", "admin").maybeSingle();
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId requis" }), { status: 400, headers: corsHeaders });
    }

    // Verify target is a test account
    const { data: profile } = await adminClient.from("profiles").select("is_test_account").eq("id", userId).single();
    if (!profile?.is_test_account) {
      return new Response(JSON.stringify({ error: "Seuls les comptes test peuvent être supprimés" }), { status: 400, headers: corsHeaders });
    }

    // Delete all user data from all tables
    await Promise.all([
      adminClient.from("liked_movies").delete().eq("user_id", userId),
      adminClient.from("watchlist").delete().eq("user_id", userId),
      adminClient.from("user_interactions").delete().eq("user_id", userId),
      adminClient.from("daily_usage").delete().eq("user_id", userId),
      adminClient.from("notifications").delete().eq("user_id", userId),
      adminClient.from("cinematic_profiles").delete().eq("user_id", userId),
      adminClient.from("user_taste_vectors").delete().eq("user_id", userId),
      adminClient.from("subscriptions").delete().eq("user_id", userId),
      adminClient.from("friendships").delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      adminClient.from("user_roles").delete().eq("user_id", userId),
    ]);

    // Delete profile then auth user
    await adminClient.from("profiles").delete().eq("id", userId);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Données supprimées mais erreur auth: " + deleteError.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
