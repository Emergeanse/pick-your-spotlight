import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, UserPlus, Users, X, Loader2, ChevronRight, Clapperboard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BrandHeader from "@/components/pick/BrandHeader";

import { sendNotification } from "@/lib/notifications";

interface Friend {
  id: string;
  friendshipId: string;
  displayName: string;
  friendCode: string;
  avatarUrl?: string | null;
  status: "pending" | "accepted" | "declined";
  isRequester: boolean;
}

interface FriendProfile {
  displayName: string;
  avatarUrl?: string | null;
  friendCode: string;
  favoriteGenres: string[];
  cinematicProfile?: {
    personalityTitle: string;
    dnaArchetype: string | null;
    globalLevel: string;
    tasteTraits: string[];
    narrative: string;
  } | null;
}

const Friends = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myFriendCode, setMyFriendCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCode, setAddCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("friend_code")
      .eq("id", user.id)
      .single();
    if (profile) setMyFriendCode((profile as any).friend_code || "");

    const { data: friendships } = await supabase
      .from("friendships" as any)
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (friendships && friendships.length > 0) {
      const otherIds = (friendships as any[]).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      const { data: otherProfiles } = await supabase
        .from("profiles")
        .select("id, display_name, friend_code, avatar_url")
        .in("id", otherIds);

      const profileMap = new Map((otherProfiles || []).map((p: any) => [p.id, p]));

      const mapped: Friend[] = (friendships as any[]).map((f: any) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const otherProfile = profileMap.get(otherId);
        return {
          id: otherId,
          friendshipId: f.id,
          displayName: otherProfile?.display_name || "Ami",
          friendCode: otherProfile?.friend_code || "",
          avatarUrl: otherProfile?.avatar_url || null,
          status: f.status,
          isRequester: f.requester_id === user.id,
        };
      });
      setFriends(mapped);
    } else {
      setFriends([]);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(myFriendCode);
    setCopied(true);
    toast.success("Code copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = async () => {
    if (!user || !addCode.trim()) return;
    const code = addCode.trim().toUpperCase();
    if (code === myFriendCode) {
      toast.error("Tu ne peux pas t'ajouter toi-même !");
      return;
    }

    setAdding(true);
    try {
      const { data: found } = await (supabase
        .from("profiles")
        .select("id, display_name") as any)
        .eq("friend_code", code)
        .single();

      if (!found) {
        toast.error("Code ami introuvable");
        setAdding(false);
        return;
      }

      const { data: existing } = await (supabase
        .from("friendships" as any)
        .select("id") as any)
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${user.id})`);

      if (existing && (existing as any[]).length > 0) {
        toast.info("Vous êtes déjà amis ou une demande est en cours");
        setAdding(false);
        return;
      }

      await supabase.from("friendships" as any).insert({
        requester_id: user.id,
        addressee_id: found.id,
        status: "pending",
      } as any);

      const { data: myProfile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      const myName = myProfile?.display_name || user.email?.split("@")[0] || "Quelqu'un";
      await sendNotification(found.id, "friend_request", `${myName} veut être ton ami !`, "Accepte sa demande pour regarder des films ensemble.");

      toast.success(`Demande envoyée à ${(found as any).display_name || "ton ami"} !`);
      setAddCode("");
      setShowAddModal(false);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setAdding(false);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    await supabase.from("friendships" as any).update({ status: "accepted" } as any).eq("id", friendshipId);
    const friendship = friends.find(f => f.friendshipId === friendshipId);
    if (friendship && user) {
      const { data: myProfile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      const myName = myProfile?.display_name || user.email?.split("@")[0] || "Quelqu'un";
      await sendNotification(friendship.id, "friend_accepted", `${myName} a accepté ta demande !`, "Vous pouvez maintenant regarder des films ensemble.");
    }
    toast.success("Ami accepté !");
    loadData();
  };

  const handleDecline = async (friendshipId: string) => {
    await supabase.from("friendships" as any).delete().eq("id", friendshipId);
    toast.success("Demande refusée");
    loadData();
  };

  const handleRemove = async (friendshipId: string) => {
    await supabase.from("friendships" as any).delete().eq("id", friendshipId);
    toast.success("Ami retiré");
    loadData();
  };

  const handleViewProfile = async (friend: Friend) => {
    setSelectedFriend(friend);
    setLoadingProfile(true);
    setFriendProfile(null);

    try {
      const [{ data: profile }, { data: cinematic }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, friend_code, favorite_genres").eq("id", friend.id).single(),
        supabase.from("cinematic_profiles").select("personality_title, dna_archetype, global_level, taste_traits, narrative").eq("user_id", friend.id).single(),
      ]);

      setFriendProfile({
        displayName: (profile as any)?.display_name || friend.displayName,
        avatarUrl: (profile as any)?.avatar_url || null,
        friendCode: (profile as any)?.friend_code || friend.friendCode,
        favoriteGenres: (profile as any)?.favorite_genres || [],
        cinematicProfile: cinematic ? {
          personalityTitle: (cinematic as any).personality_title,
          dnaArchetype: (cinematic as any).dna_archetype,
          globalLevel: (cinematic as any).global_level,
          tasteTraits: (cinematic as any).taste_traits || [],
          narrative: (cinematic as any).narrative,
        } : null,
      });
    } catch {
      setFriendProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const acceptedFriends = friends.filter(f => f.status === "accepted");
  const pendingReceived = friends.filter(f => f.status === "pending" && !f.isRequester);
  const pendingSent = friends.filter(f => f.status === "pending" && f.isRequester);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BrandHeader />
      <div className="h-full overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] pt-16 px-5">
        <div className="max-w-lg mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-serif text-foreground mb-1">Mes Amis</h1>
            <p className="text-muted-foreground text-sm font-sans">
              Gère tes amis et découvre leurs profils cinéma.
            </p>
          </div>

          {/* CTA soirée ciné */}
          {acceptedFriends.length >= 1 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/app/pick-together")}
              className="w-full mb-5 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20 hover:border-primary/35 transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-sans font-semibold text-foreground">Créer une soirée ciné</p>
                <p className="text-foreground/40 text-[11px] font-sans">Trouvez quoi regarder ensemble</p>
              </div>
              <ChevronRight className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors" />
            </motion.button>
          )}

          {/* My Friend Code */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 bg-card border border-border/30 mb-5"
          >
            <p className="text-muted-foreground text-xs font-sans mb-2">Ton code ami</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-mono font-bold text-primary tracking-wider">
                {myFriendCode || "..."}
              </span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-primary" />
                )}
              </button>
            </div>
            <p className="text-muted-foreground/50 text-[11px] font-sans mt-2">
              Partage ce code pour que tes amis puissent t'ajouter
            </p>
          </motion.div>

          {/* Add friend button */}
          <Button
            onClick={() => setShowAddModal(true)}
            className="w-full rounded-xl h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans mb-6"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter un ami
          </Button>

          {/* Pending received */}
          {pendingReceived.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-sans font-semibold text-foreground/70 mb-3">
                Demandes reçues ({pendingReceived.length})
              </h2>
              <div className="space-y-2">
                {pendingReceived.map(f => (
                  <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card border border-primary/20">
                    <div>
                      <p className="text-sm font-sans font-medium text-foreground">{f.displayName}</p>
                      <p className="text-muted-foreground text-[11px] font-mono">{f.friendCode}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAccept(f.friendshipId)} className="rounded-lg h-8 px-3 text-xs bg-primary text-primary-foreground">
                        Accepter
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDecline(f.friendshipId)} className="rounded-lg h-8 px-3 text-xs text-muted-foreground">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted friends */}
          <div className="mb-6">
            <h2 className="text-sm font-sans font-semibold text-foreground/70 mb-3">
              Mes amis ({acceptedFriends.length})
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : acceptedFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground/50 text-sm font-sans">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Aucun ami pour le moment.</p>
                <p className="text-xs mt-1">Ajoute des amis avec leur code Pick !</p>
              </div>
            ) : (
              <div className="space-y-2">
                {acceptedFriends.map(f => (
                  <motion.button
                    key={f.friendshipId}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleViewProfile(f)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/20 hover:border-border/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden border border-primary/10">
                        {f.avatarUrl ? (
                          <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-sans font-bold text-primary">
                            {(f.displayName || "A")[0].toUpperCase()}
                          </span>
                        )}
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
          </div>

          {/* Pending sent */}
          {pendingSent.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-sans font-semibold text-foreground/70 mb-3">
                En attente ({pendingSent.length})
              </h2>
              <div className="space-y-2">
                {pendingSent.map(f => (
                  <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/10">
                    <div>
                      <p className="text-sm font-sans text-foreground/60">{f.displayName}</p>
                      <p className="text-muted-foreground/40 text-[10px] font-sans">En attente de réponse</p>
                    </div>
                    <button
                      onClick={() => handleRemove(f.friendshipId)}
                      className="text-muted-foreground/30 hover:text-destructive transition-colors p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomTabBar />

      {/* Add friend modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="relative w-full max-w-lg rounded-t-3xl bg-card border-t border-border/30 p-6 pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <div className="w-10 h-1 rounded-full bg-border/40 mx-auto mb-5" />
              <h3 className="text-lg font-serif text-foreground mb-4">Ajouter un ami</h3>
              <p className="text-muted-foreground text-sm font-sans mb-4">
                Entre le code ami de ton pote (ex: PICK-A3F2)
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                  placeholder="PICK-XXXX"
                  className="flex-1 h-12 rounded-xl bg-background border border-border/30 px-4 font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
                  maxLength={9}
                />
                <Button
                  onClick={handleAddFriend}
                  disabled={adding || addCode.length < 9}
                  className="rounded-xl h-12 px-6 bg-primary text-primary-foreground"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend profile drawer */}
      <AnimatePresence>
        {selectedFriend && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedFriend(null)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-lg rounded-t-3xl bg-card border-t border-border/30 max-h-[85vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-card/90 backdrop-blur-xl z-10 px-6 pt-4 pb-3">
                <div className="w-10 h-1 rounded-full bg-border/40 mx-auto mb-4" />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-serif text-foreground">Profil</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedFriend) handleRemove(selectedFriend.friendshipId);
                        setSelectedFriend(null);
                      }}
                      className="text-xs font-sans text-destructive/60 hover:text-destructive transition-colors px-2 py-1"
                    >
                      Retirer
                    </button>
                    <button onClick={() => setSelectedFriend(null)} className="p-1 text-muted-foreground/40 hover:text-muted-foreground">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {loadingProfile ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : friendProfile ? (
                  <div className="space-y-5">
                    {/* Avatar & name */}
                    <div className="flex flex-col items-center py-4">
                      <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/20 flex items-center justify-center overflow-hidden mb-3">
                        {friendProfile.avatarUrl ? (
                          <img src={friendProfile.avatarUrl} alt={friendProfile.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-sans font-bold text-primary">
                            {(friendProfile.displayName || "A")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-serif font-semibold text-foreground">{friendProfile.displayName}</p>
                      <p className="text-muted-foreground/50 text-xs font-mono mt-0.5">{friendProfile.friendCode}</p>
                    </div>

                    {/* Favorite genres */}
                    {friendProfile.favoriteGenres.length > 0 && (
                      <div>
                        <p className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest mb-2">Genres favoris</p>
                        <div className="flex flex-wrap gap-1.5">
                          {friendProfile.favoriteGenres.map(g => (
                            <span key={g} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-sans font-medium">{g}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cinematic profile */}
                    {friendProfile.cinematicProfile ? (
                      <div className="rounded-2xl bg-background/50 border border-border/15 p-4 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Clapperboard className="w-4 h-4 text-primary" />
                          <p className="text-xs font-sans font-semibold text-foreground/70">Profil cinématographique</p>
                        </div>

                        <div>
                          <p className="text-lg font-serif font-semibold text-foreground">{friendProfile.cinematicProfile.personalityTitle}</p>
                          {friendProfile.cinematicProfile.dnaArchetype && (
                            <p className="text-primary text-xs font-sans font-medium mt-0.5">{friendProfile.cinematicProfile.dnaArchetype}</p>
                          )}
                          <p className="text-muted-foreground/50 text-[11px] font-sans mt-1">{friendProfile.cinematicProfile.globalLevel}</p>
                        </div>

                        {friendProfile.cinematicProfile.tasteTraits.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {friendProfile.cinematicProfile.tasteTraits.slice(0, 6).map(t => (
                              <span key={t} className="px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 text-[10px] font-sans">{t}</span>
                            ))}
                          </div>
                        )}

                        {friendProfile.cinematicProfile.narrative && (
                          <p className="text-foreground/50 text-xs font-sans leading-relaxed line-clamp-4">
                            {friendProfile.cinematicProfile.narrative}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-background/50 border border-border/15 p-5 text-center">
                        <Clapperboard className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-foreground/40 text-sm font-sans">Pas encore de profil cinéma</p>
                        <p className="text-foreground/20 text-[11px] font-sans mt-1">Ce profil se génère après quelques recommandations</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground/40 text-sm font-sans">
                    Profil introuvable
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Friends;
