/**
 * delete-my-account — l'utilisateur efface son compte lui-même.
 *
 * Ne prend aucun identifiant de cible : le compte supprimé est toujours celui du
 * jeton d'authentification. Contrairement à `admin-delete-user`, réservée aux
 * comptes de test et incomplète, celle-ci couvre les vingt-quatre tables
 * recensées dans `_shared/user-data.ts`.
 *
 * L'effacement est définitif : aucune corbeille, aucun délai de grâce. D'où la
 * confirmation explicite exigée dans le corps de la requête.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth } from "../_shared/auth.ts";
import { USER_DATA_TABLES } from "../_shared/user-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Mot que l'interface fait saisir avant d'appeler cette fonction. */
const CONFIRMATION = "SUPPRIMER";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.user) return auth.response!;

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== CONFIRMATION) {
      return new Response(
        JSON.stringify({ error: `Confirmation manquante : envoyer { "confirm": "${CONFIRMATION}" }.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = auth.user.id;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Séquentiel et dans l'ordre de USER_DATA_TABLES : les lignes qui en
    // référencent d'autres partent en premier. En parallèle, une contrainte de
    // clé étrangère ferait échouer une suppression au hasard.
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const { table, columns } of USER_DATA_TABLES) {
      for (const column of columns) {
        const { error } = await admin.from(table).delete().eq(column, userId);
        if (error) failed.push(`${table}.${column}: ${error.message}`);
        else deleted.push(`${table}.${column}`);
      }
    }

    if (failed.length > 0) {
      // On n'efface pas le compte d'authentification tant que des données
      // subsistent : un compte supprimé laissant des lignes orphelines et
      // inaccessibles serait pire que pas de suppression du tout.
      console.error("delete-my-account — suppressions en échec:", failed);
      return new Response(
        JSON.stringify({
          error:
            "Certaines données n'ont pas pu être supprimées. Le compte a été conservé pour ne rien laisser d'orphelin. Contacte l'équipe Pick.",
          details: failed.length,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("delete-my-account — échec suppression auth:", authError);
      return new Response(
        JSON.stringify({
          error:
            "Tes données ont bien été supprimées, mais le compte de connexion subsiste. Contacte l'équipe Pick pour finaliser.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, tablesTraitees: deleted.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-my-account error:", e);
    return new Response(JSON.stringify({ error: "Suppression impossible pour le moment." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
