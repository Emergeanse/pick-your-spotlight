/**
 * Streaming platform deep link and URL utilities.
 * Maps TMDB provider IDs to platform-specific search/browse URLs.
 */

export interface StreamingLink {
  name: string;
  logo_path: string;
  url: string;
  deepLink?: string;
  providerId: number;
}

interface PlatformConfig {
  name: string;
  searchUrl: (title: string) => string;
  deepLink?: (title: string) => string;
  color: string;
}

// TMDB provider_id → platform config
const PLATFORM_MAP: Record<number, PlatformConfig> = {
  8: {
    name: "Netflix",
    searchUrl: (title) => `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
    deepLink: (title) => `nflx://www.netflix.com/search?q=${encodeURIComponent(title)}`,
    color: "#E50914",
  },
  337: {
    name: "Disney+",
    searchUrl: (title) => `https://www.disneyplus.com/search/${encodeURIComponent(title)}`,
    deepLink: (title) => `disneyplus://search?q=${encodeURIComponent(title)}`,
    color: "#113CCF",
  },
  119: {
    name: "Prime Video",
    searchUrl: (title) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(title)}`,
    deepLink: (title) => `intent://www.primevideo.com/search?phrase=${encodeURIComponent(title)}#Intent;scheme=https;package=com.amazon.avod.thirdpartyclient;end`,
    color: "#00A8E1",
  },
  350: {
    name: "Apple TV",
    searchUrl: (title) => `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
    color: "#000000",
  },
  381: {
    name: "Canal+",
    searchUrl: (title) => `https://www.canalplus.com/recherche/${encodeURIComponent(title)}`,
    color: "#1A1A1A",
  },
  56: {
    name: "OCS",
    searchUrl: () => `https://www.ocs.fr`,
    color: "#FF6600",
  },
  236: {
    name: "Crunchyroll",
    searchUrl: (title) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(title)}`,
    color: "#F47521",
  },
  1899: {
    name: "HBO",
    searchUrl: (title) => `https://play.max.com/search?q=${encodeURIComponent(title)}`,
    deepLink: (title) => `max://search?q=${encodeURIComponent(title)}`,
    color: "#002BE7",
  },
  531: {
    name: "Paramount+",
    searchUrl: (title) => `https://www.paramountplus.com/search/?q=${encodeURIComponent(title)}`,
    color: "#0064FF",
  },
  2: {
    name: "Apple iTunes",
    searchUrl: (title) => `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
    color: "#000000",
  },
  3: {
    name: "Google Play",
    searchUrl: (title) => `https://play.google.com/store/search?q=${encodeURIComponent(title)}&c=movies`,
    color: "#01875F",
  },
  192: {
    name: "YouTube",
    searchUrl: (title) => `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " film complet")}`,
    color: "#FF0000",
  },
};

/**
 * Build streaming links for a movie's providers.
 */
export function buildStreamingLinks(
  providers: { name: string; logo_path: string; provider_id?: number }[],
  movieTitle: string,
): StreamingLink[] {
  return providers.map((p) => {
    const pid = p.provider_id || guessProviderId(p.name);
    const config = pid ? PLATFORM_MAP[pid] : null;

    const url = config
      ? config.searchUrl(movieTitle)
      : `https://www.google.com/search?q=${encodeURIComponent(movieTitle + " " + p.name + " streaming")}`;

    return {
      name: config?.name || p.name,
      logo_path: p.logo_path,
      url,
      deepLink: config?.deepLink?.(movieTitle),
      providerId: pid || 0,
    };
  });
}

/**
 * Open a streaming link: try deep link first, fallback to web URL.
 */
export function openStreamingLink(link: StreamingLink): void {
  // On mobile, try the deep link first
  if (link.deepLink && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    // Use a timeout approach: if the app doesn't open within 1.5s, fallback to web
    const start = Date.now();
    const fallbackTimeout = setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.open(link.url, "_blank");
      }
    }, 1500);

    window.location.href = link.deepLink;

    // If page becomes hidden (app opened), clear the fallback
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
  if (lower.includes("apple tv")) return 350;
  if (lower.includes("canal")) return 381;
  if (lower.includes("hbo") || lower.includes("max")) return 1899;
  if (lower.includes("paramount")) return 531;
  if (lower.includes("crunchyroll")) return 236;
  return null;
}
