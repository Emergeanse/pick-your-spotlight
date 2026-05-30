/**
 * Streaming platform deep link and URL utilities.
 * Uses TMDB provider links + platform-specific deep links for direct content access.
 */

export interface StreamingLink {
  name: string;
  logo_path: string;
  url: string;
  deepLink?: string;
  providerId: number;
  color: string;
}

interface PlatformConfig {
  name: string;
  /** Build web URL — receives the TMDB link if available, otherwise falls back to search */
  webUrl: (tmdbLink: string | null, title: string) => string;
  /** Build deep link for mobile — receives tmdbLink and title */
  deepLink?: (tmdbLink: string | null, title: string) => string | null;
  color: string;
}

// TMDB provider_id → platform config
const PLATFORM_MAP: Record<number, PlatformConfig> = {
  8: {
    name: "Netflix",
    // Netflix no longer supports direct deep links; always web fallback
    // The Netflix app will auto-intercept the web URL on mobile
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
    color: "#E50914",
  },
  337: {
    name: "Disney+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.disneyplus.com/search/${encodeURIComponent(title)}`,
    deepLink: (tmdbLink, title) => {
      // Try to extract content ID from TMDB link
      if (tmdbLink) {
        const match = tmdbLink.match(/disneyplus\.com\/.*?\/([^/?]+)$/);
        if (match) return `disneyplus://content/${match[1]}`;
      }
      return `disneyplus://search?q=${encodeURIComponent(title)}`;
    },
    color: "#113CCF",
  },
  119: {
    name: "Prime Video",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.primevideo.com/search?phrase=${encodeURIComponent(title)}`,
    deepLink: (tmdbLink, title) => {
      // Extract ASIN from Amazon URL if available
      if (tmdbLink) {
        const asinMatch = tmdbLink.match(/\/dp\/([A-Z0-9]+)/i) || tmdbLink.match(/asin=([A-Z0-9]+)/i);
        if (asinMatch) return `aiv://aiv/detail?asin=${asinMatch[1]}`;
      }
      return `intent://www.primevideo.com/search?phrase=${encodeURIComponent(title)}#Intent;scheme=https;package=com.amazon.avod.thirdpartyclient;end`;
    },
    color: "#00A8E1",
  },
  350: {
    name: "Apple TV+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
    deepLink: (tmdbLink, title) => {
      if (tmdbLink) {
        // Extract Apple content ID
        const match = tmdbLink.match(/tv\.apple\.com\/.*\/(umc\.[a-z0-9]+)/i);
        if (match) return `videos://${match[1]}`;
      }
      return null;
    },
    color: "#000000",
  },
  381: {
    name: "Canal+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    deepLink: (tmdbLink) => {
      if (tmdbLink) {
        const match = tmdbLink.match(/canalplus\.com\/.*?\/(\d+)/);
        if (match) return `canalplus://content/${match[1]}`;
      }
      return null;
    },
    color: "#1A1A1A",
  },
  538: {
    name: "Canal+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    color: "#1A1A1A",
  },
  685: {
    name: "Canal+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    color: "#1A1A1A",
  },
  193: {
    name: "Canal+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    color: "#1A1A1A",
  },
  1754: {
    name: "Canal+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    color: "#1A1A1A",
  },
  2285: {
    name: "Canal+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    color: "#1A1A1A",
  },
  1967: {
    name: "Molotov",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.molotov.tv/search?q=${encodeURIComponent(title)}`,
    deepLink: (tmdbLink) => {
      if (tmdbLink) {
        const match = tmdbLink.match(/molotov\.tv\/.*?\/(\d+)/);
        if (match) return `molotov://${match[1]}`;
      }
      return null;
    },
    color: "#1E1E2E",
  },
  56: {
    name: "OCS",
    webUrl: (tmdbLink) => tmdbLink || `https://www.ocs.fr`,
    color: "#FF6600",
  },
  236: {
    name: "Crunchyroll",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.crunchyroll.com/search?q=${encodeURIComponent(title)}`,
    color: "#F47521",
  },
  1899: {
    name: "HBO",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://play.max.com/search?q=${encodeURIComponent(title)}`,
    deepLink: (_tmdbLink, title) => `max://search?q=${encodeURIComponent(title)}`,
    color: "#002BE7",
  },
  384: {
    name: "HBO",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://play.max.com/search?q=${encodeURIComponent(title)}`,
    deepLink: (_tmdbLink, title) => `max://search?q=${encodeURIComponent(title)}`,
    color: "#002BE7",
  },
  531: {
    name: "Paramount+",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.paramountplus.com/search/?q=${encodeURIComponent(title)}`,
    color: "#0064FF",
  },
  2: {
    name: "Apple TV",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
    deepLink: (tmdbLink) => {
      if (tmdbLink) {
        const match = tmdbLink.match(/tv\.apple\.com\/.*\/(umc\.[a-z0-9]+)/i);
        if (match) return `videos://${match[1]}`;
      }
      return null;
    },
    color: "#000000",
  },
  3: {
    name: "Google Play",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://play.google.com/store/search?q=${encodeURIComponent(title)}&c=movies`,
    color: "#01875F",
  },
  192: {
    name: "YouTube",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " film complet")}`,
    color: "#FF0000",
  },
  35: {
    name: "Rakuten TV",
    webUrl: (tmdbLink, title) =>
      tmdbLink || `https://www.rakuten.tv/search?q=${encodeURIComponent(title)}`,
    color: "#BF0040",
  },
};

/**
 * Build streaming links for a movie's providers.
 * Now accepts an optional TMDB link per provider for direct content URLs.
 */
// Provider IDs that are sub-brands / add-on channels — skip them in favor of the main platform
const VARIANT_PROVIDER_IDS = new Set([
  // Netflix variants
  1796, // Netflix basic with Ads
  // HBO / Max variants
  1825, // HBO Max Amazon Channel
  // Amazon / Prime variants
  9,    // Amazon Prime Video (duplicate entry in some regions)
  // Apple variants
  // Disney variants
  619,  // Star Plus (merged into Disney+)
]);

// Patterns that indicate a sub-brand or add-on channel (case-insensitive)
const VARIANT_NAME_PATTERNS = [
  /with ads/i,
  /standard with/i,
  /basic with/i,
  /amazon channel/i,
  /apple tv channel/i,
  /roku channel$/i,
  /channel$/i,
];

function isVariantProvider(name: string, providerId: number | null): boolean {
  if (providerId && VARIANT_PROVIDER_IDS.has(providerId)) return true;
  return VARIANT_NAME_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Build streaming links for a movie's providers.
 * Filters out sub-brand / add-on channel variants to keep only main platforms.
 */
export function buildStreamingLinks(
  providers: { name: string; logo_path: string; provider_id?: number; tmdb_link?: string }[],
  movieTitle: string,
): StreamingLink[] {
  const seen = new Set<string>();

  return providers.reduce<StreamingLink[]>((links, p) => {
    const pid = p.provider_id || guessProviderId(p.name);

    // Skip known variant/sub-brand providers
    if (isVariantProvider(p.name, pid)) {
      return links;
    }

    const config = pid ? PLATFORM_MAP[pid] : null;
    const tmdbLink = p.tmdb_link || null;
    const canonicalName = config?.name || p.name;
    const dedupeKey = canonicalName.trim().toLowerCase();

    if (seen.has(dedupeKey)) {
      return links;
    }

    const url = config
      ? config.webUrl(tmdbLink, movieTitle)
      : tmdbLink || `https://www.google.com/search?q=${encodeURIComponent(movieTitle + " " + p.name + " streaming")}`;

    const deepLink = config?.deepLink?.(tmdbLink, movieTitle) || undefined;

    seen.add(dedupeKey);
    links.push({
      name: canonicalName,
      logo_path: p.logo_path,
      url,
      deepLink,
      providerId: pid || 0,
      color: config?.color || "#333333",
    });

    return links;
  }, []);
}

/**
 * Open a streaming link: try deep link first on mobile, fallback to web URL.
 * Provides haptic feedback if available.
 */
export function openStreamingLink(link: StreamingLink): void {
  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }

  // On mobile, try deep link first
  if (link.deepLink && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const start = Date.now();
    const fallbackTimeout = setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.open(link.url, "_blank");
      }
    }, 1500);

    window.location.href = link.deepLink;

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimeout(fallbackTimeout);
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
  } else {
    window.open(link.url, "_blank");
  }
}

function guessProviderId(name: string): number | null {
  const lower = name.toLowerCase();
  if (lower.includes("netflix")) return 8;
  if (lower.includes("disney")) return 337;
  if (lower.includes("prime") || lower.includes("amazon")) return 119;
  if (lower.includes("apple tv+")) return 350;
  if (lower.includes("apple")) return 2;
  if (lower.includes("canal")) return 381;
  if (lower.includes("hbo") || lower.includes("max")) return 1899;
  if (lower.includes("paramount")) return 531;
  if (lower.includes("crunchyroll")) return 236;
  if (lower.includes("molotov")) return 1967;
  if (lower.includes("rakuten")) return 35;
  return null;
}
