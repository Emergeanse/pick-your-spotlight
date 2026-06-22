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

  if (error) throw new Error(`TMDB proxy: ${error.message}`);
  if (data?.error) throw new Error(data.error);
  return data;
}
