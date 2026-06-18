import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { useAuth } from "@/hooks/use-auth";
import { getLikedMovies } from "@/lib/liked-movies";
import { getUserTasteProfile } from "@/lib/interactions";
import { getMyPreferences } from "@/lib/preferences";
import type { VoiceSearchFilters } from "./VoiceChat";

// Bug 2 fix : ajout de la phase "clarification" pour les questions de Pick
type Phase = "ready" | "recording" | "processing" | "recap" | "clarification";

const RECORDING_TIMEOUT_MS = 30_000; // Bug 3 fix : timeout 30s

interface MoodVoiceSheetProps {
  onClose: () => void;
  onSearchIntent: (filters: VoiceSearchFilters, recap: string[]) => void;
  autoStart?: boolean;
}

const MoodVoiceSheet = ({ onClose, onSearchIntent, autoStart }: MoodVoiceSheetProps) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("ready");
  const [partialText, setPartialText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recapTags, setRecapTags] = useState<string[]>([]);
  const [clarificationText, setClarificationText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [userTasteContext, setUserTasteContext] = useState<any>(null);
  const pendingVoiceRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load taste context for pick-chat
  useEffect(() => {
    if (!user) return;
    Promise.all([getLikedMovies(), getUserTasteProfile(), getMyPreferences()])
      .then(([liked, tasteProfile, prefs]) => {
        setUserTasteContext({
          minRating: (prefs as any)?.min_rating ?? 0,
          excludedGenres: (prefs as any)?.excluded_genres ?? [],
          tasteClusters: (tasteProfile as any)?.tasteClusters ?? [],
          rejectedClusters: (tasteProfile as any)?.rejectedClusters ?? [],
          likedMovieTitles: liked.slice(0, 10).map((m: any) => m.title).filter(Boolean),
          likedOrigins: [],
          excludedOrigins: (prefs as any)?.excluded_languages ?? [],
          confidence: (tasteProfile as any)?.confidence?.score ?? 50,
        });
      })
      .catch(console.error);
  }, [user]);

  // Auto-démarre l'enregistrement si demandé par le parent
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      startRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Bug 3 fix : timeout enregistrement 30s
  useEffect(() => {
    if (phase === "recording") {
      recordingTimerRef.current = setTimeout(() => {
        scribe.disconnect();
        setPhase("ready");
        setMicError("Aucune parole détectée. Réessaie !");
      }, RECORDING_TIMEOUT_MS);
    }
    return () => {
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [phase]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setMicError(null);
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        const finalText = data.text.trim();
        setTranscript(finalText);
        setPartialText("");
        scribe.disconnect();
        pendingVoiceRef.current = finalText;
        setPhase("processing");
      }
    },
  });

  // Send to pick-chat once transcript is ready
  useEffect(() => {
    if (phase !== "processing" || !pendingVoiceRef.current) return;
    const text = pendingVoiceRef.current;
    pendingVoiceRef.current = null;

    const now = new Date();
    const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const hour = now.getHours();
    const periodLabel =
      hour >= 5 && hour < 12 ? "le matin"
      : hour >= 12 && hour < 17 ? "l'après-midi"
      : hour >= 17 && hour < 22 ? "en soirée"
      : "tard dans la nuit";
    const timeContext = `Nous sommes ${dayNames[now.getDay()]}, il est ${hour}h (${periodLabel}).`;

    supabase.functions
      .invoke("pick-chat", {
        body: {
          messages: [{ role: "user", content: text }],
          mode: "discovery",
          voiceMode: true,
          isPremium: true,
          minRating: userTasteContext?.minRating ?? 0,
          excludedGenres: userTasteContext?.excludedGenres ?? [],
          tasteClusters: userTasteContext?.tasteClusters ?? [],
          rejectedClusters: userTasteContext?.rejectedClusters ?? [],
          likedMovieTitles: userTasteContext?.likedMovieTitles ?? [],
          likedOrigins: userTasteContext?.likedOrigins ?? [],
          excludedOrigins: userTasteContext?.excludedOrigins ?? [],
          confidence: userTasteContext?.confidence ?? 50,
          timeContext,
          userName: user?.user_metadata?.display_name || user?.email?.split("@")[0] || null,
        },
      })
      .then(({ data, error }) => {
        if (error || !data) {
          setPhase("ready");
          setMicError("Erreur de connexion. Réessaie !");
          return;
        }
        if (data.type === "search_intent") {
          const recap: string[] = data.recap || [];
          setRecapTags(recap);
          setPhase("recap");
          setTimeout(() => {
            onSearchIntent(data.filters as VoiceSearchFilters, recap);
            onClose();
          }, recap.length > 0 ? 1400 : 500);
        } else if (data.reply) {
          // Bug 2 fix : Pick demande une précision — on l'affiche au lieu de fermer
          setClarificationText(data.reply);
          setPhase("clarification");
        } else {
          setPhase("ready");
          setMicError("Je n'ai pas compris. Réessaie !");
        }
      })
      .catch(() => {
        setPhase("ready");
        setMicError("Erreur réseau. Réessaie !");
      });
  }, [phase]);

  // Bug 1 fix : utilise { token } comme VoiceChat, pas { signedUrl }
  const startRecording = async () => {
    setMicError(null);
    setTranscript("");
    setClarificationText("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke("scribe-token");
      if (error || !data?.token) {
        setMicError("Erreur de connexion vocale. Réessaie !");
        return;
      }
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      setPhase("recording");
    } catch {
      setMicError("Impossible d'accéder au micro. Vérifie les permissions.");
    }
  };

  const displayText = transcript || partialText;

  const phaseLabel: Record<Phase, string> = {
    ready: "Dis-moi ce que tu as envie de voir",
    recording: "Je t'écoute… parle naturellement",
    processing: "Je cherche les bons films…",
    recap: "C'est parti !",
    clarification: "Pick a besoin d'un peu plus",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-end"
    >
      <motion.div
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
        onClick={phase === "ready" ? onClose : undefined}
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-lg rounded-t-3xl bg-card border-t border-border/20 pb-[calc(2.5rem+env(safe-area-inset-bottom))] px-6 pt-5"
      >
        <div className="w-10 h-1 rounded-full bg-foreground/15 mx-auto mb-5" />

        {(phase === "ready" || phase === "clarification") && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-foreground/8 flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-4 h-4 text-foreground/50" />
          </button>
        )}

        <h2 className="font-serif text-xl text-center mb-1">Décris ton mood</h2>
        <p className="text-foreground/45 text-sm font-sans text-center mb-6">
          {phaseLabel[phase]}
        </p>

        {/* Erreur micro */}
        <AnimatePresence>
          {micError && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-rose-400 text-xs font-sans text-center mb-4"
            >
              {micError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Transcript */}
        <AnimatePresence>
          {displayText && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3 rounded-xl bg-foreground/5 border border-border/10"
            >
              <p className="text-sm font-sans text-foreground/70 italic leading-relaxed">
                « {displayText} »
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bug 2 fix : message de clarification de Pick */}
        <AnimatePresence>
          {phase === "clarification" && clarificationText && (
            <motion.div
              key="clarification"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-xl bg-primary/[0.06] border border-primary/20"
            >
              <p className="text-sm font-sans text-foreground/75 leading-relaxed">
                {clarificationText}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recap tags */}
        <AnimatePresence>
          {recapTags.length > 0 && (
            <motion.div
              key="recap"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 justify-center mb-5"
            >
              {recapTags.map((tag, i) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-sans font-medium"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {tag}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic / state button */}
        <div className="flex justify-center mt-2">
          {(phase === "ready" || phase === "clarification") && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={startRecording}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-primary text-primary-foreground font-sans font-medium text-sm shadow-[0_0_32px_hsl(var(--primary)/0.55)]"
            >
              {phase === "clarification" ? (
                <><RotateCcw className="w-4 h-4" /> Répondre</>
              ) : (
                <><Mic className="w-5 h-5" /> Parler</>
              )}
            </motion.button>
          )}

          {phase === "recording" && (
            <motion.div
              animate={{ scale: [1, 1.12, 1], boxShadow: ["0 0 24px rgba(239,68,68,0.4)", "0 0 40px rgba(239,68,68,0.7)", "0 0 24px rgba(239,68,68,0.4)"] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center"
            >
              <Mic className="w-7 h-7 text-white" />
            </motion.div>
          )}

          {(phase === "processing" || phase === "recap") && (
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          )}
        </div>

        {/* Bug 3 : indicateur timeout */}
        {phase === "recording" && (
          <p className="text-center text-foreground/45 text-[10px] font-sans mt-4">
            S'arrête automatiquement après 30s
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default MoodVoiceSheet;
