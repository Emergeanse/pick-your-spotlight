import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Bookmark, Check, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getLikedMovies } from "@/lib/liked-movies";
import { getWatchlist } from "@/lib/watchlist";
import { getPosterUrl } from "@/lib/tmdb";

const ALL_PLATFORMS = [
  { id: 8, label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, label: "Disney+", logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
  { id: 119, label: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg" },
  { id: 350, label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg" },
  { id: 381, label: "Canal+", logo: "https://image.tmdb.org/t/p/original/dVMVBMOlOUPFfbkSKNnTGg3JX5b.jpg" },
  { id: 56, label: "OCS", logo: "https://image.tmdb.org/t/p/original/3E0RkIEQrrGYazs63NMsn3XONT6.jpg" },
  { id: 236, label: "Paramount+", logo: "https://image.tmdb.org/t/p/original/fi83B1ozBIOCEo7cWoevSYS0tXi.jpg" },
  { id: 1899, label: "Max", logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg" },
];

const ALL_GENRES = [
  "Action", "Aventure", "Animation", "Comédie", "Crime", "Documentaire",
  "Drame", "Famille", "Fantastique", "Histoire", "Horreur", "Musique",
  "Mystère", "Romance", "Science-Fiction", "Thriller", "Guerre", "Western",
];

const ALL_ERAS = [
  { id: "classic", label: "Classiques", desc: "Avant 1980" },
  { id: "80s90s", label: "80s–90s", desc: "1980–1999" },
  { id: "2000s", label: "2000s", desc: "2000–2015" },
  { id: "recent", label: "Récents", desc: "2016+" },
];

type Tab = "liked" | "watchlist";

const Profile = () => {
  const { user, isReady, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [likedMovies, setLikedMovies] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("liked");
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedEras, setSelectedEras] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    const loadData = async () => {
      setProfileLoading(true);
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(data);
        setSelectedPlatforms(data?.preferred_platforms || []);
        setSelectedGenres(data?.favorite_genres || []);
        // Eras not yet persisted in DB — keep local only

        const [liked, wl] = await Promise.all([
          getLikedMovies().catch(() => []),
          getWatchlist().catch(() => []),
        ]);
        setLikedMovies(liked);
        setWatchlist(wl);
      } catch (e) {
        console.error(e);
      } finally {
        setProfileLoading(false);
      }
    };

    loadData();
  }, [user, isReady, navigate]);

  const togglePlatform = (id: number) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const toggleEra = (id: string) => {
    setSelectedEras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("profiles").update({
        preferred_platforms: selectedPlatforms,
        favorite_genres: selectedGenres,
      }).eq("id", user.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Detect unsaved changes
  const hasChanges = profile && (
    JSON.stringify(selectedPlatforms.sort()) !== JSON.stringify((profile.preferred_platforms || []).sort()) ||
    JSON.stringify(selectedGenres.sort()) !== JSON.stringify((profile.favorite_genres || []).sort())
  );

  if (!isReady || profileLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Cinéphile";

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate("/app")}
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

      <div className="max-w-2xl mx-auto px-5 py-8 pb-32">
        {/* User info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <span className="text-2xl font-serif text-primary">{displayName.charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif mb-1">{displayName}</h1>
          <p className="text-muted-foreground text-sm font-sans">{user.email}</p>
        </motion.div>

        {/* Platforms */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h2 className="text-lg font-serif mb-3">Tes plateformes</h2>
          <div className="grid grid-cols-4 gap-2">
            {ALL_PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`relative bg-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                    isSelected ? "border-primary neon-glow" : "border-transparent hover:border-primary/30"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <img src={platform.logo} alt={platform.label} className="w-8 h-8 rounded-lg object-cover" />
                  <span className="font-sans text-[10px] tracking-wide text-foreground/90 leading-tight text-center">{platform.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Genres */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <h2 className="text-lg font-serif mb-3">Tes genres préférés</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-card border-transparent text-foreground/60 hover:border-primary/20 hover:text-foreground"
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Eras */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <h2 className="text-lg font-serif mb-3">Tes époques préférées</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_ERAS.map((era) => {
              const isSelected = selectedEras.includes(era.id);
              return (
                <button
                  key={era.id}
                  onClick={() => toggleEra(era.id)}
                  className={`rounded-xl p-3 flex flex-col items-center gap-0.5 transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? "bg-primary/10 border-primary/30"
                      : "bg-card border-transparent hover:border-primary/20"
                  }`}
                >
                  <span className={`font-sans text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground/80"}`}>{era.label}</span>
                  <span className="text-[10px] text-muted-foreground font-sans">{era.desc}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Tabs — Liked / Watchlist */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex gap-1 mb-5 bg-card rounded-xl p-1">
            <button
              onClick={() => setActiveTab("liked")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-sans transition-all ${
                activeTab === "liked" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className="w-4 h-4" />
              Aimés ({likedMovies.length})
            </button>
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-sans transition-all ${
                activeTab === "watchlist" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              À voir ({watchlist.length})
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 md:gap-3 pb-8">
            {(activeTab === "liked" ? likedMovies : watchlist).map((item: any) => (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="aspect-[2/3] rounded-xl overflow-hidden group relative">
                <img src={getPosterUrl(item.poster_path, "w342")} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] font-sans text-foreground/90 line-clamp-2 leading-tight">{item.title}</p>
                </div>
              </motion.div>
            ))}
            {(activeTab === "liked" ? likedMovies : watchlist).length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground text-sm font-sans">
                  {activeTab === "liked" ? "Aucun film aimé pour le moment" : "Ta watchlist est vide"}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/20 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="max-w-2xl mx-auto flex justify-end">
            <Button variant="hero" size="xl" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Profile;
