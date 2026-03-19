import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionCode } = await req.json();
    if (!sessionCode) {
      return new Response(JSON.stringify({ error: "Missing sessionCode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Check auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // Return session info for unauthenticated users (public lookup)
      const { data: session } = await admin
        .from("group_sessions")
        .select("id, name, invite_code, creator_id")
        .eq("invite_code", sessionCode.toUpperCase())
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get creator name
      const { data: creator } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", session.creator_id)
        .single();

      return new Response(
        JSON.stringify({
          session: { id: session.id, name: session.name, invite_code: session.invite_code },
          creator: { displayName: creator?.display_name || "Quelqu'un" },
          requiresAuth: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticated user flow
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.user.id;

    // Find session
    const { data: session } = await admin
      .from("group_sessions")
      .select("id, name, invite_code, creator_id")
      .eq("invite_code", sessionCode.toUpperCase())
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-add friendship if not already friends
    if (session.creator_id !== userId) {
      const { data: existing } = await admin
        .from("friendships")
        .select("id")
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${session.creator_id}),and(requester_id.eq.${session.creator_id},addressee_id.eq.${userId})`
        );

      if (!existing || existing.length === 0) {
        await admin.from("friendships").insert({
          requester_id: userId,
          addressee_id: session.creator_id,
          status: "accepted",
        });
      }
    }

    // Join session (upsert to avoid duplicates)
    const { data: existingMember } = await admin
      .from("group_session_members")
      .select("id")
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingMember) {
      await admin.from("group_session_members").insert({
        session_id: session.id,
        user_id: userId,
      });
    }

    // Get creator name
    const { data: creator } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", session.creator_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        session: { id: session.id, name: session.name },
        creator: { displayName: creator?.display_name || "Quelqu'un" },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("join-session error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
