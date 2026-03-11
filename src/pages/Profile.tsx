import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Bookmark, Settings, Film, Tv, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getLikedMovies } from "@/lib/liked-movies";
import { getWatchlist } from "@/lib/watchlist";
import { getPosterUrl } from "@/lib/tmdb";

const PLATFORM_MAP: Record<number, { label: string; logo: string }> = {
  8: { label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  337: { label: "Disney+", logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
  119: { label: "Prime", logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg" },
  350: { label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg" },
  1899: { label: "Max", logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg" },
  381: { label: "Canal+", logo: "https://image.tmdb.org/t/p/original/dVMVBMOlOUPFfbkSKNnTGg3JX5b.jpg" },
  236: { label: "Paramount+", logo: "https://image.tmdb.org/t/p/original/fi83B1ozBIOCEo7cWoevSYS0tXi.jpg" },
};

type Tab = "liked" | "watchlist";

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [likedMovies, setLikedMovies] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("liked");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Load profile
    supabase.from("profiles").select("*").eq("id", user.id).single()
      .then(({ data }) => setProfile(data));

    // Load liked movies
    getLikedMovies().then(setLikedMovies).catch(console.error);

    // Load watchlist
    getWatchlist().then(setWatchlist).catch(console.error);
  }, [user, navigate]);

  if (!user || !profile) return null;

  const displayName = profile.display_name || user.email?.split("@")[0] || "Cinéphile";
  const genres = profile.favorite_genres || [];
  const platforms = profile.preferred_platforms || [];

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Pick</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-foreground/50 hover:text-foreground text-xs font-sans gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* User info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <span className="text-2xl font-serif text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif mb-1">{displayName}</h1>
          <p className="text-muted-foreground text-sm font-sans">{user.email}</p>
        </motion.div>

        {/* Taste summary */}
        {genres.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h2 className="text-lg font-serif mb-3">Tes goûts</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre: string) => (
                <span
                  key={genre}
                  className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-sans font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Platforms */}
        {platforms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <h2 className="text-lg font-serif mb-3">Tes plateformes</h2>
            <div className="flex gap-2">
              {platforms.map((id: number) => {
                const p = PLATFORM_MAP[id];
                if (!p) return null;
                return (
                  <div key={id} className="flex flex-col items-center gap-1">
                    <img src={p.logo} alt={p.label} className="w-10 h-10 rounded-xl object-cover border border-border/30" />
                    <span className="text-[10px] text-muted-foreground font-sans">{p.label}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex gap-1 mb-5 bg-card rounded-xl p-1">
            <button
              onClick={() => setActiveTab("liked")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-sans transition-all ${
                activeTab === "liked"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className="w-4 h-4" />
              Aimés ({likedMovies.length})
            </button>
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-sans transition-all ${
                activeTab === "watchlist"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              À voir ({watchlist.length})
            </button>
          </div>

          {/* Movie grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 md:gap-3 pb-8">
            {(activeTab === "liked" ? likedMovies : watchlist).map((item: any) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="aspect-[2/3] rounded-xl overflow-hidden group relative"
              >
                <img
                  src={getPosterUrl(item.poster_path, "w342")}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] font-sans text-foreground/90 line-clamp-2 leading-tight">
                    {item.title}
                  </p>
                </div>
              </motion.div>
            ))}

            {(activeTab === "liked" ? likedMovies : watchlist).length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground text-sm font-sans">
                  {activeTab === "liked" 
                    ? "Aucun film aimé pour le moment" 
                    : "Ta watchlist est vide"}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
