import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Send, Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import type { MovieDetail } from "@/lib/tmdb";

interface VoiceChatProps {
  onClose: () => void;
  onMovieSuggested: (movie: MovieDetail) => void;
  initialMessages?: ChatMessage[];
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_PROMPTS = [
  "Un film drôle sur Netflix ce soir",
  "Un thriller psychologique comme Gone Girl",
  "Un film scandinave sombre et lent",
  "Une comédie romantique des années 90",
  "Un film noir et blanc oscarisé",
  "Un documentaire sur la musique",
  "Un film d'animation japonais poétique",
  "Une série courte qu'on finit en un week-end",
  "Un film de science-fiction sous-estimé",
  "Je suis fatigué, un truc léger sans prise de tête",
  "On est deux, on sait pas quoi regarder",
  "Une série feel-good pour se vider la tête",
];

type Phase = "idle" | "listening" | "processing" | "recap";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef(false);
  const committedTextRef = useRef("");

  // Pick 3 random non-repeating examples
  const [randomExamples] = useState(() => {
    const shuffled = [...EXAMPLE_PROMPTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  });

  // Pre-fetch scribe token on mount
  useEffect(() => {
    supabase.functions.invoke("scribe-token").then(({ data }) => {
      if (data?.token) setScribeToken(data.token);
    }).catch(console.error);
  }, []);

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
      const messages: ChatMessage[] = initialMessages
        ? [...initialMessages, { role: "user" as const, content: text }]
        : [{ role: "user" as const, content: text }];

      const { data, error } = await supabase.functions.invoke("movie-chat", {
        body: { messages },
      });

      if (error) throw error;

      if (data?.movie) {
        const recap: string[] = data.recap || [];
        setRecapTags(recap);
        setPhase("recap");

        // Show recap for a moment, then transition to result
        setTimeout(() => {
          onMovieSuggested(data.movie as MovieDetail);
        }, recap.length > 0 ? 1800 : 800);
      } else if (data?.reply) {
        // AI asked a follow-up question — for now just close and let them retry
        // Could be enhanced later with multi-turn voice
        setPhase("idle");
      }
    } catch (e) {
      console.error("Chat error:", e);
      setPhase("idle");
    }
  }, [onMovieSuggested, initialMessages]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setInputText("");
    setPartialText("");
    await sendToAI(text.trim());
  }, [sendToAI]);

  const startListening = useCallback(async () => {
    setMicError(null);
    try {
      // CRITICAL: Request mic permission FIRST, directly in click handler
      // Safari/iOS requires getUserMedia in the immediate user gesture chain
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true } 
        });
      } catch (micErr: any) {
        console.error("Mic permission error:", micErr);
        if (micErr?.name === "NotAllowedError" || micErr?.name === "PermissionDeniedError") {
          setMicError("Accès au micro refusé. Autorise le micro dans les paramètres de ton navigateur.");
        } else if (micErr?.name === "NotFoundError") {
          setMicError("Aucun micro détecté sur cet appareil.");
        } else {
          setMicError("Impossible d'accéder au micro. Tape ton message ci-dessous 👇");
        }
        inputRef.current?.focus();
        return;
      }

      // Stop the stream we used for permission - scribe will create its own
      stream.getTracks().forEach(t => t.stop());

      // Now fetch token (always get a fresh one to avoid expiry issues)
      let token = scribeToken;
      try {
        const { data } = await supabase.functions.invoke("scribe-token");
        if (data?.token) {
          token = data.token;
          setScribeToken(data.token);
        }
      } catch (tokenErr) {
        console.error("Token fetch error:", tokenErr);
      }

      if (!token) {
        setMicError("Erreur de connexion. Tape ton message ci-dessous 👇");
        inputRef.current?.focus();
        return;
      }

      // Connect scribe with the token
      await scribe.connect({
        token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      setPhase("listening");
    } catch (e: any) {
      console.error("Start listening error:", e);
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
              <button
                type="button"
                onClick={startListening}
                className="w-28 h-28 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-6 transition-all duration-200 active:scale-95 active:bg-primary/20 cursor-pointer select-none hover:bg-primary/15 hover:border-primary/40"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <Mic className="w-12 h-12 text-primary pointer-events-none" />
              </button>

              <h2 className="text-foreground text-lg font-serif mb-2">
                Dis-moi ce que tu veux regarder
              </h2>
              <p className="text-muted-foreground text-sm font-sans mb-6">
                Appuie et parle naturellement
              </p>

              <div className="flex flex-col gap-2.5 w-full max-w-xs">
                {randomExamples.map((example, i) => (
                  <motion.button
                    key={example}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    onClick={() => handleSend(example)}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-primary/5 border border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-all cursor-pointer text-left"
                  >
                    <Mic className="w-3 h-3 text-primary/50 flex-shrink-0" />
                    <span className="text-foreground/50 text-xs font-sans">
                      « {example} »
                    </span>
                  </motion.button>
                ))}
              </div>

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
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0px hsl(var(--primary) / 0.3)",
                    "0 0 0 24px hsl(var(--primary) / 0)",
                    "0 0 0 0px hsl(var(--primary) / 0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-6 rounded-full"
              >
                <button
                  type="button"
                  onClick={stopListening}
                  className="w-28 h-28 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <MicOff className="w-12 h-12 text-primary pointer-events-none" />
                </button>
              </motion.div>

              <SoundWave />

              {partialText ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-foreground/70 text-sm font-sans mt-5 max-w-xs italic"
                >
                  « {partialText}… »
                </motion.p>
              ) : (
                <>
                  <p className="text-primary text-sm font-sans mt-5 font-medium">
                    Je t'écoute…
                  </p>
                  <p className="text-muted-foreground text-xs font-sans mt-1">
                    Appuie pour arrêter
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* PROCESSING — Analyzing animation */}
          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary flex items-center justify-center mb-6"
              />

              {userText && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-foreground/60 text-sm font-sans italic mb-4 max-w-xs"
                >
                  « {userText} »
                </motion.p>
              )}

              <p className="text-primary text-sm font-sans font-medium">
                Analyse en cours…
              </p>
              <p className="text-muted-foreground text-xs font-sans mt-1">
                Je cherche le match parfait
              </p>
            </motion.div>
          )}

          {/* RECAP — Show understood criteria */}
          {phase === "recap" && (
            <motion.div
              key="recap"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-5"
              >
                <Sparkles className="w-7 h-7 text-primary" />
              </motion.div>

              <p className="text-foreground text-base font-serif mb-4">
                J'ai compris ce que tu cherches
              </p>

              <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-xs">
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
        </AnimatePresence>
      </div>

      {/* Bottom text input (always visible for fallback) */}
      {(phase === "idle" || phase === "listening") && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 border-t border-border/10 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2 bg-background/80 backdrop-blur-md"
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
      )}
    </motion.div>
  );
};

export default VoiceChat;
