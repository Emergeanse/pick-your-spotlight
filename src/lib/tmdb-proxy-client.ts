import { supabase } from "@/integrations/supabase/client";

export async function fetchFromTMDB(
  path: string,
  params: Record<string, string> = {},
): Promise<any> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const { data, error } = await supabase.functions.invoke("tmdb-proxy", {
    body: {
      path: normalizedPath,
      params: {
        language: "fr-FR",
        region: "FR",
        watch_region: "FR",
        ...params,
      },
    },
  });

  if (error) {
    // TMDB 404 = ressource absente : on renvoie null au lieu de crasher l'UI.
    const msg = error.message || "";
    if (/404/.test(msg)) return null;
    throw new Error(`TMDB proxy: ${msg}`);
  }
  if (data?.error) {
    if (/404/.test(data.error)) return null;
    throw new Error(data.error);
  }
  return data;
}
