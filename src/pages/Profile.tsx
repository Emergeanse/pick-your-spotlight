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
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setSelectedPlatforms(data?.preferred_platforms || []);
      setMinRating((data as any)?.min_rating || 0);
      setDisplayName(data?.display_name || user.email?.split("@")[0] || "");
      setAvatarUrl((data as any)?.avatar_url || null);
    } catch (e) { console.error(e); }
    finally { setProfileLoading(false); }
  };

  const loadFriends = async () => {
    if (!user) return;
    setFriendsLoading(true);
    const { data: prof } = await supabase.from("profiles").select("friend_code").eq("id", user.id).single();
    if (prof) setMyFriendCode((prof as any).friend_code || "");
    const { data: friendships } = await supabase.from("friendships" as any).select("id, requester_id, addressee_id, status").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (friendships && friendships.length > 0) {
      const otherIds = (friendships as any[]).map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const { data: otherProfiles } = await supabase.from("profiles").select("id, display_name, friend_code, avatar_url").in("id", otherIds);
      const profileMap = new Map((otherProfiles || []).map((p: any) => [p.id, p]));
      setFriends((friendships as any[]).map((f: any) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const op = profileMap.get(otherId);
        return { id: otherId, friendshipId: f.id, displayName: op?.display_name || "Ami", friendCode: op?.friend_code || "", avatarUrl: op?.avatar_url, status: f.status, isRequester: f.requester_id === user.id };
      }));
    } else { setFriends([]); }
    setFriendsLoading(false);
  };

  const handleCopyCode = () => { navigator.clipboard.writeText(myFriendCode); setCodeCopied(true); sonnerToast.success("Code copié !"); setTimeout(() => setCodeCopied(false), 2000); };

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
      setAddCode(""); setShowAddModal(false); loadFriends();
    } catch { sonnerToast.error("Erreur lors de l'ajout"); } finally { setAddingFriend(false); }
  };

  const handleAcceptFriend = async (friendshipId: string, friendId: string) => {
    await supabase.from("friendships" as any).update({ status: "accepted" } as any).eq("id", friendshipId);
    if (user) {
      const { data: myProf } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      await sendNotification(friendId, "friend_accepted", `${myProf?.display_name || "Quelqu'un"} a accepté ta demande !`, "Vous pouvez maintenant regarder des films ensemble.");
    }
    sonnerToast.success("Ami accepté !"); loadFriends();
  };
  const handleDeclineFriend = async (friendshipId: string) => { await supabase.from("friendships" as any).delete().eq("id", friendshipId); sonnerToast.success("Demande refusée"); loadFriends(); };
  const handleRemoveFriend = async (friendshipId: string) => { await supabase.from("friendships" as any).delete().eq("id", friendshipId); sonnerToast.success("Ami retiré"); setSelectedFriend(null); loadFriends(); };

  const handleViewFriendProfile = async (friend: any) => {
    setSelectedFriend(friend); setLoadingFriendProfile(true); setFriendProfile(null);
    try {
      const [{ data: prof }, { data: cin }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, friend_code, favorite_genres").eq("id", friend.id).single(),
        supabase.from("cinematic_profiles").select("personality_title, dna_archetype, global_level, taste_traits, narrative").eq("user_id", friend.id).single(),
      ]);
      setFriendProfile({
        displayName: (prof as any)?.display_name || friend.displayName, avatarUrl: (prof as any)?.avatar_url,
        friendCode: (prof as any)?.friend_code || friend.friendCode, favoriteGenres: (prof as any)?.favorite_genres || [],
        cinematicProfile: cin ? { personalityTitle: (cin as any).personality_title, dnaArchetype: (cin as any).dna_archetype, globalLevel: (cin as any).global_level, tasteTraits: (cin as any).taste_traits || [], narrative: (cin as any).narrative } : null,
      });
    } catch { setFriendProfile(null); } finally { setLoadingFriendProfile(false); }
  };

  const inviteUrl = `https://pick-your-spotlight.lovable.app/auth?invite=${myFriendCode}`;
  const acceptedFriends = friends.filter((f: any) => f.status === "accepted");
  const pendingReceived = friends.filter((f: any) => f.status === "pending" && !f.isRequester);
  const pendingSent = friends.filter((f: any) => f.status === "pending" && f.isRequester);

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
      const { error } = await supabase.from("profiles").update({ preferred_platforms: selectedPlatforms, excluded_platforms: [], min_rating: minRating } as any).eq("id", user.id);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, preferred_platforms: [...selectedPlatforms], min_rating: minRating }));
      toast({ title: "Préférences enregistrées" });
    } catch (e) { console.error(e); toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const hasChanges = profile && (
    JSON.stringify([...selectedPlatforms].sort()) !== JSON.stringify([...(profile.preferred_platforms || [])].sort()) ||
    minRating !== ((profile as any)?.min_rating || 0)
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

        {/* ─── Plateformes ─── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
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
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
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

        {/* ─── Amis ─── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <h2 className="text-sm font-sans font-semibold text-foreground/50 uppercase tracking-widest mb-3">Amis</h2>

          {/* Code ami compact */}
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-card border border-border/10">
            <span className="text-foreground/30 text-xs font-sans">Mon code</span>
            <span className="font-mono font-bold text-primary text-sm tracking-wider flex-1">{myFriendCode || "..."}</span>
            <button onClick={handleCopyCode} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
              {codeCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-foreground/30" />}
            </button>
            <button onClick={() => setShowQR(!showQR)} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
              <QrCode className="w-3.5 h-3.5 text-foreground/30" />
            </button>
            {typeof navigator.share === "function" && (
              <button onClick={() => navigator.share({ title: "Ajoute-moi sur Pick !", url: inviteUrl })} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                <Share2 className="w-3.5 h-3.5 text-foreground/30" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showQR && myFriendCode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="flex flex-col items-center py-4">
                  <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={inviteUrl} size={140} /></div>
                  <p className="text-foreground/20 text-[10px] font-sans mt-2">Scanne pour m'ajouter</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={() => setShowAddModal(true)} variant="outline" className="w-full rounded-xl h-10 gap-2 font-sans text-sm mb-4 border-border/20 text-foreground/60">
            <UserPlus className="w-3.5 h-3.5" /> Ajouter un ami
          </Button>

          {/* Pending received */}
          {pendingReceived.length > 0 && (
            <div className="mb-3 space-y-2">
              {pendingReceived.map((f: any) => (
                <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card border border-primary/15">
                  <div>
                    <p className="text-sm font-sans font-medium">{f.displayName}</p>
                    <p className="text-foreground/20 text-[10px] font-mono">{f.friendCode}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAcceptFriend(f.friendshipId, f.id)} className="rounded-lg h-7 px-3 text-[11px]">Accepter</Button>
                    <button onClick={() => handleDeclineFriend(f.friendshipId)} className="p-1 text-foreground/20 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends list */}
          {friendsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 text-primary animate-spin" /></div>
          ) : acceptedFriends.length === 0 && pendingSent.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-6 h-6 mx-auto mb-2 text-foreground/10" />
              <p className="text-foreground/25 text-sm font-sans">Aucun ami pour le moment</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {acceptedFriends.map((f: any) => (
                <button key={f.friendshipId} onClick={() => handleViewFriendProfile(f)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/10 hover:border-border/25 transition-all text-left active:scale-[0.98]">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {f.avatarUrl ? <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" /> :
                      <span className="text-xs font-sans font-bold text-primary">{(f.displayName || "A")[0].toUpperCase()}</span>}
                  </div>
                  <span className="text-sm font-sans flex-1">{f.displayName}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-foreground/15" />
                </button>
              ))}
              {pendingSent.map((f: any) => (
                <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card/30 border border-border/5">
                  <span className="text-sm font-sans text-foreground/40">{f.displayName}</span>
                  <span className="text-[10px] font-sans text-foreground/20">En attente</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ─── Footer actions ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col gap-1 pt-4 border-t border-border/5">
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

      {/* Add friend modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: "spring", damping: 25 }}
              className="relative w-full max-w-lg rounded-t-2xl bg-card border-t border-border/20 p-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <div className="w-10 h-1 rounded-full bg-border/30 mx-auto mb-5" />
              <h3 className="text-base font-serif mb-4">Ajouter un ami</h3>
              <p className="text-foreground/40 text-sm font-sans mb-4">Entre le code ami (ex: PICK-A3F2)</p>
              <div className="flex gap-3">
                <input type="text" value={addCode} onChange={(e) => setAddCode(e.target.value.toUpperCase())} placeholder="PICK-XXXX"
                  className="flex-1 h-12 rounded-xl bg-background border border-border/20 px-4 font-mono text-foreground placeholder:text-foreground/15 focus:outline-none focus:border-primary/40 transition-colors" maxLength={9} />
                <Button onClick={handleAddFriend} disabled={addingFriend || addCode.length < 9} className="rounded-xl h-12 px-6">
                  {addingFriend ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend profile drawer */}
      <AnimatePresence>
        {selectedFriend && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedFriend(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-lg rounded-t-2xl bg-card border-t border-border/20 max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-card/90 backdrop-blur-xl z-10 px-6 pt-4 pb-3 flex items-center justify-between">
                <h3 className="text-base font-serif">Profil</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleRemoveFriend(selectedFriend.friendshipId)} className="text-[11px] font-sans text-destructive/50 hover:text-destructive px-2 py-1">Retirer</button>
                  <button onClick={() => setSelectedFriend(null)} className="p-1 text-foreground/30"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {loadingFriendProfile ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
                ) : friendProfile ? (
                  <div className="space-y-5">
                    <div className="flex flex-col items-center py-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/15 flex items-center justify-center overflow-hidden mb-3">
                        {friendProfile.avatarUrl ? <img src={friendProfile.avatarUrl} alt={friendProfile.displayName} className="w-full h-full object-cover" /> :
                          <span className="text-xl font-serif font-bold text-primary">{(friendProfile.displayName || "A")[0].toUpperCase()}</span>}
                      </div>
                      <p className="text-lg font-serif">{friendProfile.displayName}</p>
                    </div>
                    {friendProfile.favoriteGenres?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-sans font-semibold text-foreground/25 uppercase tracking-widest mb-2">Genres</p>
                        <div className="flex flex-wrap gap-1.5">
                          {friendProfile.favoriteGenres.map((g: string) => <span key={g} className="px-2.5 py-1 rounded-full bg-primary/8 text-primary/80 text-[11px] font-sans">{g}</span>)}
                        </div>
                      </div>
                    )}
                    {friendProfile.cinematicProfile ? (
                      <div className="rounded-xl bg-background/50 border border-border/10 p-4 space-y-3">
                        <p className="text-lg font-serif">{friendProfile.cinematicProfile.personalityTitle}</p>
                        {friendProfile.cinematicProfile.dnaArchetype && <p className="text-primary text-xs font-sans font-medium">{friendProfile.cinematicProfile.dnaArchetype}</p>}
                        {friendProfile.cinematicProfile.narrative && <p className="text-foreground/40 text-xs font-sans leading-relaxed line-clamp-3">{friendProfile.cinematicProfile.narrative}</p>}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-background/50 border border-border/10 p-5 text-center">
                        <p className="text-foreground/25 text-sm font-sans">Pas encore de profil cinéma</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;