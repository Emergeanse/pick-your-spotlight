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

    const { displayName, birthYear } = await req.json();

    // Auto-generate a random email and password
    const randomId = crypto.randomUUID().slice(0, 8);
    const fakeEmail = `test-${randomId}@pick-test.local`;
    const fakePassword = crypto.randomUUID();

    // Create user via admin API (auto-confirmed, no email sent)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: fakeEmail,
      password: fakePassword,
      email_confirm: true,
      user_metadata: { display_name: displayName || `Test ${randomId}` },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders });
    }

    // Update profile with extra data + mark as test account
    if (newUser?.user) {
      await adminClient.from("profiles").update({
        display_name: displayName || `Test ${randomId}`,
        birth_year: birthYear || null,
        is_test_account: true,
        onboarding_completed: false,
        tour_completed: false,
        activation_completed: false,
        activation_step: "train_20",
      }).eq("id", newUser.user.id);
    }

    // Return credentials so the frontend can auto-login
    return new Response(JSON.stringify({
      success: true,
      userId: newUser?.user?.id,
      email: fakeEmail,
      password: fakePassword,
      displayName: displayName || `Test ${randomId}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
