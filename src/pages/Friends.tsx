import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Loader2, Mail, QrCode, Share2, UserPlus, Users, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";
import { QRCodeSVG } from "qrcode.react";

const Friends = () => {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();

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
    loadFriends();
  }, [user, isReady]);

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

  const handleCopyCode = () => { navigator.clipboard.writeText(myFriendCode); setCodeCopied(true); toast.success("Code copié !"); setTimeout(() => setCodeCopied(false), 2000); };

  const handleAddFriend = async () => {
    if (!user || !addCode.trim()) return;
    const code = addCode.trim().toUpperCase();
    if (code === myFriendCode) { toast.error("Tu ne peux pas t'ajouter toi-même !"); return; }
    setAddingFriend(true);
    try {
      const { data: found } = await (supabase.from("profiles").select("id, display_name") as any).eq("friend_code", code).single();
      if (!found) { toast.error("Code ami introuvable"); setAddingFriend(false); return; }
      const { data: existing } = await (supabase.from("friendships" as any).select("id") as any).or(`and(requester_id.eq.${user.id},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${user.id})`);
      if (existing && (existing as any[]).length > 0) { toast.info("Déjà amis ou demande en cours"); setAddingFriend(false); return; }
      await supabase.from("friendships" as any).insert({ requester_id: user.id, addressee_id: found.id, status: "pending" } as any);
      const { data: myProf } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      await sendNotification(found.id, "friend_request", `${myProf?.display_name || "Quelqu'un"} veut être ton ami !`, "Accepte sa demande pour regarder des films ensemble.");
      toast.success(`Demande envoyée à ${(found as any).display_name || "ton ami"} !`);
      setAddCode(""); setShowAddModal(false); loadFriends();
    } catch { toast.error("Erreur lors de l'ajout"); } finally { setAddingFriend(false); }
  };

  const handleAcceptFriend = async (friendshipId: string, friendId: string) => {
    await supabase.from("friendships" as any).update({ status: "accepted" } as any).eq("id", friendshipId);
    if (user) {
      const { data: myProf } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      await sendNotification(friendId, "friend_accepted", `${myProf?.display_name || "Quelqu'un"} a accepté ta demande !`, "Vous pouvez maintenant regarder des films ensemble.");
    }
    toast.success("Ami accepté !"); loadFriends();
  };

  const handleDeclineFriend = async (friendshipId: string) => { await supabase.from("friendships" as any).delete().eq("id", friendshipId); toast.success("Demande refusée"); loadFriends(); };
  const handleRemoveFriend = async (friendshipId: string) => { await supabase.from("friendships" as any).delete().eq("id", friendshipId); toast.success("Ami retiré"); setSelectedFriend(null); loadFriends(); };

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

  if (!isReady || friendsLoading) return <div className="fixed inset-0 bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-serif text-lg">Mes amis</span>
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 pb-32">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h2 className="text-[11px] font-sans font-semibold text-foreground/30 uppercase tracking-widest mb-2">Mon code ami</h2>
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card border border-border/10">
            <span className="font-mono font-bold text-primary text-lg tracking-wider flex-1">{myFriendCode || "..."}</span>
            <button onClick={handleCopyCode} className="p-2 rounded-xl hover:bg-primary/10 transition-colors active:scale-95">
              {codeCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-foreground/30" />}
            </button>
            <button onClick={() => setShowQR(!showQR)} className="p-2 rounded-xl hover:bg-primary/10 transition-colors active:scale-95">
              <QrCode className="w-4 h-4 text-foreground/30" />
            </button>
            {typeof navigator.share === "function" && (
              <button onClick={() => navigator.share({ title: "Ajoute-moi sur Pick !", url: inviteUrl })} className="p-2 rounded-xl hover:bg-primary/10 transition-colors active:scale-95">
                <Share2 className="w-4 h-4 text-foreground/30" />
              </button>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {showQR && myFriendCode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="flex flex-col items-center py-4">
                <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={inviteUrl} size={160} /></div>
                <p className="text-foreground/20 text-[10px] font-sans mt-2">Scanne pour m'ajouter</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Button onClick={() => setShowAddModal(true)} variant="outline" className="w-full rounded-2xl h-12 gap-2 font-sans text-sm mb-6 border-border/20 text-foreground/60">
            <UserPlus className="w-4 h-4" /> Ajouter un ami
          </Button>
        </motion.div>

        {pendingReceived.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
            <h2 className="text-[11px] font-sans font-semibold text-foreground/30 uppercase tracking-widest mb-2">Demandes reçues</h2>
            <div className="space-y-2">
              {pendingReceived.map((f: any) => (
                <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card border border-primary/15">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {f.avatarUrl ? <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> :
                        <span className="text-xs font-bold text-primary">{(f.displayName || "A")[0].toUpperCase()}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-sans font-medium">{f.displayName}</p>
                      <p className="text-foreground/20 text-[10px] font-mono">{f.friendCode}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAcceptFriend(f.friendshipId, f.id)} className="rounded-lg h-8 px-3 text-[11px]">Accepter</Button>
                    <button onClick={() => handleDeclineFriend(f.friendshipId)} className="p-1 text-foreground/20 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-[11px] font-sans font-semibold text-foreground/30 uppercase tracking-widest mb-2">
            {acceptedFriends.length > 0 ? `Amis (${acceptedFriends.length})` : "Amis"}
          </h2>
          {acceptedFriends.length === 0 && pendingSent.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-card/30 border border-border/5">
              <Users className="w-8 h-8 mx-auto mb-3 text-foreground/10" />
              <p className="text-foreground/25 text-sm font-sans mb-1">Aucun ami pour le moment</p>
              <p className="text-foreground/15 text-xs font-sans">Partage ton code pour te connecter</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {acceptedFriends.map((f: any) => (
                <button key={f.friendshipId} onClick={() => handleViewFriendProfile(f)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/10 hover:border-border/25 transition-all text-left active:scale-[0.98]">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {f.avatarUrl ? <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" /> :
                      <span className="text-sm font-sans font-bold text-primary">{(f.displayName || "A")[0].toUpperCase()}</span>}
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
        </motion.div>
      </div>

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

export default Friends;
