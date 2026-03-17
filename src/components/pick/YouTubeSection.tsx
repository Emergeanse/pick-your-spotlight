import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, ExternalLink, Loader2 } from "lucide-react";
import {
  getYouTubeRecommendations,
  formatDuration,
  formatViews,
  type YouTubeVideo,
  type YouTubeCategory,
} from "@/lib/youtube";

const CATEGORIES: { id: YouTubeCategory; label: string; emoji: string }[] = [
  { id: "documentary", label: "Documentaires", emoji: "🎬" },
  { id: "film", label: "Films gratuits", emoji: "🎥" },
  { id: "cinema-culture", label: "Culture ciné", emoji: "🧠" },
  { id: "educational", label: "Éducatif", emoji: "📚" },
];

const YouTubeVideoCard = ({ video, index }: { video: YouTubeVideo; index: number }) => {
  const handleOpen = () => {
    window.open(video.url, "_blank", "noopener");
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleOpen}
      className="group shrink-0 w-[260px] text-left"
    >
      {/* Thumbnail */}
      <div className="relative rounded-xl overflow-hidden mb-2 aspect-video">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        {/* Play icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>
        {/* Duration badge */}
        {video.duration && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-sans font-medium">
            {formatDuration(video.duration)}
          </span>
        )}
      </div>
      {/* Info */}
      <p className="text-[13px] font-sans font-medium text-foreground line-clamp-2 leading-snug mb-0.5">
        {video.title}
      </p>
      <div className="flex items-center gap-2 text-foreground/40 text-[11px] font-sans">
        <span className="truncate max-w-[140px]">{video.channelTitle}</span>
        {video.viewCount > 0 && <span>· {formatViews(video.viewCount)}</span>}
      </div>
    </motion.button>
  );
};

const YouTubeSection = () => {
  const [category, setCategory] = useState<YouTubeCategory>("documentary");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getYouTubeRecommendations(category)
      .then((data) => {
        if (!cancelled) setVideos(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [category]);

  return (
    <div className="mt-8 mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-5">
        <div className="w-5 h-5 rounded bg-red-600/20 flex items-center justify-center">
          <Play className="w-3 h-3 text-red-500 fill-red-500" />
        </div>
        <h2 className="text-base font-serif text-foreground">YouTube</h2>
        <span className="text-foreground/30 text-[11px] font-sans">— Docs & Films gratuits</span>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-5 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
              category === c.id
                ? "bg-red-600/15 border-red-600/30 text-red-400"
                : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <p className="text-foreground/30 text-sm font-sans">Impossible de charger les vidéos</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
          {videos.map((video, i) => (
            <YouTubeVideoCard key={video.id} video={video} index={i} />
          ))}
          {videos.length === 0 && (
            <p className="text-foreground/30 text-sm font-sans py-8">Aucune vidéo trouvée</p>
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeSection;
