import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  Check, ChevronDown, ChevronRight, LogOut, Loader2, Info, Camera, Pencil, Shield,
  ArrowLeft, Sparkles, Brain, Film, Tv, Trophy, Eye, Heart, Bookmark, TrendingUp, Users,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import ProfilePreferences from "@/components/pick/ProfilePreferences";
import { ALL_PLATFORMS } from "@/lib/platforms";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import { getMyPreferences } from "@/lib/preferences";
import CinemaDNA from "@/components/pick/CinemaDNA";
import TasteTrainer from "@/components/pick/TasteTrainer";
import GenrePreferences from "@/components/pick/GenrePreferences";
import CinemaAvatar from "@/components/pick/CinemaAvatar";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import profileBackground from "@/assets/profile-background.png";
import squirrelHappy from "@/assets/Happy.png";
import squirrelCritique from "@/assets/Critique.png";
import squirrelExigeant from "@/assets/Exigeant.png";

const TROPHY_CATEGORIES = [
  {
    key: "recos",
    label: "Recommandations reçues",
    milestones: [
      { count: 1,    label: "Premier pick",     icon: "🎬" },
      { count: 10,   label: "Habitué",           icon: "🎞️" },
      { count: 50,   label: "Explorateur",       icon: "🎟️" },
      { count: 100,  label: "Connaisseur",       icon: "📽️" },
      { count: 250,  label: "Cinéphile",         icon: "🎦" },
      { count: 500,  label: "Critique d'art",    icon: "🏆" },
      { count: 1000, label: "Maître absolu",     icon: "👑" },
    ],
  },
  {
    key: "liked",
    label: "Films & séries likés",
    milestones: [
      { count: 3,   label: "Coup de cœur",      icon: "🍿" },
      { count: 10,  label: "Passionné",          icon: "🎟️" },
      { count: 25,  label: "Critique",           icon: "🎭" },
      { count: 50,  label: "Collectionneur",     icon: "📽️" },
      { count: 100, label: "Oracle du goût",     icon: "🌟" },
      { count: 200, label: "Légende",            icon: "🏆" },
      { count: 500, label: "Panthéon",           icon: "👑" },
    ],
  },
  {
    key: "people",
    label: "Acteurs & réalisateurs",
    milestones: [
      { count: 1,   label: "Premier favori",    icon: "🎭" },
      { count: 5,   label: "Fan",               icon: "🎬" },
      { count: 15,  label: "Fin connaisseur",   icon: "🎥" },
      { count: 30,  label: "Expert casting",    icon: "🎞️" },
      { count: 50,  label: "Talent scouter",    icon: "🌟" },
      { count: 100, label: "Maître des talents", icon: "🏆" },
      { count: 200, label: "Légende du 7e art", icon: "👑" },
    ],
  },
  {
    key: "seen",
    label: "Films lancés via Pick",
    milestones: [
      { count: 1,   label: "1er visionnage",    icon: "📺" },
      { count: 5,   label: "Soirée ciné",       icon: "🎞️" },
      { count: 15,  label: "Ciné-club",         icon: "🍿" },
      { count: 30,  label: "Cinémathèque",      icon: "🎦" },
      { count: 75,  label: "Vidéothèque",       icon: "📼" },
      { count: 150, label: "Archives Pick",     icon: "🏛️" },
      { count: 300, label: "Grand écran",       icon: "👑" },
    ],
  },
];

function computeDetailedConfidence(data: {
  totalRecos: number; acceptedRecos: number; likedCount: number;
  watchlistCount: number; streakCount: number; peopleEvaluated: number; genresSelected: number;
}) {
  const { totalRecos, acceptedRecos, likedCount, watchlistCount, streakCount, peopleEvaluated, genresSelected } = data;
  const totalSignals = totalRecos + likedCount + watchlistCount;
  const volumeScore = Math.min(Math.sqrt(totalSignals) * 3.5, 25);
  const acceptRate = totalRecos > 0 ? acceptedRecos / totalRecos : 0;
  const acceptScore = Math.min(acceptRate * 25, 25);
  const streakScore = Math.min(streakCount * 2, 10);
  const trainingScore = Math.min(likedCount * 1.5, 15);
  const peopleScore = Math.min(Math.sqrt(peopleEvaluated) * 3, 15);
  const genresScore = Math.min(genresSelected, 10);
  const total = Math.round(volumeScore + acceptScore + streakScore + trainingScore + peopleScore + genresScore);
  return {
    total: Math.min(total, 100),
    breakdown: [
      { label: "Données collectées",      score: Math.round(volumeScore),  max: 25, detail: `${totalSignals} interactions` },
      { label: "Taux de satisfaction",    score: Math.round(acceptScore),  max: 25, detail: totalRecos > 0 ? `${Math.round(acceptRate * 100)}% de recos validées` : "Pas encore de données" },
      { label: "Régularité",              score: Math.round(streakScore),  max: 10, detail: streakCount > 0 ? `Série de ${streakCount}` : "Commence une série" },
      { label: "Films & séries évalués",  score: Math.round(trainingScore),max: 15, detail: `${likedCount} titres évalués` },
      { label: "Acteurs & Réalisateurs",  score: Math.round(peopleScore),  max: 15, detail: peopleEvaluated > 0 ? `${peopleEvaluated} personnes évaluées` : "Entraîne tes préférences" },
      { label: "Genres favoris",          score: genresScore,              max: 10, detail: genresSelected > 0 ? `${genresSelected}/10 genres sélectionnés` : "Sélectionne tes genres" },
    ],
  };
}

const Profile = () => {
  const { user, isReady, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAdmin();

  // ── Préférences ──
  const [profile, setProfile] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [matchThreshold, setMatchThreshold] = useState<number>(80);
  const [defaultMediaType, setDefaultMediaType] = useState<"both" | "movie" | "tv">("both");
  const [defaultMaxDuration, setDefaultMaxDuration] = useState<number | null>(null);
  const [recommendationCount, setRecommendationCount] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(() => searchParams.get("openPlatforms") === "1");
  const platformSectionRef = useRef<HTMLElement>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Mon Cinéma ──
  const [cinemaLoading, setCinemaLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [showDNA, setShowDNA] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);
  const [likedMovies, setLikedMovies] = useState<any[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [dnaTitle, setDnaTitle] = useState<string | null>(null);
  const [dnaLevel, setDnaLevel] = useState<string | null>(null);
  const [dnaArchetype, setDnaArchetype] = useState<string | null>(null);
  const [genreStats, setGenreStats] = useState<{ genre: string; count: number }[]>([]);
  const [movieVsSeries, setMovieVsSeries] = useState({ movies: 0, series: 0 });
  const [showConfidenceDetail, setShowConfidenceDetail] = useState(false);
  const [peopleEvaluated, setPeopleEvaluated] = useState(0);
  const [genresSelected, setGenresSelected] = useState(0);
  const [genresExcluded, setGenresExcluded] = useState(0);
  const [showGenres, setShowGenres] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTrophies, setShowTrophies] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadProfile();
    loadCinema();
  }, [user, isReady]);

  useEffect(() => {
    if (searchParams.get("openPlatforms") === "1" && platformSectionRef.current) {
      setTimeout(() => platformSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleReset = () => { setShowTrainer(false); setShowDNA(false); };
    window.addEventListener("cinema-reset", handleReset);
    return () => window.removeEventListener("cinema-reset", handleReset);
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setSelectedPlatforms(data?.preferred_platforms || []);
      setMinRating((data as any)?.min_rating || 5);
      setMatchThreshold((data as any)?.match_threshold ?? 80);
      setDefaultMediaType(((data as any)?.default_media_type as any) || "both");
      setDefaultMaxDuration((data as any)?.default_max_duration ?? null);
      setDisplayName(data?.display_name || user.email?.split("@")[0] || "");
      setAvatarUrl((data as any)?.avatar_url || null);
      setRecommendationCount(Math.min((data as any)?.default_recommendation_count ?? 3, 3));
    } catch (e) { console.error(e); }
    finally { setProfileLoading(false); }
  };

  const loadCinema = async () => {
    if (!user) return;
    setCinemaLoading(true);
    try {
      const [engData, likedData, dnaData, { count: wlCount }, { count: peopleCount }, myPrefs, { count: seenCnt }] = await Promise.all([
        getEngagementData(user.id),
        getLikedMovies().catch(() => []),
        supabase.from("cinematic_profiles" as any).select("personality_title, dna_archetype, global_level").eq("user_id", user.id).maybeSingle(),
        supabase.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_people_preferences" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
        getMyPreferences().catch(() => []),
        supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feedback_type", "seen"),
      ]);
      setEngagement(engData);
      setLikedMovies(likedData);
      setWatchlistCount(wlCount || 0);
      setPeopleEvaluated(peopleCount || 0);
      setSeenCount(seenCnt || 0);
      setGenresSelected(myPrefs.filter((p) => p.tag.category === "genre" && p.weight > 0).length);
      if (dnaData.data) {
        const d = dnaData.data as any;
        setDnaTitle(d.personality_title || null);
        setDnaLevel(d.global_level || null);
        setDnaArchetype(d.dna_archetype || null);
      }
      const genreCounts: Record<string, number> = {};
      let movies = 0, series = 0;
      likedData.forEach((m: any) => {
        (m.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (m.media_type === "tv" || m.first_air_date) series++; else movies++;
      });
      setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })));
      setMovieVsSeries({ movies, series });
    } catch (e) { console.error(e); }
    finally { setCinemaLoading(false); }
  };

  const radarData = useMemo(() => {
    if (genreStats.length === 0) return [];
    const top = genreStats.slice(0, 8);
    const max = top[0]?.count || 1;
    return top.map(gs => ({
      genre: gs.genre.length > 10 ? gs.genre.slice(0, 9) + "…" : gs.genre,
      fullGenre: gs.genre,
      value: Math.round((gs.count / max) * 100),
      count: gs.count,
    }));
  }, [genreStats]);

  const confidence = useMemo(() => {
    if (!engagement) return null;
    return computeDetailedConfidence({
      totalRecos: engagement.totalRecommendations,
      acceptedRecos: engagement.acceptedRecommendations,
      likedCount: likedMovies.length,
      watchlistCount,
      streakCount: engagement.streakCount,
      peopleEvaluated,
      genresSelected,
    });
  }, [engagement, likedMovies.length, watchlistCount, peopleEvaluated, genresSelected]);

  const togglePlatform = (id: number) => setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() } as any).eq("id", user.id);
    if (!error) { setProfile((prev: any) => ({ ...prev, display_name: displayName.trim() })); setEditingName(false); toast({ title: "Pseudo mis à jour" }); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Image trop lourde", description: "Maximum 5 Mo", variant: "destructive" }); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("id", user.id);
      setAvatarUrl(publicUrl); setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast({ title: "Photo de profil mise à jour" });
    } catch (err) { console.error(err); toast({ title: "Erreur lors de l'upload", variant: "destructive" }); }
    finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        preferred_platforms: selectedPlatforms,
        excluded_platforms: [],
        min_rating: minRating,
        match_threshold: matchThreshold,
        default_media_type: defaultMediaType,
        default_max_duration: defaultMaxDuration,
        default_recommendation_count: recommendationCount,
      } as any).eq("id", user.id);
      if (error) throw error;
      try {
        const { setLikedPlatforms, setSinglePreference } = await import("@/lib/preferences");
        const ratingKey = minRating >= 8 ? "excellent" : minRating >= 7 ? "great" : minRating >= 6 ? "good" : "any";
        const durationKey = defaultMaxDuration == null ? "any" : defaultMaxDuration <= 90 ? "short" : defaultMaxDuration <= 120 ? "medium" : "long";
        await Promise.all([
          setLikedPlatforms(selectedPlatforms, "explicit"),
          setSinglePreference("media_type", defaultMediaType || "both", "explicit"),
          setSinglePreference("rating_threshold", ratingKey, "explicit"),
          setSinglePreference("duration", durationKey, "explicit"),
        ]);
      } catch (e) { console.warn("preferences mirror failed", e); }
      setProfile((prev: any) => ({
        ...prev,
        preferred_platforms: [...selectedPlatforms],
        min_rating: minRating,
        match_threshold: matchThreshold,
        default_media_type: defaultMediaType,
        default_max_duration: defaultMaxDuration,
        default_recommendation_count: recommendationCount,
      }));
      toast({ title: "Préférences enregistrées" });
    } catch (e) { console.error(e); toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const hasChanges = profile && (
    JSON.stringify([...selectedPlatforms].sort()) !== JSON.stringify([...(profile.preferred_platforms || [])].sort()) ||
    minRating !== ((profile as any)?.min_rating || 0) ||
    matchThreshold !== ((profile as any)?.match_threshold ?? 80) ||
    defaultMediaType !== ((profile as any)?.default_media_type || "both") ||
    defaultMaxDuration !== ((profile as any)?.default_max_duration ?? null) ||
    recommendationCount !== ((profile as any)?.default_recommendation_count ?? 3)
  );

  if (!isReady || profileLoading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
  if (!user) return null;

  const nameDisplay = displayName || user.email?.split("@")[0] || "Cinéphile";
  const initials = nameDisplay.slice(0, 2).toUpperCase();

  const totalRecos = engagement?.totalRecommendations || 0;
  const trophyValues: Record<string, number> = {
    recos: totalRecos,
    liked: likedMovies.length,
    people: peopleEvaluated,
    seen: seenCount,
  };
  const confidenceTotal = confidence?.total || 0;
  const confidenceLabel = confidenceTotal < 20 ? "Apprentissage" : confidenceTotal < 45 ? "En progression" : confidenceTotal < 70 ? "Bien calibré" : confidenceTotal < 90 ? "Très précis" : "Expert";
  const confidenceColor = confidenceTotal < 20 ? "text-foreground/40" : confidenceTotal < 45 ? "text-yellow-500/70" : confidenceTotal < 70 ? "text-primary/70" : "text-primary";

  // ── Overlays plein écran ──
  if (showDNA) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowDNA(false)} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="font-serif text-lg">Profil</span>
          </button>
        </div>
        <CinemaDNA userId={user.id} />
      </div>
    );
  }

  if (showTrainer) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowTrainer(false)} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="font-serif text-lg">Profil</span>
          </button>
        </div>
        <div className="p-5"><TasteTrainer onClose={() => { setShowTrainer(false); loadCinema(); }} /></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto scrollbar-dark">
      <div
        className="fixed inset-x-0 top-0 h-[80%] bg-cover bg-top bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${profileBackground})`, maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", opacity: 0.4 }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background)/0.3) 60%, hsl(var(--background)/0.9) 85%, hsl(var(--background)) 100%)" }}
      />
      <div className="max-w-lg mx-auto px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-32 space-y-10">

        {/* ════════════════════════════════
            1. IDENTITÉ
        ════════════════════════════════ */}
        <section>
          {/* Avatar + nom */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-5">
            <label className="relative cursor-pointer group shrink-0">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt={nameDisplay} className="w-full h-full object-cover" />
                  : <span className="text-lg font-serif font-bold text-primary">{initials}</span>}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-card border border-border/30 flex items-center justify-center">
                {uploadingAvatar ? <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" /> : <Camera className="w-2.5 h-2.5 text-foreground/40" />}
              </div>
            </label>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="h-9 text-base font-serif bg-card border-border/20" placeholder="Ton pseudo" maxLength={30} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }} />
                  <Button size="sm" onClick={handleSaveName} className="h-9 px-3"><Check className="w-4 h-4" /></Button>
                </div>
              ) : (
                <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-serif text-foreground">{nameDisplay}</h1>
                  <Pencil className="w-3 h-3 text-foreground/20 group-hover:text-foreground/50 transition-colors" />
                </button>
              )}
              <p className="text-foreground/30 text-[11px] font-sans mt-0.5">{user.email}</p>
            </div>
          </motion.div>

          {/* Carte ADN Cinéma */}
          <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            onClick={() => setShowDNA(true)}
            className="w-full text-left rounded-2xl p-4 border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.03] hover:border-primary/30 transition-all group relative overflow-hidden active:scale-[0.98]">
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary/40 font-sans font-semibold mb-1.5">Ton ADN Cinéma</p>
                {dnaTitle ? (
                  <>
                    <h2 className="text-lg font-serif mb-0.5 group-hover:text-primary/90 transition-colors leading-tight">{dnaTitle}</h2>
                    {dnaArchetype && dnaArchetype !== dnaTitle && <p className="text-primary/50 text-xs font-sans mb-1">{dnaArchetype}</p>}
                    {dnaLevel && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/60 font-sans">{dnaLevel}</span>}
                  </>
                ) : (
                  <h2 className="text-sm font-serif text-foreground/50">Découvre ton profil cinématographique</h2>
                )}
                <div className="flex items-center gap-1 mt-2 text-primary/30 group-hover:text-primary/50 transition-colors">
                  <span className="text-[11px] font-sans">Explorer</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
              {dnaTitle && (
                <div className="shrink-0 rounded-full overflow-hidden shadow-[0_0_20px_rgba(139,92,246,0.3)] ring-1 ring-white/10">
                  <CinemaAvatar personalityTitle={dnaTitle} dnaArchetype={dnaArchetype} globalLevel={dnaLevel ?? ""} size={56} />
                </div>
              )}
            </div>
          </motion.button>
        </section>

        {/* ════════════════════════════════
            2. MON PROFIL CINÉPHILE
        ════════════════════════════════ */}
        <section className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-3.5 h-3.5 text-primary/30" />
            <h2 className="text-xs font-sans font-semibold text-foreground/70 uppercase tracking-widest">Mon profil cinéphile</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "Je suis ouvert",    img: squirrelHappy,    value: 5 },
              { label: "Je suis sélectif",  img: squirrelCritique, value: 6 },
              { label: "Je suis exigeant",  img: squirrelExigeant, value: 7 },
            ] as const).map(opt => {
              const active = opt.value === 5 ? minRating <= 5 : opt.value === 7 ? minRating >= 7 : minRating === 6;
              return (
                <button
                  key={opt.value}
                  onClick={() => setMinRating(opt.value)}
                  className={`relative overflow-hidden rounded-xl border transition-all aspect-square ${
                    active
                      ? "border-primary/60 ring-2 ring-primary/30"
                      : "border-border/20 hover:border-border/40"
                  }`}
                >
                  <img src={opt.img} alt={opt.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className={`absolute bottom-1.5 inset-x-1 font-sans text-[11px] font-semibold leading-tight text-center ${active ? "text-white" : "text-white/70"}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ════════════════════════════════
            3. MON CINÉMA
        ════════════════════════════════ */}
        <section>
          <h2 className="text-sm font-sans font-semibold text-foreground/35 uppercase tracking-widest mb-4">Mon Cinéma</h2>

          {cinemaLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary/30 animate-spin" /></div>
          ) : (
            <div className="space-y-5">

              {/* Niveau de personnalisation */}
              {confidence && (
                <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-primary/30" />
                    <span className="text-xs font-sans font-semibold text-foreground/70 uppercase tracking-widest">Niveau de personnalisation</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-foreground/15 hover:text-foreground/30 transition-colors"><Info className="w-3 h-3" /></button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                          <p>Ce score reflète à quel point Pick te connaît. Plus tu interagis (recos, likes, watchlist, training), plus les suggestions sont personnalisées.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className={`text-3xl font-serif font-bold tabular-nums ${confidenceColor}`}>{confidenceTotal}</span>
                      <span className="text-foreground/20 text-sm font-sans">/100</span>
                    </div>
                    <span className={`text-xs font-sans font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
                  </div>
                  <div className="h-2 rounded-full bg-foreground/[0.04] overflow-hidden mb-4">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${confidenceTotal}%` }}
                      transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-primary/30 via-primary/60 to-primary" />
                  </div>
                  <button onClick={() => setShowConfidenceDetail(!showConfidenceDetail)}
                    className="text-[11px] font-sans text-primary/40 hover:text-primary/60 transition-colors mb-1">
                    {showConfidenceDetail ? "Masquer le détail" : "Comment c'est calculé ?"}
                  </button>
                  {showConfidenceDetail && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden mt-3 space-y-2.5">
                      {confidence.breakdown.map((item, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-sans text-foreground/40">{item.label}</span>
                            <span className="text-[11px] font-sans text-foreground/30 tabular-nums">{item.score}/{item.max}</span>
                          </div>
                          <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(item.score / item.max) * 100}%` }}
                              transition={{ delay: 0.4 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full bg-primary/40" />
                          </div>
                          <p className="text-[9px] font-sans text-foreground/15 mt-0.5">{item.detail}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                  <button onClick={() => setShowTrainer(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-4 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors active:scale-[0.98]">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary text-[12px] font-sans font-semibold">Entraîner mes goûts</span>
                  </button>
                </div>
              )}

              {/* Radar genres */}
              {radarData.length >= 3 && (
                <div>
                  <p className="text-[10px] font-sans font-semibold text-foreground/25 uppercase tracking-widest mb-2">Empreinte cinématographique</p>
                  <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-2 pt-4">
                    <ResponsiveContainer width="100%" height={230}>
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                        <PolarGrid stroke="hsl(var(--foreground) / 0.06)" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="genre"
                          tick={{ fill: "hsl(var(--foreground) / 0.4)", fontSize: 10, fontFamily: "var(--font-sans)" }}
                          tickLine={false} />
                        <Radar name="Genres" dataKey="value"
                          stroke="hsl(var(--primary) / 0.7)" fill="hsl(var(--primary) / 0.15)"
                          strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          )}
        </section>

        {/* ════════════════════════════════
            3. MES PRÉFÉRENCES
        ════════════════════════════════ */}
        <section className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary/30" />
            <h2 className="text-xs font-sans font-semibold text-foreground/70 uppercase tracking-widest">Mes préférences</h2>
          </div>

          {/* Genres & Styles */}
          <div className="mb-5">
            <button onClick={() => setShowGenres((v) => !v)} className="w-full flex items-center justify-between mb-2 group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-sans font-semibold text-foreground/25 uppercase tracking-widest">Genres & styles</span>
                {(genresSelected > 0 || genresExcluded > 0) && (
                  <span className="text-[9px] font-sans px-1.5 py-0.5 rounded-full bg-primary/15 text-primary/70 border border-primary/20">
                    {genresSelected > 0 && `${genresSelected} aimé${genresSelected > 1 ? "s" : ""}`}
                    {genresSelected > 0 && genresExcluded > 0 && " · "}
                    {genresExcluded > 0 && <span className="text-destructive/70">{genresExcluded} exclu{genresExcluded > 1 ? "s" : ""}</span>}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-foreground/25 transition-transform duration-200 ${showGenres ? "rotate-180" : ""}`} />
            </button>
            <div className={showGenres || genresSelected > 0 ? "" : "hidden"}>
              <div className={`rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 transition-all ${showGenres ? "p-4" : "px-4 py-3"}`}>
                <AnimatePresence initial={false}>
                  {showGenres && (
                    <motion.p key="desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                      className="text-[10px] text-foreground/20 font-sans overflow-hidden mb-3">
                      1 clic = tu aimes · 2 clics = tu n'aimes pas · 3 clics = neutre
                    </motion.p>
                  )}
                </AnimatePresence>
                <GenrePreferences onCountChange={setGenresSelected} onRejectedCountChange={setGenresExcluded} collapsed={!showGenres} />
              </div>
            </div>
          </div>

          {/* ProfilePreferences (seuil, type média, durée) */}
          <ProfilePreferences
            matchThreshold={matchThreshold}
            onMatchThresholdChange={setMatchThreshold}
            mediaType={defaultMediaType}
            onMediaTypeChange={setDefaultMediaType}
            maxDuration={defaultMaxDuration}
            onMaxDurationChange={setDefaultMaxDuration}
          />

          {/* Nombre de recommandations */}
          <div className="bg-card rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans text-sm font-medium">{recommendationCount} proposition{recommendationCount > 1 ? "s" : ""}</span>
              <span className="text-[10px] text-foreground/50">1 à 3</span>
            </div>
            <Slider value={[recommendationCount]} onValueChange={([value]) => setRecommendationCount(value)} min={1} max={3} step={1} className="w-full" />
            <p className="text-[11px] text-foreground/50 mt-3">Combien de recommandations Pick te propose par défaut.</p>
          </div>

          {/* Plateformes */}
          <motion.section ref={platformSectionRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <button onClick={() => setShowPlatforms((v) => !v)} className="w-full flex items-center justify-between mb-3 group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-sans font-semibold text-foreground/25 uppercase tracking-widest">Plateformes</span>
                {selectedPlatforms.length > 0 && (
                  <span className="text-[9px] font-sans px-1.5 py-0.5 rounded-full bg-primary/15 text-primary/70 border border-primary/20">
                    {selectedPlatforms.length} sélectionnée{selectedPlatforms.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-foreground/25 transition-transform duration-200 ${showPlatforms ? "rotate-180" : ""}`} />
            </button>
            {!showPlatforms && (
              <div className="flex flex-wrap gap-1.5">
                {selectedPlatforms.length === 0
                  ? <span className="text-foreground/20 text-[10px] font-sans">Toutes les plateformes</span>
                  : ALL_PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((p) => (
                      <img key={p.id} src={p.logo} alt={p.label} className="w-7 h-7 rounded-lg object-cover opacity-80" />
                    ))}
              </div>
            )}
            <AnimatePresence initial={false}>
              {showPlatforms && (
                <motion.div key="platforms-grid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {ALL_PLATFORMS.map((p) => {
                      const on = selectedPlatforms.includes(p.id);
                      return (
                        <button key={p.id} onClick={() => togglePlatform(p.id)}
                          className={`relative bg-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all active:scale-95 border ${on ? "border-primary/50 bg-primary/5" : "border-transparent hover:border-border/30"}`}>
                          {on && <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center"><Check className="w-2 h-2 text-primary-foreground" /></div>}
                          <img src={p.logo} alt={p.label} className="w-7 h-7 rounded-lg object-cover" />
                          <span className="font-sans text-[9px] text-foreground/60 leading-tight text-center">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-foreground/20 text-[10px] font-sans mt-2">Aucune sélection = toutes les plateformes</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

        </section>

        {/* ════════════════════════════════
            4. STATISTIQUES & TROPHÉES
        ════════════════════════════════ */}
        {!cinemaLoading && (
          <section className="space-y-5">

            {/* Statistiques */}
            <div>
              <button onClick={() => setShowStats((v) => !v)} className="w-full flex items-center justify-between mb-3 group">
                <span className="text-[10px] font-sans font-semibold text-foreground/25 uppercase tracking-widest">Statistiques</span>
                <ChevronDown className={`w-3.5 h-3.5 text-foreground/25 transition-transform duration-200 ${showStats ? "rotate-180" : ""}`} />
              </button>
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 overflow-hidden divide-y divide-border/5">
                {[
                  { icon: <Eye className="w-3.5 h-3.5 text-primary/40" />,        label: "Recommandations reçues",   value: totalRecos },
                  { icon: <Heart className="w-3.5 h-3.5 text-destructive/40" />,  label: "Films évalués / likés",    value: likedMovies.length },
                  { icon: <Bookmark className="w-3.5 h-3.5 text-primary/40" />,   label: "En watchlist",             value: watchlistCount },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">{row.icon}<span className="text-sm font-sans text-foreground/60">{row.label}</span></div>
                    <span className="text-sm font-sans font-semibold text-foreground tabular-nums">{row.value}</span>
                  </div>
                ))}
                <AnimatePresence initial={false}>
                  {showStats && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden divide-y divide-border/5">
                      {[
                        { icon: <Film className="w-3.5 h-3.5 text-primary/40" />,      label: "Films",                          value: movieVsSeries.movies },
                        { icon: <Tv className="w-3.5 h-3.5 text-primary/40" />,         label: "Séries",                         value: movieVsSeries.series },
                        { icon: <Users className="w-3.5 h-3.5 text-primary/40" />,      label: "Acteurs & réalisateurs évalués", value: peopleEvaluated },
                        { icon: <TrendingUp className="w-3.5 h-3.5 text-primary/40" />, label: "Meilleure série",                value: `${engagement?.bestStreak || 0} d'affilée` },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2.5">{row.icon}<span className="text-sm font-sans text-foreground/60">{row.label}</span></div>
                          <span className="text-sm font-sans font-semibold text-foreground tabular-nums">{row.value}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Trophées */}
            {(() => {
              const allUnlocked = TROPHY_CATEGORIES.flatMap((cat) => cat.milestones.filter((m) => (trophyValues[cat.key] ?? 0) >= m.count));
              const totalUnlocked = allUnlocked.length;
              const totalMilestones = TROPHY_CATEGORIES.reduce((s, c) => s + c.milestones.length, 0);
              return (
                <>
                  <button onClick={() => setShowTrophies((v) => !v)} className="w-full flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-primary/30" />
                      <span className="text-[10px] font-sans font-semibold text-foreground/25 uppercase tracking-widest">Trophées</span>
                      <span className="text-[10px] font-sans text-primary/40 tabular-nums">{totalUnlocked}/{totalMilestones}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!showTrophies && allUnlocked.slice(-5).map((m, i) => <span key={i} className="text-sm">{m.icon}</span>)}
                      <ChevronDown className={`w-4 h-4 text-foreground/20 transition-transform duration-300 ${showTrophies ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  <AnimatePresence>
                    {showTrophies && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden mt-3">
                        <div className="space-y-5">
                          {TROPHY_CATEGORIES.map((cat) => {
                            const value = trophyValues[cat.key] ?? 0;
                            const nextM = cat.milestones.find((m) => value < m.count);
                            const unlockedCount = cat.milestones.filter((m) => value >= m.count).length;
                            return (
                              <div key={cat.key}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[9px] font-sans text-foreground/20 uppercase tracking-widest">{cat.label}</p>
                                  <span className="text-[9px] font-sans text-primary/30 tabular-nums">{unlockedCount}/{cat.milestones.length}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {cat.milestones.map((m) => {
                                    const reached = value >= m.count;
                                    return (
                                      <div key={m.count} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${reached ? "bg-primary/[0.06] border-primary/20 shadow-[0_0_12px_rgba(139,92,246,0.08)]" : "bg-card/70 border-border/15"}`}>
                                        <span className={`text-xl leading-none ${reached ? "" : "grayscale opacity-15"}`}>{m.icon}</span>
                                        <span className={`text-[8px] font-sans text-center leading-tight mt-0.5 ${reached ? "text-foreground/55" : "text-foreground/12"}`}>{reached ? m.label : "???"}</span>
                                        <span className={`text-[7px] font-sans tabular-nums ${reached ? "text-primary/45" : "text-foreground/8"}`}>{m.count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {nextM && (
                                  <p className="text-foreground/20 text-[10px] font-sans mt-1.5 text-center">
                                    Plus que <span className="text-primary/30 tabular-nums">{nextM.count - value}</span> pour « {nextM.label} »
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              );
            })()}

          </section>
        )}

        {/* ════════════════════════════════
            5. COMPTE
        ════════════════════════════════ */}
        <section>
          <h2 className="text-sm font-sans font-semibold text-foreground/35 uppercase tracking-widest mb-3">Compte</h2>
          <div className="flex flex-col gap-1 border-t border-border/5 pt-3">
            {isAdmin && (
              <Button variant="ghost" onClick={() => navigate("/admin")} className="justify-start text-primary/50 hover:text-primary text-xs font-sans gap-2 h-10">
                <Shield className="w-3.5 h-3.5" /> Administration
              </Button>
            )}
            <Button variant="ghost" onClick={async () => { await signOut(); navigate("/"); }} className="justify-start text-foreground/30 hover:text-foreground text-xs font-sans gap-2 h-10">
              <LogOut className="w-3.5 h-3.5" /> Déconnexion
            </Button>
          </div>
        </section>

      </div>

      {/* Save bar */}
      {hasChanges && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-14 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/10 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto flex justify-end">
            <Button variant="hero" size="lg" onClick={handleSave} disabled={saving} className="rounded-full px-8">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Profile;
