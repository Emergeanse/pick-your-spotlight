const TMDB_BASE = "https://api.themoviedb.org/3";

export function getTmdbApiKey(): string {
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) throw new Error("TMDB_API_KEY is not configured — add it in Supabase Secrets");
  return key;
}

export function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${TMDB_BASE}${normalized}`);
  url.searchParams.set("api_key", getTmdbApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
