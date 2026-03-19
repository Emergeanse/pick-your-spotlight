import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Check, LogOut, Loader2, Star, Info, Film, Tv, Layers, Clock, Bell, Camera, Pencil, Copy, UserPlus, Users, X, ChevronRight, Clapperboard, QrCode, Share2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { sendNotification } from "@/lib/notifications";
import BottomTabBar from "@/components/pick/BottomTabBar";
import CinematicAvatar, { mapLevelToType, mapArchetypeToDNA, mapSignatureToAnimation, type CinematicLevel, type CinematicDNA, type TasteAnimation } from "@/components/pick/CinematicAvatar";
import { QRCodeSVG } from "qrcode.react";
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
  const [cinematicLevel, setCinematicLevel] = useState<CinematicLevel>("emerging");
  const [cinematicDNA, setCinematicDNA] = useState<CinematicDNA>("contemplative");
  const [tasteAnim, setTasteAnim] = useState<TasteAnimation>("default");

  // Friend management state
  const [myFriendCode, setMyFriendCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [addCode, setAddCode] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [loadingFriendProfile, setLoadingFriendProfile] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadData();
    loadFriends();
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
      if (dnaRes.data) {
        const d = dnaRes.data as any;
        setDnaTitle(d.personality_title || null);
        setCinematicLevel(mapLevelToType(d.global_level));
        setCinematicDNA(mapArchetypeToDNA(d.dna_archetype));
        const sigs = Array.isArray(d.taste_signatures) ? d.taste_signatures.map((s: any) => typeof s === "string" ? s : s?.name || "") : [];
        setTasteAnim(mapSignatureToAnimation(sigs));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!user) return;
    setFriendsLoading(true);
    const { data: prof } = await supabase.from("profiles").select("friend_code").eq("id", user.id).single();
    if (prof) setMyFriendCode((prof as any).friend_code || "");

    const { data: friendships } = await supabase
      .from("friendships" as any)
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (friendships && friendships.length > 0) {
      const otherIds = (friendships as any[]).map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const { data: otherProfiles } = await supabase.from("profiles").select("id, display_name, friend_code, avatar_url").in("id", otherIds);
      const profileMap = new Map((otherProfiles || []).map((p: any) => [p.id, p]));
      setFriends((friendships as any[]).map((f: any) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const op = profileMap.get(otherId);
        return { id: otherId, friendshipId: f.id, displayName: op?.display_name || "Ami", friendCode: op?.friend_code || "", avatarUrl: op?.avatar_url, status: f.status, isRequester: f.requester_id === user.id };
      }));
    } else {
      setFriends([]);
    }
    setFriendsLoading(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myFriendCode);
    setCodeCopied(true);
    sonnerToast.success("Code copié !");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleAddFriend = async () => {
    if (!user || !addCode.trim()) return;
    const code = addCode.trim().toUpperCase();
    if (code === myFriendCode) { sonnerToast.error("Tu ne peux pas t'ajouter toi-même !"); return; }
    setAddingFriend(true);
    try {
      const { data: found } = await (supabase.from("profiles").select("id, display_name") as any).eq("friend_code", code).single();
      if (!found) { sonnerToast.error("Code ami introuvable"); setAddingFriend(false); return; }
      const { data: existing } = await (supabase.from("friendships" as any).select("id") as any).or(`and(requester_id.eq.${user.id},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${user.id})`);
      if (existing && (existing as any[]).length > 0) { sonnerToast.info("Déjà amis ou demande en cours"); setAddingFriend(false); return; }
      await supabase.from("friendships" as any).insert({ requester_id: user.id, addressee_id: found.id, status: "pending" } as any);
      const { data: myProf } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      await sendNotification(found.id, "friend_request", `${myProf?.display_name || "Quelqu'un"} veut être ton ami !`, "Accepte sa demande pour regarder des films ensemble.");
      sonnerToast.success(`Demande envoyée à ${(found as any).display_name || "ton ami"} !`);
      setAddCode("");
      setShowAddModal(false);
      loadFriends();
    } catch { sonnerToast.error("Erreur lors de l'ajout"); } finally { setAddingFriend(false); }
  };

  const handleAcceptFriend = async (friendshipId: string, friendId: string) => {
    await supabase.from("friendships" as any).update({ status: "accepted" } as any).eq("id", friendshipId);
    if (user) {
      const { data: myProf } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      await sendNotification(friendId, "friend_accepted", `${myProf?.display_name || "Quelqu'un"} a accepté ta demande !`, "Vous pouvez maintenant regarder des films ensemble.");
    }
    sonnerToast.success("Ami accepté !");
    loadFriends();
  };

  const handleDeclineFriend = async (friendshipId: string) => {
    await supabase.from("friendships" as any).delete().eq("id", friendshipId);
    sonnerToast.success("Demande refusée");
    loadFriends();
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    await supabase.from("friendships" as any).delete().eq("id", friendshipId);
    sonnerToast.success("Ami retiré");
    setSelectedFriend(null);
    loadFriends();
  };

  const handleViewFriendProfile = async (friend: any) => {
    setSelectedFriend(friend);
    setLoadingFriendProfile(true);
    setFriendProfile(null);
    try {
      const [{ data: prof }, { data: cin }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, friend_code, favorite_genres").eq("id", friend.id).single(),
        supabase.from("cinematic_profiles").select("personality_title, dna_archetype, global_level, taste_traits, narrative").eq("user_id", friend.id).single(),
      ]);
      setFriendProfile({
        displayName: (prof as any)?.display_name || friend.displayName,
        avatarUrl: (prof as any)?.avatar_url,
        friendCode: (prof as any)?.friend_code || friend.friendCode,
        favoriteGenres: (prof as any)?.favorite_genres || [],
        cinematicProfile: cin ? { personalityTitle: (cin as any).personality_title, dnaArchetype: (cin as any).dna_archetype, globalLevel: (cin as any).global_level, tasteTraits: (cin as any).taste_traits || [], narrative: (cin as any).narrative } : null,
      });
    } catch { setFriendProfile(null); } finally { setLoadingFriendProfile(false); }
  };

  const inviteUrl = `https://pick-your-spotlight.lovable.app/auth?invite=${myFriendCode}`;
  const acceptedFriends = friends.filter((f: any) => f.status === "accepted");
  const pendingReceived = friends.filter((f: any) => f.status === "pending" && !f.isRequester);
  const pendingSent = friends.filter((f: any) => f.status === "pending" && f.isRequester);


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
            {/* Avatar with cinematic identity halo */}
            <label className="relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
              <CinematicAvatar
                src={avatarUrl}
                name={nameDisplay}
                size="md"
                level={cinematicLevel}
                dna={cinematicDNA}
                tasteSignature={tasteAnim}
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors z-20">
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

        {/* ─── Mes Amis ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mb-8">
          <h2 className="text-lg font-serif mb-1">Mes amis</h2>
          <p className="text-[11px] text-muted-foreground font-sans mb-4">Gère tes amis et partage ton code.</p>

          {/* Friend code + QR */}
          <div className="rounded-2xl p-4 bg-card border border-border/20 mb-4">
            <p className="text-muted-foreground text-xs font-sans mb-2">Ton code ami</p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl font-mono font-bold text-primary tracking-wider">{myFriendCode || "..."}</span>
              <button onClick={handleCopyCode} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                {codeCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-primary" />}
              </button>
              <button onClick={() => setShowQR(!showQR)} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                <QrCode className="w-4 h-4 text-primary" />
              </button>
              {typeof navigator.share === "function" && (
                <button
                  onClick={() => navigator.share({ title: "Ajoute-moi sur Pick !", url: inviteUrl })}
                  className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <Share2 className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>
            <AnimatePresence>
              {showQR && myFriendCode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex flex-col items-center py-4">
                    <div className="bg-white p-3 rounded-xl">
                      <QRCodeSVG value={inviteUrl} size={160} />
                    </div>
                    <p className="text-muted-foreground/50 text-[10px] font-sans mt-2 text-center">Scanne ce QR pour m'ajouter sur Pick</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Add friend */}
          <Button onClick={() => setShowAddModal(true)} className="w-full rounded-xl h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans mb-4">
            <UserPlus className="w-4 h-4" />
            Ajouter un ami
          </Button>

          {/* Pending received */}
          {pendingReceived.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-sans font-semibold text-foreground/50 mb-2">Demandes reçues ({pendingReceived.length})</p>
              <div className="space-y-2">
                {pendingReceived.map((f: any) => (
                  <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card border border-primary/20">
                    <div>
                      <p className="text-sm font-sans font-medium text-foreground">{f.displayName}</p>
                      <p className="text-muted-foreground text-[10px] font-mono">{f.friendCode}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAcceptFriend(f.friendshipId, f.id)} className="rounded-lg h-8 px-3 text-xs bg-primary text-primary-foreground">Accepter</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeclineFriend(f.friendshipId)} className="rounded-lg h-8 px-3 text-xs text-muted-foreground"><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted friends */}
          {friendsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : acceptedFriends.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground/50 text-sm font-sans">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-30" />
              <p>Aucun ami pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {acceptedFriends.map((f: any) => (
                <motion.button key={f.friendshipId} whileTap={{ scale: 0.98 }} onClick={() => handleViewFriendProfile(f)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/20 hover:border-border/40 transition-all text-left group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden border border-primary/10">
                      {f.avatarUrl ? <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" /> : <span className="text-sm font-sans font-bold text-primary">{(f.displayName || "A")[0].toUpperCase()}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-sans font-medium text-foreground">{f.displayName}</p>
                      <p className="text-muted-foreground/50 text-[10px] font-mono">{f.friendCode}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                </motion.button>
              ))}
            </div>
          )}

          {/* Pending sent */}
          {pendingSent.length > 0 && (
            <div>
              <p className="text-xs font-sans font-semibold text-foreground/50 mb-2">En attente ({pendingSent.length})</p>
              <div className="space-y-2">
                {pendingSent.map((f: any) => (
                  <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/10">
                    <p className="text-sm font-sans text-foreground/60">{f.displayName}</p>
                    <button onClick={() => handleRemoveFriend(f.friendshipId)} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
