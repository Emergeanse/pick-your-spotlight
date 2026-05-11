import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BrandHeader from "@/components/pick/BrandHeader";

import type { MovieDetail } from "@/lib/tmdb";
import { addToWatchlist } from "@/lib/watchlist";
import { likeMovie } from "@/lib/liked-movies";
import {
  createGroupSession,
  addGuestMember,
  selectGroupSessionFilm,
} from "@/lib/group-sessions";
import {
  createRecommendationSession,
  logRecommendationEvent,
  completeSession,
  abandonSession,
} from "@/lib/sessions";

// Sub-components
import LandingStep from "@/components/pick/together/LandingStep";
import WhoStep from "@/components/pick/together/WhoStep";
import type { Friend, Guest } from "@/components/pick/together/WhoStep";
import MediaStep from "@/components/pick/together/MediaStep";
import type { MediaChoice } from "@/components/pick/together/MediaStep";
import MoodStep from "@/components/pick/together/MoodStep";
import LoadingStep from "@/components/pick/together/LoadingStep";
import ResultsStep from "@/components/pick/together/ResultsStep";
import type { GroupRecommendation } from "@/components/pick/together/ResultsStep";

type FlowStep = "landing" | "who" | "mood" | "loading" | "results";

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
  const [step, setStep] = useState<FlowStep>("landing");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<Guest[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [mediaChoice, setMediaChoice] = useState<MediaChoice>("both");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [recommendations, setRecommendations] = useState<GroupRecommendation[]>([]);
  const [heroReaction, setHeroReaction] = useState<"like" | "meh" | "reject" | null>(null);
  const [sessionInviteCode, setSessionInviteCode] = useState<string | null>(null);
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);
  const [recoSessionId, setRecoSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [realtimeMembers, setRealtimeMembers] = useState<{ id: string; name: string }[]>([]);
  const [mediaStep, setMediaStep] = useState(false);

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

  const handleCreateSoiree = async () => {
    if (!user) return;
    setCreatingSession(true);
    try {
      const session = await createGroupSession({
        title: "Soirée ciné",
        decision_mode: "instant",
      });
      const sessionId = (session as any).id;
      const inviteCode = (session as any).invite_code;
      setGroupSessionId(sessionId);
      setSessionInviteCode(inviteCode);

      supabase
        .channel(`session-${sessionId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "group_session_members",
          filter: `session_id=eq.${sessionId}`,
        }, async (payload: any) => {
          const memberId = payload.new.user_id;
          const guestName = payload.new.guest_name;
          if (memberId && memberId !== user.id) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", memberId)
              .single();
            const name = (prof as any)?.display_name || "Quelqu'un";
            setRealtimeMembers(prev => [...prev, { id: memberId, name }]);
            toast.success(`${name} a rejoint la soirée !`);
          } else if (guestName) {
            setRealtimeMembers(prev => [...prev, { id: `guest-${Date.now()}`, name: guestName }]);
          }
        })
        .subscribe();

      setStep("who");
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
      try { await navigator.share({ title: "Soirée ciné Pick", text: "Rejoins ma soirée ciné ! 🍿", url: sessionInviteUrl }); } catch {}
    } else {
      navigator.clipboard.writeText(sessionInviteUrl);
      toast.success("Lien copié !");
    }
  };

  const handleCopyLink = () => {
    if (!sessionInviteUrl) return;
    navigator.clipboard.writeText(sessionInviteUrl);
    toast.success("Lien copié !");
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

  const addGuest = (guest: Guest) => {
    const totalOthers = selectedFriendIds.size + guests.length;
    if (totalOthers >= 5) { toast.info("Maximum 6 personnes"); return; }
    setGuests(prev => [...prev, guest]);
  };

  const removeGuest = (id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
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
      // Persist guests on the group session (best-effort)
      if (groupSessionId && guests.length > 0) {
        for (const g of guests) {
          try {
            await addGuestMember(groupSessionId, {
              name: g.name,
              age_range: g.age ? `${g.age}` : undefined,
              profile_text: g.gender || undefined,
              preferences: { favoriteGenres: g.favoriteGenres, gender: g.gender, age: g.age },
            });
          } catch { /* ignore */ }
        }
      }

      // Create a recommendation_session linked to the group
      let recoId = recoSessionId;
      try {
        recoId = await createRecommendationSession({
          audience_type: "group",
          decision_mode: "instant",
          group_session_id: groupSessionId,
          source: "group",
          filters_snapshot: { mediaType: mediaChoice, mood: skipMood ? null : mood },
        });
        setRecoSessionId(recoId);
      } catch (e) { console.warn("createRecommendationSession failed", e); }

      const memberIds = [user.id, ...selectedFriendIds];
      const guestProfiles = guests.map(g => ({
        name: g.name, age: g.age, gender: g.gender, favoriteGenres: g.favoriteGenres,
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
        if (recoId) {
          data.recommendations.forEach((rec: GroupRecommendation, idx: number) => {
            logRecommendationEvent({
              session_id: recoId,
              tmdb_id: rec.movie.id,
              title: rec.movie.title || rec.movie.name || "",
              rank_position: idx + 1,
              source: "group",
              context: { groupScore: rec.groupScore },
            }).catch(() => {});
          });
        }
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

  const handleSelectMovie = async (rec: GroupRecommendation) => {
    const meta = {
      title: rec.movie.title || rec.movie.name || "Sans titre",
      media_type: ((rec.movie as any).media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
      poster_path: rec.movie.poster_path ?? null,
      overview: rec.movie.overview ?? null,
      year: rec.movie.release_date ? parseInt(rec.movie.release_date.slice(0, 4)) : null,
      runtime: rec.movie.runtime ?? null,
      vote_average: rec.movie.vote_average ?? null,
      popularity: (rec.movie as any).popularity ?? null,
    };
    try {
      if (groupSessionId) await selectGroupSessionFilm(groupSessionId, rec.movie.id, meta);
      if (recoSessionId) await completeSession(recoSessionId, rec.movie.id, meta);
    } catch (e) { console.warn("complete group session failed", e); }
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
    else if (step === "who") { setStep("landing"); }
    else navigate(-1);
  };

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BrandHeader showBack onBack={goBack} />

      <AnimatePresence mode="wait">
        {step === "landing" && (
          <LandingStep onCreateSoiree={handleCreateSoiree} creating={creatingSession} />
        )}

        {step === "who" && !mediaStep && (
          <WhoStep
            friends={friends}
            selectedFriendIds={selectedFriendIds}
            guests={guests}
            sessionInviteCode={sessionInviteCode}
            sessionInviteUrl={sessionInviteUrl}
            realtimeMembers={realtimeMembers}
            onToggleFriend={toggleFriend}
            onAddGuest={addGuest}
            onRemoveGuest={removeGuest}
            onContinue={handleContinueFromWho}
            onShareSession={handleShareSession}
            onCopyLink={handleCopyLink}
            onNavigateToProfile={() => navigate("/app/profile")}
          />
        )}

        {step === "who" && mediaStep && (
          <MediaStep onSelect={handleMediaSelect} />
        )}

        {step === "mood" && (
          <MoodStep
            mood={mood}
            onSetMood={setMood}
            onStart={handleStartSearch}
            selectedCount={selectedCount}
            selectedFriends={selectedFriends}
          />
        )}

        {step === "loading" && (
          <LoadingStep message={loadingMsg} selectedFriends={selectedFriends} />
        )}

        {step === "results" && hero && (
          <ResultsStep
            hero={hero}
            alternatives={alternatives}
            selectedCount={selectedCount}
            heroReaction={heroReaction}
            onReject={handleReject}
            onSelectMovie={handleSelectMovie}
            onAddToWatchlist={handleAddToWatchlist}
            onRestart={() => {
              setRecommendations([]);
              setHeroReaction(null);
              setStep("who");
            }}
          />
        )}
      </AnimatePresence>

      
    </div>
  );
};

export default PickTogether;
