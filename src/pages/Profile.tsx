import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Check, LogOut, Loader2, Star, Info, Camera, Pencil, Shield } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import ProfilePreferences from "@/components/pick/ProfilePreferences";

const ALL_PLATFORMS = [
  { id: 8, label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, label: "Disney+", logo: "https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { id: 119, label: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { id: 350, label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg" },
  { id: 381, label: "Canal+", logo: "https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg" },
  { id: 236, label: "Paramount+", logo: "/logos/paramount-plus.png" },
  { id: 384, label: "HBO", logo: "/logos/hbo.png" },
  { id: 35, label: "Rakuten TV", logo: "https://image.tmdb.org/t/p/original/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg" },
];

const Profile = () => {
  const { user, isReady, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const [profile, setProfile] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [matchThreshold, setMatchThreshold] = useState<number>(80);
  const [defaultMediaType, setDefaultMediaType] = useState<"both" | "movie" | "tv">("both");
  const [defaultMaxDuration, setDefaultMaxDuration] = useState<number | null>(null);
  const [recommendationCount, setRecommendationCount] = useState<number>(5);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadData();
  }, [user, isReady, navigate]);

  const loadData = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setSelectedPlatforms(data?.preferred_platforms || []);
      setMinRating((data as any)?.min_rating || 0);
      setMatchThreshold((data as any)?.match_threshold ?? 80);
      setDefaultMediaType(((data as any)?.default_media_type as any) || "both");
      setDefaultMaxDuration((data as any)?.default_max_duration ?? null);
      setDisplayName(data?.display_name || user.email?.split("@")[0] || "");
      setAvatarUrl((data as any)?.avatar_url || null);
      setRecommendationCount(Math.min((data as any)?.default_recommendation_count ?? 3, 5));
    } catch (e) { console.error(e); }
    finally { setProfileLoading(false); }
  };

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

      // Mirror to V1 normalized preferences
      try {
        const { setLikedPlatforms, setSinglePreference } = await import("@/lib/preferences");
        const ratingKey = minRating >= 8 ? "excellent" : minRating >= 7 ? "great" : minRating >= 6 ? "good" : "any";
        const durationKey = defaultMaxDuration == null
          ? "any"
          : defaultMaxDuration <= 90 ? "short" : defaultMaxDuration <= 120 ? "medium" : "long";
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
    recommendationCount !== ((profile as any)?.default_recommendation_count ?? 5)
  );

  if (!isReady || profileLoading) return <div className="fixed inset-0 bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  if (!user) return null;

  const nameDisplay = displayName || user.email?.split("@")[0] || "Cinéphile";
  const initials = nameDisplay.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-32">

        {/* ─── Identity ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-10">
          <label className="relative cursor-pointer group shrink-0">
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} alt={nameDisplay} className="w-full h-full object-cover" /> :
                <span className="text-lg font-serif font-bold text-primary">{initials}</span>}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-card border border-border/30 flex items-center justify-center">
              {uploadingAvatar ? <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" /> : <Camera className="w-2.5 h-2.5 text-foreground/40" />}
            </div>
          </label>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-9 text-base font-serif bg-card border-border/20" placeholder="Ton pseudo" maxLength={30} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }} />
                <Button size="sm" onClick={handleSaveName} className="h-9 px-3"><Check className="w-4 h-4" /></Button>
              </div>
            ) : (
              <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
                <h1 className="text-xl font-serif">{nameDisplay}</h1>
                <Pencil className="w-3 h-3 text-foreground/20 group-hover:text-foreground/50 transition-colors" />
              </button>
            )}
            <p className="text-foreground/30 text-[11px] font-sans mt-0.5">{user.email}</p>
          </div>
        </motion.div>

        {/* ─── Préférences de recherche ─── */}
        <ProfilePreferences
          matchThreshold={matchThreshold}
          onMatchThresholdChange={setMatchThreshold}
          mediaType={defaultMediaType}
          onMediaTypeChange={setDefaultMediaType}
          maxDuration={defaultMaxDuration}
          onMaxDurationChange={setDefaultMaxDuration}
        />

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-3.5 h-3.5 text-primary/60" />
            <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest">Nombre de recommandations</h2>
          </div>
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans text-sm font-medium">{recommendationCount} propositions</span>
              <span className="text-[10px] text-foreground/50">1 à 5</span>
            </div>
            <Slider value={[recommendationCount]} onValueChange={([value]) => setRecommendationCount(value)} min={1} max={5} step={1} className="w-full" />
            <p className="text-[11px] text-foreground/50 mt-3">Choisis combien de recommandations Pick te propose par défaut.</p>
          </div>
        </motion.section>

        {/* ─── Plateformes ─── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest mb-3">Tes plateformes</h2>
          <div className="grid grid-cols-4 gap-2">
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
        </motion.section>

        {/* ─── Note minimale ─── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest">Note minimale</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><button className="text-foreground/20"><Info className="w-3 h-3" /></button></TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs"><p>Notes TMDB — communauté de millions d'utilisateurs.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className={`w-3.5 h-3.5 ${minRating > 0 ? "text-yellow-500" : "text-foreground/20"}`} />
                <span className="font-sans text-sm">{minRating === 0 ? "Peu importe" : `${minRating}+ / 10`}</span>
              </div>
              {minRating >= 8 && <span className="text-[10px] font-sans text-destructive/70">Très restrictif</span>}
            </div>
            <Slider value={[minRating]} onValueChange={([v]) => setMinRating(v)} min={0} max={8} step={0.5} className="w-full" />
          </div>
        </motion.section>

        {/* ─── Footer actions ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-col gap-1 pt-4 border-t border-border/5">
          {isAdmin && (
            <Button variant="ghost" onClick={() => navigate("/admin")} className="justify-start text-primary/50 hover:text-primary text-xs font-sans gap-2 h-10">
              <Shield className="w-3.5 h-3.5" /> Administration
            </Button>
          )}
          <Button variant="ghost" onClick={async () => { await signOut(); navigate("/"); }} className="justify-start text-foreground/30 hover:text-foreground text-xs font-sans gap-2 h-10">
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </Button>
        </motion.div>
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