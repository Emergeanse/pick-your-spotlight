import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Check, LogOut, Loader2, Star, Info, Film, Tv, Layers, Clock, Bell, Camera, Pencil } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import BottomTabBar from "@/components/pick/BottomTabBar";

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

const MILESTONES = [
  { count: 1, label: "Premier film", emoji: "🎬" },
  { count: 5, label: "Cinéphile débutant", emoji: "🍿" },
  { count: 10, label: "Fidèle spectateur", emoji: "📽️" },
  { count: 20, label: "Explorateur", emoji: "🧭" },
  { count: 50, label: "Connaisseur", emoji: "🎪" },
  { count: 100, label: "Maître cinéphile", emoji: "👑" },
];

const Profile = () => {
  const { user, isReady, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [mediaPreference, setMediaPreference] = useState<string>("both");
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [dnaTitle, setDnaTitle] = useState<string | null>(null);
  const [ritualEnabled, setRitualEnabled] = useState(false);
  const [ritualTime, setRitualTime] = useState("20:00");
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
      const [profileRes, engData, dnaRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        getEngagementData(user.id),
        supabase.from("cinematic_profiles" as any).select("personality_title").eq("user_id", user.id).maybeSingle(),
      ]);
      const data = profileRes.data;
      setProfile(data);
      setSelectedPlatforms(data?.preferred_platforms || []);
      setMinRating((data as any)?.min_rating || 0);
      setMediaPreference((data as any)?.media_preference || "both");
      setRitualEnabled(data?.ritual_enabled || false);
      setRitualTime(data?.ritual_time || "20:00");
      setDisplayName(data?.display_name || user.email?.split("@")[0] || "");
      setAvatarUrl((data as any)?.avatar_url || null);
      setEngagement(engData);
      if (dnaRes.data) setDnaTitle((dnaRes.data as any).personality_title || null);
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  const togglePlatform = (id: number) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() } as any).eq("id", user.id);
    if (!error) {
      setProfile((prev: any) => ({ ...prev, display_name: displayName.trim() }));
      setEditingName(false);
      toast({ title: "Pseudo mis à jour ✓" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image trop lourde", description: "Maximum 5 Mo", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("id", user.id);
      setAvatarUrl(publicUrl);
      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast({ title: "Photo de profil mise à jour ✓" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erreur lors de l'upload", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        preferred_platforms: selectedPlatforms,
        excluded_platforms: [],
        min_rating: minRating,
        media_preference: mediaPreference,
        ritual_enabled: ritualEnabled,
        ritual_time: ritualTime,
      } as any).eq("id", user.id);
      if (error) throw error;
      setProfile((prev: any) => ({
        ...prev,
        preferred_platforms: [...selectedPlatforms],
        excluded_platforms: [],
        min_rating: minRating,
        media_preference: mediaPreference,
        ritual_enabled: ritualEnabled,
        ritual_time: ritualTime,
      }));
      toast({ title: "Préférences enregistrées ✓" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = profile && (
    JSON.stringify([...selectedPlatforms].sort()) !== JSON.stringify([...(profile.preferred_platforms || [])].sort()) ||
    minRating !== ((profile as any)?.min_rating || 0) ||
    mediaPreference !== ((profile as any)?.media_preference || "both") ||
    ritualEnabled !== (profile?.ritual_enabled || false) ||
    ritualTime !== (profile?.ritual_time || "20:00")
  );

  if (!isReady || profileLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const nameDisplay = displayName || user.email?.split("@")[0] || "Cinéphile";
  const totalRecos = engagement?.totalRecommendations || 0;
  const reachedMilestones = MILESTONES.filter(m => totalRecos >= m.count);
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : null;

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-32">

        {/* ─── User Identity Block ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            {/* Avatar with upload */}
            <label className="relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary/20 group-hover:border-primary/50 transition-colors"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 group-hover:border-primary/50 flex items-center justify-center transition-colors">
                  <span className="text-2xl font-serif text-primary">{nameDisplay.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                {uploadingAvatar ? (
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                ) : (
                  <Camera className="w-3 h-3 text-foreground/50" />
                )}
              </div>
            </label>

            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-9 text-lg font-serif bg-card border-border/20"
                    placeholder="Ton pseudo"
                    maxLength={30}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                  />
                  <Button size="sm" onClick={handleSaveName} className="h-9 px-3">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-serif mb-0.5">{nameDisplay}</h1>
                  <button
                    onClick={() => setEditingName(true)}
                    className="p-1 rounded-md hover:bg-foreground/5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-foreground/30 hover:text-foreground/60" />
                  </button>
                </div>
              )}
              {memberSince && (
                <p className="text-muted-foreground text-[11px] font-sans">Membre depuis {memberSince}</p>
              )}
              {dnaTitle && (
                <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold/20 text-gold/70 text-[10px] font-sans font-medium">
                  🧬 {dnaTitle}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ─── Connected Platforms ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
          <h2 className="text-lg font-serif mb-1">Tes plateformes</h2>
          <p className="text-[11px] text-muted-foreground font-sans mb-3">
            Sélectionne tes abonnements. Si aucun n'est coché, toutes les plateformes seront prises en compte.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ALL_PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`relative bg-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                    isSelected
                      ? "border-primary neon-glow"
                      : "border-transparent hover:border-primary/30"
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

        {/* ─── Media Preference ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h2 className="text-lg font-serif mb-3">Tu préfères regarder…</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "movies", label: "Films", icon: Film },
              { id: "tv", label: "Séries", icon: Tv },
              { id: "both", label: "Les deux", icon: Layers },
            ].map((opt) => {
              const isSelected = mediaPreference === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setMediaPreference(opt.id)}
                  className={`rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer border ${
                    isSelected ? "bg-primary/10 border-primary/30" : "bg-card border-transparent hover:border-primary/20"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-foreground/50"}`} />
                  <span className={`font-sans text-sm font-medium ${isSelected ? "text-primary" : "text-foreground/80"}`}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Min Rating ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-serif">Note minimale</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs">
                  <p>Notes TMDB — communauté de millions d'utilisateurs.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className={`w-4 h-4 ${minRating > 0 ? "text-yellow-500" : "text-muted-foreground/40"}`} />
                <span className="font-sans text-sm font-medium">
                  {minRating === 0 ? "Peu importe" : `${minRating}+ / 10`}
                </span>
              </div>
            </div>
            <Slider value={[minRating]} onValueChange={([v]) => setMinRating(v)} min={0} max={9} step={1} className="w-full" />
          </div>
        </motion.div>

        {/* ─── Milestones — Visual Badges ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <h2 className="text-lg font-serif mb-3">Tes jalons</h2>
          <div className="flex flex-wrap gap-2">
            {MILESTONES.map(m => {
              const reached = totalRecos >= m.count;
              return (
                <div
                  key={m.count}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-sans ${
                    reached
                      ? "bg-primary/[0.08] border-primary/20 text-foreground"
                      : "bg-card/30 border-border/10 text-foreground/20"
                  }`}
                >
                  <span className={reached ? "" : "grayscale opacity-40"}>{m.emoji}</span>
                  <span className="font-medium">{reached ? m.label : "???"}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Evening Ritual ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-8">
          <h2 className="text-lg font-serif mb-3">Rituel du soir</h2>
          <div className="bg-card rounded-2xl p-4 border border-border/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary/60" />
                <span className="font-sans text-sm">Rappel quotidien</span>
              </div>
              <button
                onClick={() => setRitualEnabled(!ritualEnabled)}
                className={`w-11 h-6 rounded-full transition-colors ${ritualEnabled ? "bg-primary" : "bg-foreground/15"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${ritualEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {ritualEnabled && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-foreground/40" />
                <input
                  type="time"
                  value={ritualTime}
                  onChange={(e) => setRitualTime(e.target.value)}
                  className="bg-transparent text-foreground text-sm font-sans border border-border/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/40"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── Logout ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Button
            variant="ghost"
            onClick={async () => { await signOut(); navigate("/"); }}
            className="text-foreground/40 hover:text-foreground text-xs font-sans gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </Button>
        </motion.div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-14 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/20 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="max-w-2xl mx-auto flex justify-end">
            <Button variant="hero" size="xl" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </motion.div>
      )}

      <BottomTabBar />
    </div>
  );
};

export default Profile;
