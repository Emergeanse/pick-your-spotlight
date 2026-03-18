import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, UserPlus, Users, X, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BrandHeader from "@/components/pick/BrandHeader";
import BottomTabBar from "@/components/pick/BottomTabBar";

interface Friend {
  id: string;
  friendshipId: string;
  displayName: string;
  friendCode: string;
  status: "pending" | "accepted" | "declined";
  isRequester: boolean;
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

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch my friend code
    const { data: profile } = await supabase
      .from("profiles")
      .select("friend_code")
      .eq("id", user.id)
      .single();
    if (profile) setMyFriendCode((profile as any).friend_code || "");

    // Fetch friendships
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
        .select("id, display_name, friend_code")
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
      // Find profile by friend_code
      const { data: found } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("friend_code" as any, code)
        .single();

      if (!found) {
        toast.error("Code ami introuvable");
        setAdding(false);
        return;
      }

      // Check if friendship already exists
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
            <h1 className="text-2xl font-serif text-foreground mb-1">Pick Together</h1>
            <p className="text-muted-foreground text-sm font-sans">
              Regarde avec tes amis. Trouvez le film parfait ensemble.
            </p>
          </div>

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

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex-1 rounded-xl h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un ami
            </Button>
            {acceptedFriends.length >= 1 && (
              <Button
                onClick={() => navigate("/app/pick-together")}
                variant="outline"
                className="flex-1 rounded-xl h-12 gap-2 font-sans border-primary/30 text-primary hover:bg-primary/10"
              >
                <Users className="w-4 h-4" />
                Créer une soirée
              </Button>
            )}
          </div>

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
                  <div key={f.friendshipId} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                        <span className="text-sm font-sans font-bold text-primary">
                          {(f.displayName || "A")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-sans font-medium text-foreground">{f.displayName}</p>
                        <p className="text-muted-foreground/50 text-[10px] font-mono">{f.friendCode}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(f.friendshipId)}
                      className="text-muted-foreground/30 hover:text-destructive transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
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
    </div>
  );
};

export default Friends;
