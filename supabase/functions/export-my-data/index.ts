/**
 * export-my-data — l'utilisateur récupère tout ce que Pick détient sur lui.
 *
 * Ne prend aucun identifiant en paramètre : le compte exporté est toujours celui
 * du jeton d'authentification. Impossible d'exporter les données de quelqu'un
 * d'autre, même en falsifiant le corps de la requête.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth } from "../_shared/auth.ts";
import { USER_DATA_TABLES } from "../_shared/user-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.user) return auth.response!;

    const userId = auth.user.id;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const data: Record<string, unknown> = {};
    const labels: Record<string, string> = {};
    const errors: string[] = [];

    for (const { table, columns, label } of USER_DATA_TABLES) {
      const rows: unknown[] = [];
      for (const column of columns) {
        const { data: found, error } = await admin.from(table).select("*").eq(column, userId);
        if (error) {
          // Une table absente ou renommée ne doit pas faire échouer tout l'export :
          // mieux vaut livrer 23 tables sur 24 en le disant que rien du tout.
          errors.push(`${table}.${column}: ${error.message}`);
          continue;
        }
        rows.push(...(found ?? []));
      }
      data[table] = rows;
      labels[table] = label;
    }

    const payload = {
      export: {
        genereLe: new Date().toISOString(),
        compte: { id: userId, email: auth.user.email ?? null },
        aPropos:
          "Export complet des données rattachées à ce compte Pick. Chaque clé de « donnees » correspond à une table ; « libelles » en donne la traduction en français.",
        tablesExportees: USER_DATA_TABLES.length,
        ...(errors.length > 0 ? { tablesEnErreur: errors } : {}),
      },
      libelles: labels,
      donnees: data,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pick-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    console.error("export-my-data error:", e);
    return new Response(JSON.stringify({ error: "Export impossible pour le moment." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
