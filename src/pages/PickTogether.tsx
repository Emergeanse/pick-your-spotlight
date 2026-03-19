import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, ArrowLeft, Sparkles, Star, Clock, ChevronRight, Check, Wind, Flame, Laugh, Heart, UserRound, UsersRound, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BrandHeader from "@/components/pick/BrandHeader";
import PickCharacter from "@/components/pick/PickCharacter";
import type { MovieDetail } from "@/lib/tmdb";
import { getPosterUrl, getDisplayTitle, getYear } from "@/lib/tmdb";

interface Friend {
  id: string;
  displayName: string;
  friendCode: string;
}

interface GroupRecommendation {
  movie: MovieDetail;
  groupScore: number;
  reason: string;
  memberNotes: Record<string, string>;
  providers: { name: string; logo_path: string; provider_id: number }[];
}

type SessionStep = "select-friends" | "select-mood" | "loading" | "results";

const MOODS: { id: string; icon: React.ElementType; label: string; description: string }[] = [
  { id: "relax", icon: Wind, label: "Détente", description: "Calme et apaisant" },
  { id: "excited", icon: Flame, label: "Intense", description: "Adrénaline et tension" },
  { id: "fun", icon: Laugh, label: "Fun", description: "Rires et bonne humeur" },
  { id: "romantic", icon: Heart, label: "Romantique", description: "Amour et émotion" },
];

const CONTEXTS: { id: string; icon: React.ElementType; label: string }[] = [
  { id: "couple", icon: UserRound, label: "En duo" },
  { id: "friends", icon: UsersRound, label: "Entre amis" },
  { id: "family", icon: Home, label: "En famille" },
];

const LOADING_MESSAGES = [
  "On croise vos profils…",
  "On cherche le compromis parfait…",
  "Analyse des goûts de chacun…",
  "Le film idéal pour tout le monde…",
  "Presque trouvé…",
  "On peaufine la sélection…",
];

const PickTogether = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<SessionStep>("select-friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [recommendations, setRecommendations] = useState<GroupRecommendation[]>([]);
  const [selectedRecIdx, setSelectedRecIdx] = useState<number | null>(null);

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

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      return;
    }

    const otherIds = (friendships as any[]).map((f: any) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, friend_code")
      .in("id", otherIds);

    setFriends(
      (profiles || []).map((p: any) => ({
        id: p.id,
        displayName: p.display_name || "Ami",
        friendCode: p.friend_code || "",
      }))
    );
  };

  const toggleFriend = (id: string) => {
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      else toast.info("Maximum 6 personnes (toi + 5 amis)");
      return next;
    });
  };

  const handleStartSearch = async () => {
    if (!user || selectedFriendIds.size === 0) return;

    setStep("loading");
    setLoading(true);
    let msgIdx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 2500);

    try {
      const memberIds = [user.id, ...selectedFriendIds];

      const { data, error } = await supabase.functions.invoke("group-recommend", {
        body: {
          memberIds,
          mood: mood || undefined,
          context: context || undefined,
          timeAvailable: undefined,
        },
      });

      clearInterval(msgInterval);

      if (error) throw error;
      if (data?.recommendations) {
        setRecommendations(data.recommendations);
        setStep("results");
      } else {
        toast.error("Aucune recommandation trouvée");
        setStep("select-friends");
      }
    } catch (e: any) {
      clearInterval(msgInterval);
      console.error(e);
      const msg = e?.message || "";
      if (msg.includes("429")) toast.error("Trop de requêtes, réessaie dans un instant.");
      else if (msg.includes("402")) toast.error("Crédits IA épuisés.");
      else toast.error("Erreur lors de la recherche");
      setStep("select-friends");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMovie = (rec: GroupRecommendation) => {
    // Store movie and navigate to result
    sessionStorage.setItem("pick-fab-movie", JSON.stringify(rec.movie));
    navigate("/app?from=pick-chat");
  };

  const selectedCount = selectedFriendIds.size + 1; // +1 for the user

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BrandHeader showBack onBack={() => {
        if (step === "results") setStep("select-friends");
        else if (step === "select-mood") setStep("select-friends");
        else navigate("/app/friends");
      }} />

      <div className="h-full overflow-y-auto pt-16 pb-[calc(2rem+env(safe-area-inset-bottom))] px-5">
        <div className="max-w-lg mx-auto">

          <AnimatePresence mode="wait">
            {/* Step 1: Select friends */}
            {step === "select-friends" && (
              <motion.div key="friends" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary text-xs font-sans font-semibold">Pick Together</span>
                  </div>
                  <h1 className="text-2xl font-serif text-foreground mb-1">Qui regarde ce soir ?</h1>
                  <p className="text-muted-foreground text-sm font-sans">
                    Sélectionne les amis qui regardent avec toi
                  </p>
                </div>

                {/* Current user */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 mb-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-sans font-bold text-primary">Toi</span>
                  </div>
                  <p className="text-sm font-sans font-medium text-foreground">Toi</p>
                  <Check className="w-4 h-4 text-primary ml-auto" />
                </div>

                {/* Friends list */}
                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-sans mb-3">Aucun ami ajouté</p>
                    <Button
                      onClick={() => navigate("/app/friends")}
                      variant="outline"
                      className="rounded-xl font-sans border-primary/30 text-primary"
                    >
                      Ajouter des amis
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 mb-6">
                    {friends.map(f => {
                      const selected = selectedFriendIds.has(f.id);
                      return (
                        <motion.button
                          key={f.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleFriend(f.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            selected
                              ? "bg-primary/10 border-primary/30"
                              : "bg-card/50 border-border/15 hover:border-border/30"
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            selected ? "bg-primary/20" : "bg-muted"
                          }`}>
                            <span className={`text-sm font-sans font-bold ${selected ? "text-primary" : "text-muted-foreground"}`}>
                              {f.displayName[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-sans font-medium text-foreground">{f.displayName}</p>
                            <p className="text-muted-foreground/40 text-[10px] font-mono">{f.friendCode}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selected ? "border-primary bg-primary" : "border-border/40"
                          }`}>
                            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {selectedFriendIds.size > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Button
                      onClick={() => setStep("select-mood")}
                      className="w-full rounded-xl h-13 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-base neon-glow"
                    >
                      Continuer ({selectedCount} personnes)
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 2: Mood & context */}
            {step === "select-mood" && (
              <motion.div key="mood" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <div className="mb-6">
                  <h1 className="text-2xl font-serif text-foreground mb-1">Quelle ambiance ?</h1>
                  <p className="text-muted-foreground text-sm font-sans">
                    Optionnel — aide Pick à trouver le film parfait
                  </p>
                </div>

                <p className="text-[10px] font-sans font-semibold text-foreground/40 mb-3 uppercase tracking-widest">Humeur</p>
                <div className="grid grid-cols-2 gap-2.5 mb-8">
                  {MOODS.map((m, i) => {
                    const Icon = m.icon;
                    const selected = mood === m.id;
                    return (
                      <motion.button
                        key={m.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setMood(mood === m.id ? null : m.id)}
                        className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                          selected
                            ? "bg-primary/10 border-primary/30 neon-glow"
                            : "bg-card/50 border-border/15 hover:border-primary/20 hover:bg-card/80"
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 transition-colors ${selected ? "text-primary" : "text-primary/40"}`} />
                        <div>
                          <span className="text-sm font-serif font-medium text-foreground block">{m.label}</span>
                          <span className="text-muted-foreground/50 text-[11px] font-sans mt-0.5 block">{m.description}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <p className="text-[10px] font-sans font-semibold text-foreground/40 mb-3 uppercase tracking-widest">Contexte</p>
                <div className="grid grid-cols-3 gap-2.5 mb-8">
                  {CONTEXTS.map((c, i) => {
                    const Icon = c.icon;
                    const selected = context === c.id;
                    return (
                      <motion.button
                        key={c.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setContext(context === c.id ? null : c.id)}
                        className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                          selected
                            ? "bg-primary/10 border-primary/30 neon-glow"
                            : "bg-card/50 border-border/15 hover:border-primary/20 hover:bg-card/80"
                        }`}
                      >
                        <Icon className={`w-5 h-5 transition-colors ${selected ? "text-primary" : "text-primary/40"}`} />
                        <span className="text-xs font-sans font-medium text-foreground">{c.label}</span>
                      </motion.button>
                    );
                  })}
                </div>

                <Button
                  onClick={handleStartSearch}
                  className="w-full rounded-xl h-13 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-base neon-glow"
                >
                  <Sparkles className="w-4 h-4" />
                  Trouver le film parfait
                </Button>

                <button
                  onClick={() => { setMood(null); setContext(null); handleStartSearch(); }}
                  className="w-full mt-3 text-center text-muted-foreground/50 text-xs font-sans hover:text-muted-foreground transition-colors"
                >
                  Passer — surprise totale
                </button>
              </motion.div>
            )}

            {/* Step 3: Loading */}
            {step === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center min-h-[60vh]"
              >
                <PickCharacter mood="think" message={loadingMsg} size="md" animate />
              </motion.div>
            )}

            {/* Step 4: Results */}
            {step === "results" && (
              <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary text-xs font-sans font-semibold">Pick Together</span>
                  </div>
                  <h1 className="text-2xl font-serif text-foreground mb-1">
                    {recommendations.length} films pour votre groupe
                  </h1>
                  <p className="text-muted-foreground text-sm font-sans">
                    {selectedCount} personnes · Classés par compatibilité groupe
                  </p>
                </div>

                <div className="space-y-4">
                  {recommendations.map((rec, idx) => (
                    <motion.div
                      key={rec.movie.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedRecIdx(selectedRecIdx === idx ? null : idx)}
                        className="w-full text-left rounded-2xl overflow-hidden bg-card border border-border/20 hover:border-border/40 transition-all"
                      >
                        <div className="flex gap-4 p-4">
                          {/* Poster */}
                          {rec.movie.poster_path && (
                            <img
                              src={getPosterUrl(rec.movie.poster_path, "w185") || ""}
                              alt={getDisplayTitle(rec.movie)}
                              className="w-20 h-[120px] rounded-xl object-cover shrink-0"
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            {/* Rank badge */}
                            {idx === 0 && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/25 mb-1.5">
                                <Star className="w-3 h-3 text-gold fill-gold" />
                                <span className="text-gold text-[10px] font-sans font-bold">Meilleur choix</span>
                              </div>
                            )}

                            <h3 className="text-base font-serif text-foreground leading-tight mb-1">
                              {getDisplayTitle(rec.movie)}
                            </h3>

                            <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-sans mb-2">
                              <span>{getYear(rec.movie)}</span>
                              {rec.movie.runtime > 0 && (
                                <>
                                  <span className="text-border">•</span>
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" />
                                    {rec.movie.runtime} min
                                  </span>
                                </>
                              )}
                              {rec.movie.vote_average > 0 && (
                                <>
                                  <span className="text-border">•</span>
                                  <span className="flex items-center gap-0.5">
                                    <Star className="w-3 h-3 fill-gold text-gold" />
                                    {rec.movie.vote_average.toFixed(1)}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Group score */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${rec.groupScore}%` }}
                                  transition={{ delay: idx * 0.1 + 0.3, duration: 0.6 }}
                                  className="h-full rounded-full bg-primary"
                                />
                              </div>
                              <span className="text-primary text-xs font-sans font-bold">{rec.groupScore}%</span>
                            </div>

                            {/* Providers */}
                            {rec.providers && rec.providers.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                {rec.providers.slice(0, 4).map(p => (
                                  <img
                                    key={p.provider_id}
                                    src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                                    alt={p.name}
                                    className="w-5 h-5 rounded object-cover"
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <ChevronRight className={`w-4 h-4 text-muted-foreground/30 shrink-0 mt-1 transition-transform ${selectedRecIdx === idx ? "rotate-90" : ""}`} />
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {selectedRecIdx === idx && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-1 border-t border-border/10">
                                <p className="text-sm font-sans text-foreground/70 mb-3">{rec.reason}</p>

                                {/* Member notes */}
                                {rec.memberNotes && Object.keys(rec.memberNotes).length > 0 && (
                                  <div className="space-y-1.5">
                                    {Object.entries(rec.memberNotes).map(([name, note]) => (
                                      <div key={name} className="flex items-start gap-2">
                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                          <span className="text-[9px] font-sans font-bold text-primary">{name[0]}</span>
                                        </div>
                                        <p className="text-xs font-sans text-muted-foreground">
                                          <span className="text-foreground/70 font-medium">{name}</span> — {note}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <Button
                                  onClick={(e) => { e.stopPropagation(); handleSelectMovie(rec); }}
                                  className="w-full mt-4 rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-sans gap-2"
                                >
                                  Découvrir ce film
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </motion.div>
                  ))}
                </div>

                {/* Restart */}
                <button
                  onClick={() => {
                    setRecommendations([]);
                    setSelectedRecIdx(null);
                    setStep("select-friends");
                  }}
                  className="w-full mt-6 text-center text-muted-foreground/50 text-sm font-sans hover:text-muted-foreground transition-colors"
                >
                  ← Recommencer avec d'autres amis
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PickTogether;
