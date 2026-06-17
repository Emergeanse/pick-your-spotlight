import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import BrandHeader from "@/components/pick/BrandHeader";

import type { MovieDetail } from "@/lib/tmdb";
import { addToWatchlist } from "@/lib/watchlist";
import {
  createGroupSession,
  addGuestMember,
  selectGroupSessionFilm,
  setSessionContext,
  updateGroupSessionStatus,
  listMembers,
} from "@/lib/group-sessions";
import {
  createRecommendationSession,
  logRecommendationEvent,
  completeSession,
} from "@/lib/sessions";
import { parsePickPrompt, type ParsedPickPrompt } from "@/lib/parse-prompt";

import LandingStep from "@/components/pick/together/LandingStep";
import PromptStep, { type QuickGuest } from "@/components/pick/together/PromptStep";
import ReformulationStep from "@/components/pick/together/ReformulationStep";
import ClarifyStep from "@/components/pick/together/ClarifyStep";
import LoadingStep from "@/components/pick/together/LoadingStep";
import ResultsStep, { type GroupRecommendation } from "@/components/pick/together/ResultsStep";
import DecisionStep from "@/components/pick/together/DecisionStep";

type FlowStep =
  | "landing"
  | "prompt"
  | "reformulate"
  | "clarify"
  | "loading"
  | "results"
  | "decision";

const LOADING_MESSAGES = [
  "Pick croise vos envies…",
  "On cherche le bon compromis…",
  "Presque, je peaufine la sélection…",
];

const PickTogether = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeSessionId = searchParams.get("session");

  const [step, setStep] = useState<FlowStep>("landing");
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);
  const [recoSessionId, setRecoSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [guests, setGuests] = useState<QuickGuest[]>([]);
  const [parsed, setParsed] = useState<ParsedPickPrompt | null>(null);
  const [parseLoading, setParseLoading] = useState(false);

  const [loadingMsg, setLoadingMsg] = useState("");
  const [recommendations, setRecommendations] = useState<GroupRecommendation[]>([]);
  const [heroReaction, setHeroReaction] = useState<"like" | "meh" | "reject" | null>(null);
  const [chosen, setChosen] = useState<GroupRecommendation | null>(null);

  // Resume an existing session via ?session=
  useEffect(() => {
    if (!user || !resumeSessionId || groupSessionId) return;
    (async () => {
      try {
        const { data: session, error } = await supabase
          .from("group_sessions")
          .select("id, status, context_json")
          .eq("id", resumeSessionId)
          .maybeSingle();
        if (error || !session) return;
        setGroupSessionId(session.id as string);
        const ctx = ((session as any).context_json ?? {}) as any;
        if (ctx.prompt) setPrompt(ctx.prompt as string);
        if (ctx.parsed) setParsed(ctx.parsed as ParsedPickPrompt);
        // Hydrate guests from members table
        try {
          const members = await listMembers(session.id as string);
          const guestMembers = (members as any[]).filter((m) => !m.user_id && m.guest_name);
          if (guestMembers.length > 0) {
            setGuests(
              guestMembers.map((m: any) => ({
                id: m.id,
                name: m.guest_name,
                hint: (m.guest_preferences_json?.favoriteGenres ?? [])[0],
              }))
            );
          }
        } catch { /* ignore */ }
        setStep(ctx.parsed ? "reformulate" : "prompt");
      } catch (e) {
        console.warn("Failed to resume group session", e);
      }
    })();
  }, [user, resumeSessionId, groupSessionId]);

  const ensureGroupSession = async (): Promise<string> => {
    if (groupSessionId) return groupSessionId;
    const session = await createGroupSession({
      title: "Soirée ciné",
      decision_mode: "instant",
    });
    const sid = (session as any).id as string;
    setGroupSessionId(sid);
    await updateGroupSessionStatus(sid, "draft");
    return sid;
  };

  const handleStart = async () => {
    if (!user) return;
    setCreatingSession(true);
    try {
      await ensureGroupSession();
      setStep("prompt");
    } catch (e) {
      console.error(e);
      toast.error("Impossible de démarrer la soirée");
    } finally {
      setCreatingSession(false);
    }
  };

  const handlePromptSubmit = async (text: string, quickGuests: QuickGuest[]) => {
    if (!user) return;
    setPrompt(text);
    setGuests(quickGuests);
    setParseLoading(true);
    try {
      const sid = await ensureGroupSession();
      const result = await parsePickPrompt(text);
      if (!result) {
        toast.error("Pick n'a pas compris, reformule en quelques mots ?");
        setParseLoading(false);
        return;
      }
      setParsed(result);
      await setSessionContext(sid, {
        prompt: text,
        sessionWish: result.sessionWish,
        parsed: result,
      });
      await updateGroupSessionStatus(sid, "collecting_preferences");
      // Persist guests as session-only members
      for (const g of quickGuests) {
        try {
          await addGuestMember(sid, {
            name: g.name,
            preferences: g.hint ? { favoriteGenres: [g.hint] } : {},
          });
        } catch { /* ignore */ }
      }
      if (result.blocking) {
        setStep("clarify");
      } else {
        setStep("reformulate");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur en analysant ton envie");
    } finally {
      setParseLoading(false);
    }
  };

  const handleClarifyAnswer = async (answer: string) => {
    // Re-parse with appended clarification
    const merged = `${prompt}. ${answer}`;
    setPrompt(merged);
    setParseLoading(true);
    try {
      const result = await parsePickPrompt(merged);
      if (!result) {
        toast.error("Pick n'a pas compris");
        return;
      }
      setParsed(result);
      if (groupSessionId) {
        await setSessionContext(groupSessionId, {
          prompt: merged,
          sessionWish: result.sessionWish,
          parsed: result,
        });
      }
      setStep("reformulate");
    } finally {
      setParseLoading(false);
    }
  };

  const handleConfirmAndSearch = async () => {
    if (!user || !parsed) return;
    setStep("loading");
    setLoadingMsg(LOADING_MESSAGES[0]);
    let i = 0;
    const tick = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 2200);

    try {
      const sid = await ensureGroupSession();
      // Create reco session for tracking
      let recoId = recoSessionId;
      try {
        recoId = await createRecommendationSession({
          audience_type: "group",
          decision_mode: "instant",
          group_session_id: sid,
          source: "group_now",
          prompt_text: prompt,
          filters_snapshot: {
            mediaType: parsed.mediaType,
            sessionWish: parsed.sessionWish,
            participantHints: parsed.participantHints,
          },
        });
        setRecoSessionId(recoId);
      } catch (e) { console.warn("createRecommendationSession failed", e); }

      const { data, error } = await supabase.functions.invoke("group-recommend", {
        body: {
          memberIds: [user.id],
          guests: guests.map((g) => ({ name: g.name, hint: g.hint })),
          mediaType: parsed.mediaType,
          mood: parsed.sessionWish.mood,
          sessionWish: parsed.sessionWish,
          participantHints: parsed.participantHints,
          audience: "group_now",
        },
      });
      clearInterval(tick);
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
              source: "group_now",
              context: { groupScore: rec.groupScore, reasonType: (rec as any).reasonType },
            }).catch(() => {});
          });
        }
        await updateGroupSessionStatus(sid, "ready");
        setStep("results");
      } else {
        toast.error("Aucune recommandation trouvée");
        setStep("reformulate");
      }
    } catch (e: any) {
      clearInterval(tick);
      const msg = e?.message || "";
      if (msg.includes("429")) toast.error("Trop de requêtes, réessaie dans un instant.");
      else if (msg.includes("402")) toast.error("Crédits IA épuisés.");
      else toast.error("Erreur lors de la recherche");
      setStep("reformulate");
    }
  };

  const handleReject = () => {
    setHeroReaction("reject");
    setTimeout(() => {
      setHeroReaction(null);
      setRecommendations([]);
      handleConfirmAndSearch();
    }, 600);
  };

  const handleSelectMovie = async (rec: GroupRecommendation) => {
    setChosen(rec);
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
      if (groupSessionId) {
        await selectGroupSessionFilm(groupSessionId, rec.movie.id, meta);
        await updateGroupSessionStatus(groupSessionId, "completed");
      }
      if (recoSessionId) await completeSession(recoSessionId, rec.movie.id, meta);
    } catch (e) { console.warn("complete group session failed", e); }
    setStep("decision");
  };

  const handleLaunch = () => {
    if (!chosen) return;
    sessionStorage.setItem("pick-fab-movie", JSON.stringify(chosen.movie));
    navigate("/app?from=pick-chat");
  };

  const handleAddToWatchlist = async (movie: MovieDetail) => {
    if (!user) return;
    try {
      await addToWatchlist(movie);
      toast.success("Ajouté à ta watclhist !");
    } catch { toast.error("Erreur"); }
  };

  const goBack = () => {
    if (step === "decision") setStep("results");
    else if (step === "results") { setStep("reformulate"); setRecommendations([]); setHeroReaction(null); }
    else if (step === "clarify" || step === "reformulate") setStep("prompt");
    else if (step === "prompt") setStep("landing");
    else navigate(-1);
  };

  const participantNames = [
    user?.user_metadata?.display_name || "Toi",
    ...guests.map((g) => g.name),
  ];

  const hero = recommendations[0];
  const alternatives = recommendations.slice(1, 5);

  return (
    <div className="fixed inset-0 bg-background overflow-x-hidden overflow-y-auto">
      <BrandHeader showBack onBack={goBack} />

      <AnimatePresence mode="wait">
        {step === "landing" && (
          <LandingStep onCreateSoiree={handleStart} creating={creatingSession} />
        )}

        {step === "prompt" && (
          <PromptStep
            initialPrompt={prompt}
            initialGuests={guests}
            loading={parseLoading}
            onSubmit={handlePromptSubmit}
          />
        )}

        {step === "reformulate" && parsed && (
          <ReformulationStep
            parsed={parsed}
            loading={parseLoading}
            onConfirm={handleConfirmAndSearch}
            onEdit={() => setStep("prompt")}
          />
        )}

        {step === "clarify" && (
          <ClarifyStep
            question={parsed?.blocking || "Pick a besoin d'une précision."}
            onAnswer={handleClarifyAnswer}
            onSkip={() => setStep("reformulate")}
          />
        )}

        {step === "loading" && (
          <LoadingStep message={loadingMsg} selectedFriends={[]} />
        )}

        {step === "results" && hero && (
          <ResultsStep
            hero={hero}
            alternatives={alternatives}
            selectedCount={participantNames.length}
            heroReaction={heroReaction}
            sessionId={recoSessionId}
            onReject={handleReject}
            onSelectMovie={handleSelectMovie}
            onAddToWatchlist={handleAddToWatchlist}
            onRestart={() => {
              setRecommendations([]);
              setHeroReaction(null);
              setStep("prompt");
            }}
          />
        )}

        {step === "decision" && chosen && (
          <DecisionStep
            movie={chosen.movie}
            participantNames={participantNames}
            onLaunch={handleLaunch}
            onChangeMind={() => setStep("results")}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PickTogether;
