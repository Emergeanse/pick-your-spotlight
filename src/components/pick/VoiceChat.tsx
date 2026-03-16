import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Send, Loader2, Sparkles, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { useAuth } from "@/hooks/use-auth";
import { getLikedMovies } from "@/lib/liked-movies";
import type { MovieDetail } from "@/lib/tmdb";
import PickCharacter from "./PickCharacter";

interface VoiceChatProps {
  onClose: () => void;
  onMovieSuggested: (movie: MovieDetail, recapTags?: string[]) => void;
  initialMessages?: ChatMessage[];
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};


// Contextual suggestion chips based on time of day, day of week, and behavior
function getContextualSuggestions(): { label: string; message: string }[] {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 5 || day === 6;
  const isEvening = hour >= 18 || hour < 2;
  const isLateNight = hour >= 22 || hour < 2;

  const suggestions: { label: string; message: string; weight: number }[] = [];

  // Time-based
  if (isLateNight) {
    suggestions.push(
      { label: "Un film court ce soir", message: "Propose-moi un film court, il est tard et j'ai pas beaucoup de temps", weight: 10 },
      { label: "Quelque chose de doux", message: "Je veux un truc doux et réconfortant pour finir la soirée", weight: 8 },
    );
  } else if (isEvening) {
    suggestions.push(
      { label: "Soirée détente", message: "Je veux un film feel-good pour me détendre ce soir", weight: 9 },
      { label: "Un film qui surprend", message: "Surprends-moi avec un film que je n'aurais jamais choisi tout seul", weight: 7 },
    );
  } else {
    suggestions.push(
      { label: "Un classique", message: "Propose-moi un classique incontournable que je devrais voir", weight: 6 },
      { label: "Un film léger", message: "Je veux un film léger et facile à regarder", weight: 7 },
    );
  }

  // Weekend = more ambitious
  if (isWeekend) {
    suggestions.push(
      { label: "Un chef-d'œuvre", message: "J'ai du temps, propose-moi un chef-d'œuvre ambitieux", weight: 9 },
      { label: "Marathon série", message: "Je veux commencer une série captivante ce weekend", weight: 8 },
    );
  } else {
    suggestions.push(
      { label: "Épisode rapide", message: "Propose-moi un épisode de série à regarder vite fait", weight: 6 },
    );
  }

  // Generic always-relevant
  suggestions.push(
    { label: "Comme la dernière fois", message: "Propose-moi quelque chose dans le même style que ma dernière recommandation", weight: 5 },
    { label: "Hors de ma zone", message: "Fais-moi sortir de ma zone de confort avec un film inattendu", weight: 4 },
  );

  // Sort by weight, pick top 3
  return suggestions.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

type Phase = "idle" | "listening" | "processing" | "recap" | "conversation";

// Sound wave bars animation
const SoundWave = () => (
  <div className="flex items-center gap-[3px] h-8">
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-full bg-primary"
        animate={{ height: [8, 24, 12, 28, 8] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
      />
    ))}
  </div>
);

const VoiceChat = ({ onClose, onMovieSuggested, initialMessages }: VoiceChatProps) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userText, setUserText] = useState("");
  const [recapTags, setRecapTags] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");
  const [scribeToken, setScribeToken] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [pickReply, setPickReply] = useState("");
  const [userTasteContext, setUserTasteContext] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef(false);
  const committedTextRef = useRef("");
  const { user } = useAuth();

  // Pre-fetch scribe token and user taste context on mount
  useEffect(() => {
    supabase.functions.invoke("scribe-token").then(({ data }) => {
      if (data?.token) setScribeToken(data.token);
    }).catch(console.error);

    // Fetch user taste context for personalized conversations
    if (user) {
      Promise.all([
        getLikedMovies(),
        supabase.from("profiles").select("favorite_genres, excluded_genres").eq("id", user.id).single(),
      ]).then(([likedMovies, { data: profile }]) => {
        setUserTasteContext({
          likedMovies: likedMovies?.map((m: any) => ({ title: m.title, genres: m.genres })) || [],
          favoriteGenres: profile?.favorite_genres || [],
          excludedGenres: profile?.excluded_genres || [],
        });
      }).catch(console.error);
    }
  }, [user]);

  // ElevenLabs Scribe for cross-browser STT
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        committedTextRef.current = data.text.trim();
        setPartialText("");
        pendingSendRef.current = true;
      }
    },
  });

  // Handle auto-send when committed text arrives
  useEffect(() => {
    if (pendingSendRef.current && committedTextRef.current) {
      pendingSendRef.current = false;
      const text = committedTextRef.current;
      committedTextRef.current = "";
      stopListening();
      handleSend(text);
    }
  }, [partialText]);

  const sendToAI = useCallback(async (text: string) => {
    setPhase("processing");
    setUserText(text);

    try {
      // Build full conversation history
      const newUserMsg: ChatMessage = { role: "user", content: text };
      const fullHistory = [...conversationHistory, newUserMsg];
      
      const messages: ChatMessage[] = initialMessages
        ? [...initialMessages, ...fullHistory]
        : fullHistory;

      const { data, error } = await supabase.functions.invoke("movie-chat", {
        body: { messages, userTasteContext },
      });

      if (error) throw error;

      if (data?.movie) {
        const recap: string[] = data.recap || [];
        setRecapTags(recap);
        setConversationHistory(fullHistory);
        setPhase("recap");

        setTimeout(() => {
          onMovieSuggested(data.movie as MovieDetail, recap);
        }, recap.length > 0 ? 1800 : 800);
      } else if (data?.reply) {
        // Pick asked a follow-up question — show it and let user respond
        const assistantMsg: ChatMessage = { role: "assistant", content: data.reply };
        setConversationHistory([...fullHistory, assistantMsg]);
        setPickReply(data.reply);
        setPhase("conversation");
      }
    } catch (e) {
      console.error("Chat error:", e);
      setPhase("idle");
    }
  }, [onMovieSuggested, initialMessages, conversationHistory, userTasteContext]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setInputText("");
    setPartialText("");
    await sendToAI(text.trim());
  }, [sendToAI]);

  const startListening = useCallback(async () => {
    setMicError(null);
    console.log("[VoiceChat] startListening called");
    try {
      // CRITICAL: Request mic permission FIRST, directly in click handler
      // Safari/iOS & Android require getUserMedia in the immediate user gesture chain
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true } 
        });
        console.log("[VoiceChat] Mic permission granted, tracks:", stream.getAudioTracks().length);
      } catch (micErr: any) {
        console.error("[VoiceChat] Mic permission error:", micErr?.name, micErr?.message);
        if (micErr?.name === "NotAllowedError" || micErr?.name === "PermissionDeniedError") {
          setMicError("Accès au micro refusé. Autorise le micro dans les paramètres de ton navigateur.");
        } else if (micErr?.name === "NotFoundError" || micErr?.name === "NotReadableError") {
          setMicError("Aucun micro détecté ou micro déjà utilisé par une autre app.");
        } else if (micErr?.name === "AbortError") {
          setMicError("La demande de micro a été interrompue. Réessaie.");
        } else {
          setMicError("Impossible d'accéder au micro. Tape ton message ci-dessous 👇");
        }
        inputRef.current?.focus();
        return;
      }

      // Keep the stream alive briefly - some Android browsers need time between
      // releasing one mic stream and acquiring another
      // We'll stop it after a small delay to not block scribe
      const stopStreamLater = () => {
        setTimeout(() => {
          stream.getTracks().forEach(t => t.stop());
          console.log("[VoiceChat] Permission stream stopped");
        }, 500);
      };

      // Fetch a fresh token every time (tokens are single-use and expire)
      console.log("[VoiceChat] Fetching scribe token...");
      let token: string | null = null;
      try {
        const { data, error } = await supabase.functions.invoke("scribe-token");
        if (error) console.error("[VoiceChat] Token fetch error:", error);
        if (data?.token) {
          token = data.token;
          setScribeToken(data.token);
          console.log("[VoiceChat] Token received");
        }
      } catch (tokenErr) {
        console.error("[VoiceChat] Token fetch exception:", tokenErr);
      }

      if (!token) {
        stopStreamLater();
        setMicError("Erreur de connexion vocale. Tape ton message ci-dessous 👇");
        inputRef.current?.focus();
        return;
      }

      // Connect scribe with a timeout to catch silent failures
      console.log("[VoiceChat] Connecting scribe...");
      const connectPromise = scribe.connect({
        token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 8000)
      );

      try {
        await Promise.race([connectPromise, timeoutPromise]);
        console.log("[VoiceChat] Scribe connected successfully");
        setPhase("listening");
      } catch (connectErr: any) {
        console.error("[VoiceChat] Scribe connect failed:", connectErr?.message);
        setMicError("La connexion vocale a échoué. Tape ton message ci-dessous 👇");
        inputRef.current?.focus();
      }

      stopStreamLater();
    } catch (e: any) {
      console.error("[VoiceChat] startListening unexpected error:", e?.name, e?.message);
      setMicError("Erreur micro. Tape ton message ci-dessous 👇");
      inputRef.current?.focus();
    }
  }, [scribe, scribeToken]);

  // Auto-start listening when opened with initial messages (from "Affiner" button)
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && scribeToken) {
      const timer = setTimeout(() => startListening(), 300);
      return () => clearTimeout(timer);
    }
  }, [initialMessages, scribeToken, startListening]);

  const stopListening = useCallback(() => {
    scribe.disconnect();
    if (phase === "listening") setPhase("idle");
    setPartialText("");
  }, [scribe, phase]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col"
    >
      {/* Full-screen backdrop */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-2xl" />

      {/* Close button */}
      <div className="relative z-10 flex justify-end p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {/* IDLE — Big mic + examples */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              {/* Pick as the guide */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <PickCharacter mood="wave" message="Salut ! Dis-moi comment tu te sens, je m'occupe du reste 😊" size="md" />
              </motion.div>

              {/* Mic button */}
              <button
                type="button"
                onClick={startListening}
                className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-6 transition-all duration-200 active:scale-95 active:bg-primary/20 cursor-pointer select-none hover:bg-primary/15 hover:border-primary/40"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <Mic className="w-10 h-10 text-primary pointer-events-none" />
              </button>

              <p className="text-muted-foreground text-xs font-sans mb-6">
                Appuie et parle naturellement
              </p>

              {micError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-sans text-center max-w-xs"
                >
                  {micError}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* LISTENING — Pulsing mic + sound wave */}
          {phase === "listening" && (
            <motion.div
              key="listening"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              {/* Pick listening */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-5"
              >
                <PickCharacter
                  mood="default"
                  message={partialText ? `« ${partialText}… »` : "Je t'écoute…"}
                  size="sm"
                  animate={false}
                />
              </motion.div>

              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0px hsl(var(--primary) / 0.3)",
                    "0 0 0 24px hsl(var(--primary) / 0)",
                    "0 0 0 0px hsl(var(--primary) / 0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-5 rounded-full"
              >
                <button
                  type="button"
                  onClick={stopListening}
                  className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <MicOff className="w-10 h-10 text-primary pointer-events-none" />
                </button>
              </motion.div>

              <SoundWave />

              <p className="text-muted-foreground text-xs font-sans mt-3">
                Appuie pour arrêter
              </p>
            </motion.div>
          )}

          {/* PROCESSING — Pick is thinking */}
          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              <PickCharacter mood="think" message="Attends, j'ai un truc en tête…" size="md" animate={false} />

              {userText && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-foreground/40 text-sm font-sans italic mt-5 max-w-xs"
                >
                  « {userText} »
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4"
              >
                <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
              </motion.div>
            </motion.div>
          )}

          {/* RECAP — Pick understood */}
          {phase === "recap" && (
            <motion.div
              key="recap"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              <PickCharacter mood="default" message="OK, je vois exactement ce qu'il te faut." size="md" animate={false} />

              <div className="flex flex-wrap gap-2 justify-center mt-5 mb-6 max-w-xs">
                {recapTags.map((tag, i) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 300 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-sans font-medium"
                  >
                    <Check className="w-3 h-3" />
                    {tag}
                  </motion.span>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
                <span className="text-muted-foreground text-xs font-sans">
                  Suggestion en approche…
                </span>
              </motion.div>
            </motion.div>
          )}

          {/* CONVERSATION — Pick asked a follow-up question */}
          {phase === "conversation" && (
            <motion.div
              key="conversation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              <PickCharacter mood="default" message={pickReply} size="md" animate={false} />

              {/* Mic button to reply by voice */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                type="button"
                onClick={startListening}
                className="mt-6 w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer hover:bg-primary/15 hover:border-primary/40"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <Mic className="w-7 h-7 text-primary pointer-events-none" />
              </motion.button>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-muted-foreground text-xs font-sans mt-3"
              >
                Réponds par la voix ou en tapant ci-dessous
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom area: suggestion chips + text input */}
      {(phase === "idle" || phase === "listening" || phase === "conversation") && (
        <div className="relative z-10 bg-background/80 backdrop-blur-md">
          {/* Contextual suggestion chips — only in idle phase */}
          {phase === "idle" && !initialMessages && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="px-5 pt-2 pb-1"
            >
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {getContextualSuggestions().map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleSend(chip.message)}
                    className="flex-shrink-0 px-3.5 py-2 rounded-full bg-primary/8 border border-primary/20 text-primary/80 text-[12px] font-sans font-medium hover:bg-primary/15 hover:border-primary/30 hover:text-primary transition-all active:scale-[0.96]"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Text input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-border/10 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ou tape ta demande ici…"
              className="flex-1 bg-secondary/50 border border-border/20 rounded-full px-4 py-2.5 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim()}
              className="rounded-full text-primary hover:bg-primary/10 disabled:opacity-30"
            >
              <Send className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default VoiceChat;
