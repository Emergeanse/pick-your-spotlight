import { getWatchProviders } from "@/lib/tmdb";

export const ALL_PLATFORMS = [
  // Top 5 affichés en hero landing
  { id: 8,    label: "Netflix",       logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337,  label: "Disney+",       logo: "https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { id: 119,  label: "Amazon Prime",  logo: "https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { id: 350,  label: "Apple TV+",     logo: "https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg" },
  { id: 381,  label: "Canal+",        logo: "https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg" },
  // Autres grandes plateformes
  { id: 236,  label: "Paramount+",    logo: "https://image.tmdb.org/t/p/original/h5DcR0J2EESLitnhR8xLG1QymTE.jpg" },
  { id: 384,  label: "HBO",           logo: "/logos/hbo.png" },
  { id: 35,   label: "Rakuten TV",    logo: "https://image.tmdb.org/t/p/original/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg" },
  { id: 283,  label: "Crunchyroll",   logo: "https://image.tmdb.org/t/p/original/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg" },
  // Plateformes françaises SVOD
  { id: 11,   label: "MUBI",          logo: "https://image.tmdb.org/t/p/original/x570VpH2C9EKDf1riP83rYc5dnL.jpg" },
  { id: 234,  label: "Arte",          logo: "https://image.tmdb.org/t/p/original/vPZrjHe7wvALuwJEXT2kwYLi0gV.jpg" },
  { id: 1754, label: "TF1+",          logo: "https://image.tmdb.org/t/p/original/blrBF9R2ONYu04ifGkYEb3k779N.jpg" },
  { id: 147,  label: "M6+",           logo: "https://image.tmdb.org/t/p/original/tmYzlEKeiWStvXwC1QdpXIASpN4.jpg" },
  { id: 415,  label: "ADN",           logo: "https://image.tmdb.org/t/p/original/w86FOwg0bbgUSHWWnjOTuEjsUvq.jpg" },
  { id: 310,  label: "LaCinetek",     logo: "https://image.tmdb.org/t/p/original/1syoSwH2yIskHUqeOiK9re8AMJC.jpg" },
  { id: 513,  label: "Shadowz",       logo: "https://image.tmdb.org/t/p/original/qwRq7klF8EijYs7XgvxSaYd6v6w.jpg" },
  { id: 1967, label: "Molotov TV",    logo: "https://image.tmdb.org/t/p/original/8qSG9LtUhBQIWy2Fr6fzeW7gBdd.jpg" },
  { id: 300,  label: "Pluto TV",      logo: "https://image.tmdb.org/t/p/original/dB8G41Q6tSL5NBisrIeqByfepBc.jpg" },
  { id: 2601, label: "Pathé Home",    logo: "https://image.tmdb.org/t/p/original/yvui9yFtpWHt0ZrsPelItbuTavI.jpg" },
  { id: 193,  label: "SFR Play",      logo: "https://image.tmdb.org/t/p/original/vo4tm5HBLpctihoSX6bTIG0VB9d.jpg" },
] as const;

// Familles TMDB : un ID "principal" peut avoir plusieurs IDs alias TMDB
export const PLATFORM_FAMILIES: Record<number, number[]> = {
  381:  [381, 538, 685, 193, 1754, 2285],   // Canal+ & variantes
  119:  [119, 1024, 10, 2100],              // Amazon Prime & variantes
  8:    [8, 1796],                          // Netflix & variantes
  337:  [337],                              // Disney+
  56:   [56, 531, 582, 2303],              // Paramount+ (via ID 56)
  236:  [236, 531, 582, 2303],             // Paramount+ (via ID 236)
  384:  [384, 1899, 1825],                 // Max / HBO Max
  1899: [1899, 1825],
  35:   [35],
  234:  [234],
  11:   [11],
  1967: [1967],
  350:  [350],
  147:  [147],
  415:  [415],
  310:  [310],
  513:  [513],
  300:  [300],
  2601: [2601],
  193:  [193],
};

// Labels complets incluant tous les alias TMDB
export const PLATFORM_LABEL_MAP: Record<number, string> = {
  8: "Netflix",     1796: "Netflix",
  119: "Amazon Prime", 1024: "Amazon Prime", 10: "Amazon Prime", 2100: "Amazon",
  337: "Disney+",
  381: "Canal+",    538: "Canal+ Cinéma",  685: "Canal+ Séries",
  193: "Canal+ Box Office", 1754: "myCanal", 2285: "Cine+",
  56: "Paramount+", 236: "Paramount+", 531: "Paramount+", 582: "Paramount+", 2303: "Paramount+",
  384: "Max",       1899: "Max",       1825: "Max",
  350: "Apple TV+",
  35: "Rakuten TV",
  234: "Arte",
  11: "MUBI",
  1967: "Molotov TV",
  147: "M6+",
  415: "ADN",
  310: "LaCinetek",
  513: "Shadowz",
  300: "Pluto TV",
  2601: "Pathé Home",
  2077: "Universciné",
};

// Chemins logo TMDB (relatifs, sans base URL) incluant tous les alias
export const PLATFORM_LOGO_PATH_MAP: Record<number, string> = {
  8:    "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg", 1796: "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
  119:  "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",  1024: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",
  10:   "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",  2100: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",
  337:  "/97yvRBw1GzX7fXprcF80er19ot.jpg",
  381:  "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",  538: "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",
  685:  "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",  193: "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",
  1754: "/blrBF9R2ONYu04ifGkYEb3k779N.jpg",  2285: "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",
  56:   "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",  236: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
  531:  "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",  582: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
  2303: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
  350:  "/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg",
  384:  "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",  1899: "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
  1825: "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
  35:   "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
  234:  "/vPZrjHe7wvALuwJEXT2kwYLi0gV.jpg",
  11:   "/x570VpH2C9EKDf1riP83rYc5dnL.jpg",
  1967: "/8qSG9LtUhBQIWy2Fr6fzeW7gBdd.jpg",
  147:  "/tmYzlEKeiWStvXwC1QdpXIASpN4.jpg",
  415:  "/w86FOwg0bbgUSHWWnjOTuEjsUvq.jpg",
  310:  "/1syoSwH2yIskHUqeOiK9re8AMJC.jpg",
  513:  "/qwRq7klF8EijYs7XgvxSaYd6v6w.jpg",
  300:  "/dB8G41Q6tSL5NBisrIeqByfepBc.jpg",
  2601: "/yvui9yFtpWHt0ZrsPelItbuTavI.jpg",
};

export type WatchProvider = {
  name: string;
  logo_path: string;
  provider_id?: number;
};

/** Expand user-selected platform IDs to all TMDB alias IDs in the same family. */
export function expandUserPlatformIds(userPlatformIds: number[]): Set<number> {
  return new Set(userPlatformIds.flatMap((id) => PLATFORM_FAMILIES[id] ?? [id]));
}

export function buildProvidersFromPlatformIds(
  platformIds: number[],
  userPlatformIds: number[],
): { name: string; logo_path: string; provider_id: number }[] {
  if (!userPlatformIds.length) return [];
  const expandedUserIds = expandUserPlatformIds(userPlatformIds);
  const matched = platformIds.filter((id) => expandedUserIds.has(id));
  const seenIds = new Set<number>();
  const seenLogos = new Set<string>();
  return matched
    .filter((id) => {
      const logo = PLATFORM_LOGO_PATH_MAP[id] ?? "";
      if (!PLATFORM_LABEL_MAP[id] || seenIds.has(id) || (logo && seenLogos.has(logo))) return false;
      seenIds.add(id);
      if (logo) seenLogos.add(logo);
      return true;
    })
    .map((id) => ({
      name: PLATFORM_LABEL_MAP[id],
      logo_path: PLATFORM_LOGO_PATH_MAP[id] ?? "",
      provider_id: id,
    }));
}

export function filterProvidersByUserPlatforms(
  providers: WatchProvider[],
  userPlatformIds: number[],
): WatchProvider[] {
  if (!userPlatformIds.length) return providers;
  const expandedIds = expandUserPlatformIds(userPlatformIds);
  const filtered = providers.filter((p) => p.provider_id != null && expandedIds.has(p.provider_id));
  return filtered.length > 0 ? filtered : providers;
}

export async function resolveProviders(
  movie: {
    id: number;
    first_air_date?: string | null;
    platform_ids?: number[];
    watchProviders?: WatchProvider[];
  },
  userPlatformIds: number[],
): Promise<WatchProvider[]> {
  const embeddingPlatformIds = movie.platform_ids;
  if (Array.isArray(embeddingPlatformIds) && embeddingPlatformIds.length > 0 && userPlatformIds.length) {
    const fromEmbedding = buildProvidersFromPlatformIds(embeddingPlatformIds, userPlatformIds);
    if (fromEmbedding.length > 0) return fromEmbedding;
  }
  const cached = movie.watchProviders;
  if (cached && Array.isArray(cached)) return filterProvidersByUserPlatforms(cached, userPlatformIds);
  const mediaType = movie.first_air_date ? "tv" : "movie";
  try {
    return filterProvidersByUserPlatforms(await getWatchProviders(movie.id, mediaType), userPlatformIds);
  } catch {
    return [];
  }
}

/** Up to two platform names for personalized loading copy (e.g. "Netflix et Disney+"). */
export function formatPlatformNamesForLoading(platformIds: number[], max = 2): string {
  return platformIds
    .map((id) => PLATFORM_LABEL_MAP[id])
    .filter(Boolean)
    .slice(0, max)
    .join(" et ");
}
