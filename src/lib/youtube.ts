import { supabase } from "@/integrations/supabase/client";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  url: string;
}

export type YouTubeCategory = "documentary" | "film" | "cinema-culture" | "educational";

export async function getYouTubeRecommendations(
  category: YouTubeCategory,
  query?: string,
  maxResults = 8
): Promise<YouTubeVideo[]> {
  const { data, error } = await supabase.functions.invoke("youtube-recommendations", {
    body: { category, query, maxResults },
  });
  if (error) throw error;
  return data?.videos || [];
}

/** Parse ISO 8601 duration (PT1H30M, PT25M12S, etc.) to readable string */
export function formatDuration(iso: string): string {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}`;
  return `${m} min`;
}

/** Format view count */
export function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M vues`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K vues`;
  return `${count} vues`;
}
