import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Bookmark, Check, LogOut, Loader2, X, Ban, Star, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getLikedMovies } from "@/lib/liked-movies";
import { getWatchlist } from "@/lib/watchlist";
import { getPosterUrl } from "@/lib/tmdb";

const ALL_PLATFORMS = [
  { id: 8, label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, label: "Disney+", logo: "https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { id: 119, label: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { id: 350, label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg" },
  { id: 381, label: "Canal+", logo: "https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg" },
  { id: 236, label: "Paramount+", logo: "/logos/paramount-plus.png" },
  { id: 384, label: "HBO", logo: "/logos/hbo.png" },
  { id: 35, label: "Rakuten TV", logo: "https://image.tmdb.org/t/p/original/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg" },
  { id: 192, label: "YouTube", logo: "https://image.tmdb.org/t/p/original/pTnn5JwWr4p3pG8H6VrpiQo7Vs0.jpg" },
  { id: 283, label: "Crunchyroll", logo: "https://image.tmdb.org/t/p/original/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg" },
  { id: 188, label: "YouTube Premium", logo: "https://image.tmdb.org/t/p/original/rMb93u1tBeErSYLv79zSTR07UdO.jpg" },
  { id: 2, label: "Apple TV", logo: "https://image.tmdb.org/t/p/original/SPnB1qiCkYfirS2it3hZORwGVn.jpg" },
  { id: 3, label: "Google Play", logo: "https://image.tmdb.org/t/p/original/8z7rC8uIDaTM91X0ZfkRf04ydj2.jpg" },
  { id: 1967, label: "Molotov TV", logo: "https://image.tmdb.org/t/p/original/8qSG9LtUhBQIWy2Fr6fzeW7gBdd.jpg" },
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
  const [excludedPlatforms, setExcludedPlatforms] = useState<number[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [excludedGenres, setExcludedGenres] = useState<string[]>([]);
  const [selectedEras, setSelectedEras] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
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
        setExcludedPlatforms((data as any)?.excluded_platforms || []);
        setSelectedGenres(data?.favorite_genres || []);
        setExcludedGenres((data as any)?.excluded_genres || []);

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

  // Tri-state toggle: unselected → selected → excluded → unselected
  const togglePlatform = (id: number) => {
    if (selectedPlatforms.includes(id)) {
      // selected → excluded
      setSelectedPlatforms(prev => prev.filter(p => p !== id));
      setExcludedPlatforms(prev => [...prev, id]);
    } else if (excludedPlatforms.includes(id)) {
      // excluded → unselected
      setExcludedPlatforms(prev => prev.filter(p => p !== id));
    } else {
      // unselected → selected
      setSelectedPlatforms(prev => [...prev, id]);
    }
  };

  const toggleGenre = (g: string) => {
    if (selectedGenres.includes(g)) {
      // selected → excluded
      setSelectedGenres(prev => prev.filter(x => x !== g));
      setExcludedGenres(prev => [...prev, g]);
    } else if (excludedGenres.includes(g)) {
      // excluded → unselected
      setExcludedGenres(prev => prev.filter(x => x !== g));
    } else {
      // unselected → selected
      setSelectedGenres(prev => [...prev, g]);
    }
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
        excluded_genres: excludedGenres,
        excluded_platforms: excludedPlatforms,
      } as any).eq("id", user.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Detect unsaved changes
  const hasChanges = profile && (
    JSON.stringify([...selectedPlatforms].sort()) !== JSON.stringify([...(profile.preferred_platforms || [])].sort()) ||
    JSON.stringify([...selectedGenres].sort()) !== JSON.stringify([...(profile.favorite_genres || [])].sort()) ||
    JSON.stringify([...excludedPlatforms].sort()) !== JSON.stringify([...((profile as any).excluded_platforms || [])].sort()) ||
    JSON.stringify([...excludedGenres].sort()) !== JSON.stringify([...((profile as any).excluded_genres || [])].sort())
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
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-serif">Tes plateformes</h2>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans mb-3">
            Clique une fois pour <span className="text-primary font-medium">sélectionner</span>, deux fois pour <span className="text-destructive font-medium">exclure</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ALL_PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              const isExcluded = excludedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`relative bg-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                    isSelected
                      ? "border-primary neon-glow"
                      : isExcluded
                        ? "border-destructive/40 opacity-60"
                        : "border-transparent hover:border-primary/30"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  {isExcluded && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                      <Ban className="w-2.5 h-2.5 text-destructive-foreground" />
                    </div>
                  )}
                  <img src={platform.logo} alt={platform.label} className={`w-8 h-8 rounded-lg object-cover ${isExcluded ? "grayscale" : ""}`} />
                  <span className="font-sans text-[10px] tracking-wide text-foreground/90 leading-tight text-center">{platform.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Genres */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-serif">Tes genres</h2>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans mb-3">
            Clique une fois pour <span className="text-primary font-medium">aimer</span>, deux fois pour <span className="text-destructive font-medium">exclure</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              const isExcluded = excludedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : isExcluded
                        ? "bg-destructive/10 border-destructive/30 text-destructive line-through"
                        : "bg-card border-transparent text-foreground/60 hover:border-primary/20 hover:text-foreground"
                  }`}
                >
                  {isExcluded && <Ban className="w-3 h-3" />}
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
