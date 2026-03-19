import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, Sparkles, Star, Clock, ChevronRight, Check, Wind, Flame, Laugh, Heart, UserRound, UsersRound, Home, Film, Tv, Layers, ThumbsUp, ThumbsDown, Meh, RefreshCw, Bookmark, Zap, UserPlus, X, Plus, QrCode, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BrandHeader from "@/components/pick/BrandHeader";
import PickCharacter from "@/components/pick/PickCharacter";
import { QRCodeSVG } from "qrcode.react";
import type { MovieDetail } from "@/lib/tmdb";
import { getPosterUrl, getDisplayTitle, getYear, getBackdropUrl } from "@/lib/tmdb";
import { addToWatchlist } from "@/lib/watchlist";
import { likeMovie } from "@/lib/liked-movies";

interface Friend {
  id: string;
  displayName: string;
  friendCode: string;
  avatarUrl?: string | null;
}

interface Guest {
  id: string; // local UUID
  name: string;
  age?: number;
  gender?: "homme" | "femme" | "autre";
  favoriteGenres: string[];
}

interface GroupRecommendation {
  movie: MovieDetail;
  groupScore: number;
  reason: string;
  memberNotes: Record<string, string>;
  providers: { name: string; logo_path: string; provider_id: number }[];
}

type FlowStep = "landing" | "who" | "mood" | "loading" | "results";
type MediaChoice = "movie" | "tv" | "both";

const GENRE_OPTIONS = [
  "Action", "Aventure", "Animation", "Comédie", "Crime", "Documentaire",
  "Drame", "Famille", "Fantastique", "Horreur", "Romance", "Science-Fiction", "Thriller",
];

const MOODS: { id: string; icon: React.ElementType; label: string; emoji: string }[] = [
  { id: "relax", icon: Wind, label: "On veut se détendre", emoji: "😌" },
  { id: "excited", icon: Flame, label: "Quelque chose d'intense", emoji: "🔥" },
  { id: "fun", icon: Laugh, label: "On veut rigoler", emoji: "😂" },
  { id: "romantic", icon: Heart, label: "Un moment émotion", emoji: "💕" },
];

const LOADING_MESSAGES = [
  "J'analyse vos profils cinématographiques…",
  "Je croise vos goûts et vos envies…",
  "Le compromis parfait, ça se mérite…",
  "Je cherche LE film qui plaira à tout le monde…",
  "Presque… je peaufine ma sélection…",
  "Voilà, j'ai trouvé quelque chose de spécial…",
];

const PickTogether = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<FlowStep>("who");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<Guest[]>([]);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestAge, setGuestAge] = useState("");
  const [guestGender, setGuestGender] = useState<"homme" | "femme" | "autre" | "">("");
  const [guestGenres, setGuestGenres] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState<string | null>(null);
  const [mediaChoice, setMediaChoice] = useState<MediaChoice>("both");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [recommendations, setRecommendations] = useState<GroupRecommendation[]>([]);
  const [heroReaction, setHeroReaction] = useState<"like" | "meh" | "reject" | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [mediaStep, setMediaStep] = useState(false);
  const [showSessionQR, setShowSessionQR] = useState(false);
  const [sessionInviteCode, setSessionInviteCode] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [realtimeMembers, setRealtimeMembers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    loadFriends();
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;
    const { data: friendships } = await supabase
      .from("friendships" as any)
      .select("id, requester_id, addressee_id, status")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!friendships || friendships.length === 0) { setFriends([]); return; }

    const otherIds = (friendships as any[]).map((f: any) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, friend_code, avatar_url")
      .in("id", otherIds);

    setFriends(
      (profiles || []).map((p: any) => ({
        id: p.id,
        displayName: p.display_name || "Ami",
        friendCode: p.friend_code || "",
        avatarUrl: p.avatar_url,
      }))
    );
  };

  // ─── Session QR Code ───
  const handleCreateSessionQR = async () => {
    if (!user) return;
    setCreatingSession(true);
    try {
      const { data, error } = await supabase
        .from("group_sessions" as any)
        .insert({ creator_id: user.id, name: "Soirée ciné" } as any)
        .select("id, invite_code")
        .single();
      if (error) throw error;
      setSessionInviteCode((data as any).invite_code);
      setShowSessionQR(true);

      // Subscribe to realtime members
      const channel = supabase
        .channel(`session-${(data as any).id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "group_session_members",
          filter: `session_id=eq.${(data as any).id}`,
        }, async (payload: any) => {
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", payload.new.user_id)
            .single();
          setRealtimeMembers(prev => [
            ...prev,
            { id: payload.new.user_id, name: (prof as any)?.display_name || "Quelqu'un" },
          ]);
          toast.success(`${(prof as any)?.display_name || "Quelqu'un"} a rejoint la soirée !`);
        })
        .subscribe();

      // Cleanup on unmount handled by React
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création de la session");
    } finally {
      setCreatingSession(false);
    }
  };

  const sessionInviteUrl = sessionInviteCode
    ? `https://pick-your-spotlight.lovable.app/join?session=${sessionInviteCode}`
    : "";

  const handleShareSession = async () => {
    if (!sessionInviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Soirée ciné Pick", text: "Rejoins ma soirée ciné !", url: sessionInviteUrl });
      } catch {}
    } else {
      navigator.clipboard.writeText(sessionInviteUrl);
      toast.success("Lien copié !");
    }
  };

  const toggleFriend = (id: string) => {
    const totalOthers = selectedFriendIds.size + guests.length;
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (totalOthers < 5) next.add(id);
      else toast.info("Maximum 6 personnes");
      return next;
    });
  };

  const addGuest = () => {
    if (!guestName.trim()) { toast.info("Donne un prénom à ton invité"); return; }
    const totalOthers = selectedFriendIds.size + guests.length;
    if (totalOthers >= 5) { toast.info("Maximum 6 personnes"); return; }
    const newGuest: Guest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: guestName.trim(),
      age: guestAge ? parseInt(guestAge) : undefined,
      gender: guestGender || undefined,
      favoriteGenres: [...guestGenres],
    };
    setGuests(prev => [...prev, newGuest]);
    setGuestName("");
    setGuestAge("");
    setGuestGender("");
    setGuestGenres(new Set());
    setShowGuestForm(false);
  };

  const removeGuest = (id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
  };

  const toggleGuestGenre = (genre: string) => {
    setGuestGenres(prev => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else if (next.size < 5) next.add(genre);
      return next;
    });
  };

  const handleContinueFromWho = () => {
    if (selectedFriendIds.size === 0 && guests.length === 0) return;
    setMediaStep(true);
  };

  const handleMediaSelect = (choice: MediaChoice) => {
    setMediaChoice(choice);
    setMediaStep(false);
    setStep("mood");
  };

  const handleStartSearch = async (skipMood = false) => {
    if (!user || (selectedFriendIds.size === 0 && guests.length === 0)) return;
    setStep("loading");
    setLoading(true);
    let msgIdx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 3000);

    try {
      const memberIds = [user.id, ...selectedFriendIds];
      const guestProfiles = guests.map(g => ({
        name: g.name,
        age: g.age,
        gender: g.gender,
        favoriteGenres: g.favoriteGenres,
      }));
      const { data, error } = await supabase.functions.invoke("group-recommend", {
        body: {
          memberIds,
          guests: guestProfiles.length > 0 ? guestProfiles : undefined,
          mood: skipMood ? undefined : mood || undefined,
          mediaType: mediaChoice,
        },
      });
      clearInterval(msgInterval);
      if (error) throw error;
      if (data?.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setGroupInfo(data.groupInfo);
        setStep("results");
      } else {
        toast.error("Aucune recommandation trouvée");
        setStep("who");
      }
    } catch (e: any) {
      clearInterval(msgInterval);
      const msg = e?.message || "";
      if (msg.includes("429")) toast.error("Trop de requêtes, réessaie dans un instant.");
      else if (msg.includes("402")) toast.error("Crédits IA épuisés.");
      else toast.error("Erreur lors de la recherche");
      setStep("who");
    } finally { setLoading(false); }
  };

  const handleReject = () => {
    setHeroReaction("reject");
    setTimeout(() => {
      setHeroReaction(null);
      setRecommendations([]);
      handleStartSearch();
    }, 800);
  };

  const handleSelectMovie = (rec: GroupRecommendation) => {
    sessionStorage.setItem("pick-fab-movie", JSON.stringify(rec.movie));
    navigate("/app?from=pick-chat");
  };

  const handleAddToWatchlist = async (movie: MovieDetail) => {
    if (!user) return;
    try {
      await addToWatchlist(movie);
      toast.success("Ajouté à ta watchlist !");
    } catch { toast.error("Erreur"); }
  };

  const selectedCount = selectedFriendIds.size + guests.length + 1;
  const hero = recommendations[0];
  const alternatives = recommendations.slice(1, 3);
  const selectedFriends = friends.filter(f => selectedFriendIds.has(f.id));

  const goBack = () => {
    if (step === "results") { setStep("who"); setRecommendations([]); setHeroReaction(null); }
    else if (step === "mood") { setStep("who"); }
    else if (mediaStep) { setMediaStep(false); }
    else navigate("/app/pick-together");
  };

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BrandHeader showBack onBack={goBack} />

      <AnimatePresence mode="wait">
        {/* ─── STEP 1: WHO IS JOINING ─── */}
        {step === "who" && !mediaStep && (
          <motion.div key="who" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            className="h-full overflow-y-auto pt-16 pb-[calc(6rem+env(safe-area-inset-bottom))] px-5"
          >
            <div className="max-w-lg mx-auto">
              {/* Conversational header */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 mt-4">
                <PickCharacter mood="wave" size="sm" animate />
                <div className="mt-4 bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/10 relative">
                  <div className="absolute -top-2 left-8 w-4 h-4 bg-card/60 border-l border-t border-border/10 rotate-45" />
                  <p className="text-foreground text-[15px] font-sans leading-relaxed">
                    Super, une soirée ciné à plusieurs ! 🍿<br />
                    <span className="text-foreground/60">Qui sera là ce soir ?</span>
                  </p>
                </div>
              </motion.div>

              {/* Current user */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/15 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <span className="text-sm font-sans font-bold text-primary">Toi</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-sans font-semibold text-foreground">Toi</p>
                  <p className="text-foreground/30 text-[10px] font-sans">Organisateur</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              </div>

              {/* QR Code invite button */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={handleCreateSessionQR}
                disabled={creatingSession || showSessionQR}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-primary/20 hover:border-primary/40 bg-primary/5 transition-all mb-3 text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  {creatingSession ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-sans font-medium text-primary">Inviter par QR code</p>
                  <p className="text-foreground/30 text-[10px] font-sans">Les gens autour de toi rejoignent en scannant</p>
                </div>
              </motion.button>

              {/* Realtime joined members */}
              {realtimeMembers.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  <p className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-widest">Ont rejoint via QR</p>
                  {realtimeMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/15">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{m.name[0]}</span>
                      </div>
                      <p className="text-sm font-sans text-foreground">{m.name}</p>
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    </div>
                  ))}
                </div>
              )}

              {/* Friends */}
              {friends.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-foreground/50 text-sm font-sans mb-1">Pas encore d'amis sur Pick</p>
                  <p className="text-foreground/30 text-xs font-sans mb-4">Partage ton code ami pour commencer</p>
                  <Button onClick={() => navigate("/app/profile")} variant="outline" className="rounded-xl font-sans border-primary/30 text-primary">
                    Ajouter des amis
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {friends.map((f, i) => {
                    const selected = selectedFriendIds.has(f.id);
                    return (
                      <motion.button
                        key={f.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleFriend(f.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                          selected
                            ? "bg-primary/8 border-primary/25 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.2)]"
                            : "bg-card/40 border-border/10 hover:border-border/25"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all overflow-hidden ${
                          selected ? "bg-primary/15 border-primary/30" : "bg-muted/50 border-border/20"
                        }`}>
                          {f.avatarUrl ? (
                            <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className={`text-sm font-sans font-bold ${selected ? "text-primary" : "text-muted-foreground"}`}>
                              {f.displayName[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-sans font-medium transition-colors ${selected ? "text-foreground" : "text-foreground/70"}`}>{f.displayName}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selected ? "border-primary bg-primary" : "border-border/30"
                        }`}>
                          {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* ─── GUESTS ─── */}
              <div className="mt-5">
                <p className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest mb-3">Invités (sans compte)</p>

                {/* Existing guests */}
                {guests.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-accent/5 border border-accent/15 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center">
                      <span className="text-sm font-sans font-bold text-accent-foreground/70">{g.name[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-sans font-medium text-foreground">{g.name}</p>
                      <p className="text-foreground/30 text-[10px] font-sans truncate">
                        {[g.age ? `${g.age} ans` : null, g.gender, g.favoriteGenres.length > 0 ? g.favoriteGenres.slice(0, 2).join(", ") : null].filter(Boolean).join(" · ") || "Invité"}
                      </p>
                    </div>
                    <button onClick={() => removeGuest(g.id)} className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center hover:bg-destructive/10 transition-colors">
                      <X className="w-3 h-3 text-foreground/30" />
                    </button>
                  </div>
                ))}

                {/* Add guest button / form */}
                <AnimatePresence mode="wait">
                  {!showGuestForm ? (
                    <motion.button
                      key="add-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowGuestForm(true)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-border/20 hover:border-primary/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted/20 border border-border/15 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                        <UserPlus className="w-4 h-4 text-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-sans font-medium text-foreground/50 group-hover:text-foreground/70 transition-colors">Ajouter un invité</p>
                        <p className="text-foreground/25 text-[10px] font-sans">Quelqu'un sans compte Pick</p>
                      </div>
                    </motion.button>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/15 p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-sans font-semibold text-foreground">Nouvel invité</p>
                        <button onClick={() => setShowGuestForm(false)} className="text-foreground/30 hover:text-foreground/60 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Name */}
                      <div>
                        <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Prénom *</label>
                        <input
                          type="text"
                          value={guestName}
                          onChange={e => setGuestName(e.target.value)}
                          placeholder="Ex: Sarah"
                          maxLength={30}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border/15 text-foreground text-sm font-sans placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 transition-colors"
                        />
                      </div>

                      {/* Age + Gender row */}
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Âge</label>
                          <input
                            type="number"
                            value={guestAge}
                            onChange={e => setGuestAge(e.target.value)}
                            placeholder="25"
                            min={5}
                            max={99}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border/15 text-foreground text-sm font-sans placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Genre</label>
                          <div className="flex gap-1.5">
                            {(["homme", "femme", "autre"] as const).map(g => (
                              <button
                                key={g}
                                onClick={() => setGuestGender(guestGender === g ? "" : g)}
                                className={`flex-1 py-2 rounded-lg text-[11px] font-sans font-medium transition-all border ${
                                  guestGender === g
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-background/40 border-border/10 text-foreground/40 hover:border-border/25"
                                }`}
                              >
                                {g === "homme" ? "H" : g === "femme" ? "F" : "?"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Favorite genres */}
                      <div>
                        <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Genres préférés</label>
                        <div className="flex flex-wrap gap-1.5">
                          {GENRE_OPTIONS.map(genre => {
                            const selected = guestGenres.has(genre);
                            return (
                              <button
                                key={genre}
                                onClick={() => toggleGuestGenre(genre)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-sans transition-all border ${
                                  selected
                                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                                    : "bg-background/40 border-border/10 text-foreground/40 hover:border-border/25"
                                }`}
                              >
                                {genre}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Add button */}
                      <Button
                        onClick={addGuest}
                        disabled={!guestName.trim()}
                        className="w-full rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-sans gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter {guestName.trim() || "l'invité"}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Continue button */}
              <AnimatePresence>
                {(selectedFriendIds.size > 0 || guests.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-0 left-0 right-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-transparent z-20"
                  >
                    <Button
                      onClick={handleContinueFromWho}
                      className="w-full max-w-lg mx-auto block rounded-2xl h-14 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-base neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
                    >
                      <Users className="w-4 h-4" />
                      C'est parti — {selectedCount} personnes
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 1b: MEDIA TYPE ─── */}
        {step === "who" && mediaStep && (
          <motion.div key="media" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            className="h-full overflow-y-auto pt-16 pb-8 px-5"
          >
            <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh]">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                <h2 className="text-2xl md:text-4xl font-serif text-foreground mb-2">Vous cherchez quoi ?</h2>
                <p className="text-foreground/40 text-sm font-sans">Film, série, ou les deux ?</p>
              </motion.div>

              <div className="flex flex-col gap-3 w-full max-w-md">
                {([
                  { value: "movie" as MediaChoice, icon: Film, label: "Un film", desc: "Long-métrage" },
                  { value: "tv" as MediaChoice, icon: Tv, label: "Une série", desc: "Série ou documentaire" },
                  { value: "both" as MediaChoice, icon: Layers, label: "Peu importe", desc: "Films et séries" },
                ]).map((opt, i) => {
                  const Icon = opt.icon;
                  return (
                    <motion.button
                      key={opt.value}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleMediaSelect(opt.value)}
                      className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 text-left border border-border/10 hover:border-primary/30 transition-all flex items-center gap-4"
                    >
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary/60" />
                      </div>
                      <div>
                        <span className="font-serif text-lg text-foreground block">{opt.label}</span>
                        <span className="text-foreground/40 text-xs font-sans">{opt.desc}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 2: MOOD (Conversational) ─── */}
        {step === "mood" && (
          <motion.div key="mood" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            className="h-full overflow-y-auto pt-16 pb-8 px-5"
          >
            <div className="max-w-lg mx-auto">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 mt-4">
                <PickCharacter mood="default" size="sm" animate={false} />
                <div className="mt-4 bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/10 relative">
                  <div className="absolute -top-2 left-8 w-4 h-4 bg-card/60 border-l border-t border-border/10 rotate-45" />
                  <p className="text-foreground text-[15px] font-sans leading-relaxed">
                    Parfait, vous êtes {selectedCount} ! 🎬<br />
                    <span className="text-foreground/60">C'est quoi l'ambiance ce soir ?</span>
                  </p>
                </div>
              </motion.div>

              {/* Group avatars mini row */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center z-10">
                    <span className="text-[9px] font-bold text-primary">Toi</span>
                  </div>
                  {selectedFriends.slice(0, 4).map((f, i) => (
                    <div key={f.id} className="w-7 h-7 rounded-full bg-card border-2 border-background flex items-center justify-center" style={{ zIndex: 9 - i }}>
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-bold text-foreground/50">{f.displayName[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-foreground/30 text-[11px] font-sans">{selectedCount} personnes</span>
              </div>

              {/* Mood cards */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {MOODS.map((m, i) => {
                  const selected = mood === m.id;
                  return (
                    <motion.button
                      key={m.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15 + i * 0.06 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMood(mood === m.id ? null : m.id)}
                      className={`relative p-4 rounded-2xl border text-left transition-all duration-200 ${
                        selected
                          ? "bg-primary/10 border-primary/30 shadow-[0_0_25px_-5px_hsl(var(--primary)/0.3)]"
                          : "bg-card/40 border-border/10 hover:border-border/25"
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{m.emoji}</span>
                      <span className={`text-sm font-sans font-medium block transition-colors ${selected ? "text-foreground" : "text-foreground/70"}`}>
                        {m.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  onClick={() => handleStartSearch(false)}
                  className="w-full rounded-2xl h-14 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-base neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
                >
                  <Sparkles className="w-4 h-4" />
                  Trouver le film parfait
                </Button>
                <button
                  onClick={() => handleStartSearch(true)}
                  className="w-full text-center text-foreground/30 text-xs font-sans hover:text-foreground/50 transition-colors py-2"
                >
                  Passer — surprise totale
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 3: LOADING (AI Moment) ─── */}
        {step === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <PickCharacter mood="think" size="md" animate />
              <motion.p
                key={loadingMsg}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-foreground/60 text-sm font-sans mt-6 italic"
              >
                {loadingMsg}
              </motion.p>

              {/* Group avatars during loading */}
              <div className="flex -space-x-3 mt-8">
                {[{ name: "Toi" }, ...selectedFriends].map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.15, type: "spring" }}
                    className="w-10 h-10 rounded-full bg-card border-2 border-background flex items-center justify-center"
                  >
                    <span className="text-[10px] font-bold text-foreground/50">
                      {"displayName" in p ? p.displayName[0] : p.name[0]}
                    </span>
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 8, ease: "linear" }}
                className="h-0.5 bg-primary/30 rounded-full mt-6 max-w-[200px]"
              />
            </motion.div>
          </motion.div>
        )}

        {/* ─── STEP 4: RESULTS (Hero + Alternatives) ─── */}
        {step === "results" && hero && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full overflow-y-auto"
          >
            {/* Hero backdrop */}
            <div className="relative min-h-[70vh]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getBackdropUrl(hero.movie.backdrop_path) || getPosterUrl(hero.movie.poster_path, "w780")})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent h-24" />

              {/* Hero content */}
              <div className="relative z-10 flex flex-col items-center justify-end min-h-[70vh] px-6 pb-6">
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/25 backdrop-blur-sm mb-4"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-primary text-xs font-sans font-semibold tracking-wide">Pick Together</span>
                </motion.div>

                {/* Poster */}
                {hero.movie.poster_path && (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.85, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 180 }}
                    src={getPosterUrl(hero.movie.poster_path, "w342") || ""}
                    alt={getDisplayTitle(hero.movie)}
                    className="w-40 h-60 md:w-48 md:h-72 rounded-2xl object-cover shadow-2xl border border-border/20 mb-5"
                  />
                )}

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl md:text-3xl font-serif text-foreground text-center mb-1"
                >
                  {getDisplayTitle(hero.movie)}
                </motion.h1>

                {/* Meta */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-2 text-foreground/40 text-xs font-sans mb-4"
                >
                  <span>{getYear(hero.movie)}</span>
                  {hero.movie.runtime > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{hero.movie.runtime} min</span>
                    </>
                  )}
                  {hero.movie.vote_average > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-gold text-gold" />{hero.movie.vote_average.toFixed(1)}</span>
                    </>
                  )}
                </motion.div>

                {/* Group Match Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/60 backdrop-blur-md border border-border/15 mb-4"
                >
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" strokeWidth="3" stroke="hsl(var(--muted))" fill="none" />
                      <motion.circle
                        cx="28" cy="28" r="24" strokeWidth="3" stroke="hsl(var(--primary))" fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - hero.groupScore / 100) }}
                        transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-primary text-sm font-sans font-bold">
                      {hero.groupScore}%
                    </span>
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-sans font-semibold">Compatibilité groupe</p>
                    <p className="text-foreground/40 text-[11px] font-sans">{selectedCount} personnes · Recommandé par Pick</p>
                  </div>
                </motion.div>

                {/* Reason */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-foreground/50 text-[13px] font-sans text-center leading-relaxed max-w-sm mb-3 italic"
                >
                  "{hero.reason}"
                </motion.p>

                {/* Providers */}
                {hero.providers && hero.providers.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className="flex items-center gap-2 mb-6"
                  >
                    <span className="text-foreground/25 text-[10px] font-sans">Disponible sur</span>
                    <div className="flex gap-1.5">
                      {hero.providers.map(p => (
                        <img key={p.provider_id} src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.name}
                          className="w-6 h-6 rounded-lg object-cover border border-border/20" />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Member notes */}
                {hero.memberNotes && Object.keys(hero.memberNotes).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="w-full max-w-sm space-y-2 mb-6"
                  >
                    {Object.entries(hero.memberNotes).map(([name, note], i) => (
                      <div key={name} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-card/40 backdrop-blur-sm border border-border/10">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-bold text-primary">{name[0]}</span>
                        </div>
                        <div>
                          <span className="text-foreground/70 text-xs font-sans font-medium">{name}</span>
                          <p className="text-foreground/40 text-[11px] font-sans">{note}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Reaction buttons */}
            <div className="px-6 pb-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="flex items-center justify-center gap-4 mb-6"
              >
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleReject}
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    heroReaction === "reject"
                      ? "border-destructive bg-destructive/10 scale-110"
                      : "border-border/20 bg-card/40 hover:border-destructive/40"
                  }`}
                >
                  <ThumbsDown className={`w-5 h-5 ${heroReaction === "reject" ? "text-destructive" : "text-foreground/40"}`} />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSelectMovie(hero)}
                  className="w-16 h-16 rounded-full bg-primary flex items-center justify-center neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform"
                >
                  <ThumbsUp className="w-6 h-6 text-primary-foreground" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleAddToWatchlist(hero.movie)}
                  className="w-14 h-14 rounded-full border-2 border-border/20 bg-card/40 flex items-center justify-center hover:border-primary/40 transition-all"
                >
                  <Bookmark className="w-5 h-5 text-foreground/40" />
                </motion.button>
              </motion.div>

              <div className="flex items-center justify-center gap-6 text-[10px] font-sans text-foreground/25 mb-8">
                <span>Pas pour nous</span>
                <span>On regarde !</span>
                <span>Watchlist</span>
              </div>
            </div>

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <div className="px-6 pb-10">
                <button
                  onClick={() => setShowAlternatives(!showAlternatives)}
                  className="flex items-center gap-2 mb-4 text-foreground/40 text-xs font-sans hover:text-foreground/60 transition-colors"
                >
                  <span>{showAlternatives ? "Masquer" : "Voir"} les alternatives</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAlternatives ? "rotate-90" : ""}`} />
                </button>

                <AnimatePresence>
                  {showAlternatives && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {alternatives.map((rec, idx) => (
                        <motion.button
                          key={rec.movie.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectMovie(rec)}
                          className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/10 hover:border-border/25 transition-all text-left"
                        >
                          {rec.movie.poster_path && (
                            <img
                              src={getPosterUrl(rec.movie.poster_path, "w92") || ""}
                              alt={getDisplayTitle(rec.movie)}
                              className="w-14 h-20 rounded-xl object-cover shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-serif text-foreground leading-tight mb-1 truncate">{getDisplayTitle(rec.movie)}</h3>
                            <div className="flex items-center gap-1.5 text-foreground/30 text-[10px] font-sans mb-1.5">
                              <span>{getYear(rec.movie)}</span>
                              {rec.movie.vote_average > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-gold text-gold" />
                                  {rec.movie.vote_average.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary/60" style={{ width: `${rec.groupScore}%` }} />
                              </div>
                              <span className="text-primary/70 text-[10px] font-sans font-semibold">{rec.groupScore}%</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-foreground/15 shrink-0" />
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Restart */}
                <button
                  onClick={() => {
                    setRecommendations([]);
                    setHeroReaction(null);
                    setShowAlternatives(false);
                    setStep("who");
                  }}
                  className="w-full mt-6 text-center text-foreground/25 text-xs font-sans hover:text-foreground/40 transition-colors"
                >
                  ← Recommencer avec d'autres amis
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SESSION QR CODE MODAL ─── */}
      <AnimatePresence>
        {showSessionQR && sessionInviteCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setShowSessionQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 max-w-sm w-full border border-border/15 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-primary text-[11px] font-sans font-semibold">Soirée ciné</span>
                </div>
                <h2 className="text-xl font-serif text-foreground">Scanne pour rejoindre</h2>
                <p className="text-foreground/40 text-xs font-sans mt-1">Les autres scannent ce QR pour rejoindre ta soirée</p>
              </div>

              <div className="flex justify-center mb-6">
                <div className="bg-white rounded-2xl p-4">
                  <QRCodeSVG value={sessionInviteUrl} size={200} level="M" />
                </div>
              </div>

              <div className="text-center mb-4">
                <p className="text-foreground/30 text-[10px] font-sans uppercase tracking-widest mb-1">Code session</p>
                <p className="text-foreground font-mono text-lg font-bold tracking-wider">{sessionInviteCode}</p>
              </div>

              {realtimeMembers.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-widest mb-2">
                    {realtimeMembers.length} participant{realtimeMembers.length > 1 ? "s" : ""} rejoint{realtimeMembers.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {realtimeMembers.map(m => (
                      <span key={m.id} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-sans">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleShareSession}
                  variant="outline"
                  className="flex-1 rounded-xl font-sans gap-2 border-border/20"
                >
                  <Share2 className="w-4 h-4" />
                  Partager
                </Button>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(sessionInviteUrl);
                    toast.success("Lien copié !");
                  }}
                  variant="outline"
                  className="rounded-xl font-sans border-border/20"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <button
                onClick={() => setShowSessionQR(false)}
                className="w-full mt-3 text-center text-foreground/30 text-xs font-sans hover:text-foreground/50 transition-colors py-2"
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PickTogether;
