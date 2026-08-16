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

    // Get the user from token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: caller } = await userClient.auth.getUser(token);
    if (!caller?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if this user is a test account
    const { data: profile } = await adminClient.from("profiles").select("is_test_account").eq("id", caller.user.id).single();
    if (!profile?.is_test_account) {
      return new Response(JSON.stringify({ error: "Not a test account" }), { status: 400, headers: corsHeaders });
    }

    const userId = caller.user.id;

    // Delete all user data from all tables (cascade will handle some, but be explicit)
    await adminClient.from("liked_movies").delete().eq("user_id", userId);
    await adminClient.from("watchlist").delete().eq("user_id", userId);
    await adminClient.from("user_interactions").delete().eq("user_id", userId);
    await adminClient.from("daily_usage").delete().eq("user_id", userId);
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("cinematic_profiles").delete().eq("user_id", userId);
    await adminClient.from("user_taste_vectors").delete().eq("user_id", userId);
    await adminClient.from("subscriptions").delete().eq("user_id", userId);
    await adminClient.from("friendships").delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    await    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
