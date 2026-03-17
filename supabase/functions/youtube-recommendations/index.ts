import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

// Curated cinema culture channels
const CINEMA_CHANNELS = [
  "UCjFqcJQXGZ6T6sxyFB-5i6A", // Every Frame a Painting
  "UCErSSa3CaP_GJxmFpdjG9Jw", // Nerdwriter1
  "UCWTFGPpNQ0Ms6afXhaWDiRw", // Now You See It
  "UC9-y-6csu5WGm29I7JiwpnA", // Computerphile (docs tech)
  "UCsXVk37bltHxD1rDPwtNM8Q", // Kurzgesagt (docs éducatifs)
  "UC7dF9qfBMXrSlaaFFDvV_Yg", // Trash (FR)
  "UCaNlbnghtwlsGF-KzAFThqA", // ScienceEtonnante (FR)
];

interface SearchParams {
  query?: string;
  category?: "documentary" | "film" | "cinema-culture" | "educational";
  maxResults?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not configured");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { category = "documentary", query, maxResults = 8 } = await req.json() as SearchParams;

    let searchQuery = query || "";
    let params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: String(maxResults),
      key: YOUTUBE_API_KEY,
      regionCode: "FR",
      relevanceLanguage: "fr",
    });

    switch (category) {
      case "documentary":
        searchQuery = searchQuery || "documentaire complet";
        params.set("videoDuration", "long"); // > 20 min
        params.set("videoCategoryId", "27"); // Education
        break;
      case "film":
        searchQuery = searchQuery || "film complet français";
        params.set("videoDuration", "long");
        break;
      case "cinema-culture":
        searchQuery = searchQuery || "analyse cinéma film critique";
        params.set("videoDuration", "medium"); // 4-20 min
        break;
      case "educational":
        searchQuery = searchQuery || "documentaire éducatif science histoire";
        params.set("videoDuration", "medium");
        params.set("videoCategoryId", "27");
        break;
    }

    params.set("q", searchQuery);

    const searchRes = await fetch(`${YOUTUBE_API}/search?${params}`);
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      throw new Error(`YouTube API error [${searchRes.status}]: ${errText}`);
    }

    const searchData = await searchRes.json();
    const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      return new Response(JSON.stringify({ videos: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video details (duration, view count, etc.)
    const detailsRes = await fetch(
      `${YOUTUBE_API}/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`
    );
    const detailsData = await detailsRes.json();

    const videos = (detailsData.items || []).map((v: any) => ({
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
      channelTitle: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      duration: v.contentDetails?.duration,
      viewCount: parseInt(v.statistics?.viewCount || "0"),
      url: `https://www.youtube.com/watch?v=${v.id}`,
    }));

    return new Response(JSON.stringify({ videos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("YouTube recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
