import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Send, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import type { MovieDetail } from "@/lib/tmdb";
import ReactMarkdown from "react-markdown";

interface VoiceChatProps {
  onClose: () => void;
  onMovieSuggested: (movie: MovieDetail) => void;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_PROMPTS = [
  "Un film drôle sur Netflix",
  "Un thriller court ce soir",
  "Un film triste comme Interstellar",
  "Un film pour regarder avec ma copine",
  "Un film d'action de moins de 2h",
];

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

const VoiceChat = ({ onClose, onMovieSuggested }: VoiceChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [detectedFilters, setDetectedFilters] = useState<string[] | null>(null);
  const [partialText, setPartialText] = useState("");
  const [scribeToken, setScribeToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef(false);
  const committedTextRef = useRef("");

  const randomExample = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];

  // Pre-fetch scribe token on mount so click handler stays synchronous
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
        // Auto-send after VAD commits
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
  }, [partialText]); // triggered when partialText resets after commit

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, partialText]);

  const sendToAI = useCallback(async (allMessages: ChatMessage[]) => {
    setIsLoading(true);
    setIsAnalyzing(true);
    setDetectedFilters(null);

    try {
      const { data, error } = await supabase.functions.invoke("movie-chat", {
        body: { messages: allMessages },
      });

      if (error) throw error;
      setIsAnalyzing(false);

      if (data?.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }

      if (data?.movie) {
        const movie = data.movie as MovieDetail;
        const filters: string[] = [];
        if (movie.genres?.length) filters.push(...movie.genres.slice(0, 2).map(g => g.name));
        if (movie.runtime) filters.push(`${movie.runtime} min`);
        setDetectedFilters(filters);

        setTimeout(() => {
          onMovieSuggested(movie);
        }, 1800);
      }
    } catch (e) {
      console.error("Chat error:", e);
      setIsAnalyzing(false);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Oups, une erreur est survenue. Réessaie !" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [onMovieSuggested]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setPartialText("");
    await sendToAI(newMessages);
  }, [messages, sendToAI]);

  const startListening = useCallback(async () => {
    setMicError(null);
    try {
      if (!scribeToken) {
        // Token not loaded yet, try fetching now
        const { data } = await supabase.functions.invoke("scribe-token");
        if (!data?.token) throw new Error("Failed to get voice token");
        setScribeToken(data.token);
        
        // getUserMedia directly in click handler — critical for Safari
        await scribe.connect({
          token: data.token,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } else {
        // Token pre-loaded: getUserMedia happens inside scribe.connect directly in click handler
        await scribe.connect({
          token: scribeToken,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      }

      setIsListening(true);
    } catch (e: any) {
      console.error("Mic error:", e);
      if (e?.name === "NotAllowedError" || e?.message?.includes("Permission")) {
        setMicError("Accès au micro refusé. Autorise le micro dans les paramètres de ton navigateur.");
      } else {
        setMicError(`Erreur micro. Tape ton message ci-dessous 👇`);
        console.error("Full error:", JSON.stringify(e, null, 2));
      }
      inputRef.current?.focus();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [scribe, scribeToken]);

  const stopListening = useCallback(() => {
    scribe.disconnect();
    setIsListening(false);
    setPartialText("");
  }, [scribe]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  const showEmptyState = messages.length === 0 && !isListening && !partialText && !isLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/90 backdrop-blur-2xl"
        onClick={onClose}
      />

      {/* Chat card */}
      <motion.div
        initial={{ y: 30, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.96 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-lg bg-card/80 backdrop-blur-md border border-border/20 rounded-none sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl shadow-primary/5"
        style={{ maxHeight: "100dvh", height: "100dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-base">Assistant Pick</h2>
              <p className="text-muted-foreground text-[11px] font-sans">Film en 2 secondes</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3 min-h-[250px]">
          {/* Empty state — big clickable mic */}
          {showEmptyState && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <button
                type="button"
                onClick={() => startListening()}
                className="group w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-5 transition-all duration-200 active:scale-95 active:bg-primary/20 cursor-pointer select-none"
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
              >
                <Mic className="w-10 h-10 text-primary pointer-events-none" />
              </button>
              <p className="text-foreground/70 text-base font-serif mb-2">
                Dis-moi ce que tu veux regarder
              </p>
              <p className="text-muted-foreground text-xs font-sans mb-4">
                Appuie sur le micro et parle naturellement
              </p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10"
              >
                <Mic className="w-3 h-3 text-primary/60" />
                <span className="text-primary/60 text-xs font-sans italic">
                  Essayez : « {randomExample} »
                </span>
              </motion.div>
            </motion.div>
          )}

          {/* Listening state — pulsing mic with sound wave */}
          {isListening && messages.length === 0 && !partialText && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <motion.div
                animate={{ boxShadow: ["0 0 0 0px rgba(139, 92, 246, 0.3)", "0 0 0 20px rgba(139, 92, 246, 0)", "0 0 0 0px rgba(139, 92, 246, 0.3)"] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-5 rounded-full"
              >
                <button
                  type="button"
                  onClick={() => stopListening()}
                  className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                >
                  <MicOff className="w-10 h-10 text-primary pointer-events-none" />
                </button>
              </motion.div>
              <SoundWave />
              <p className="text-primary text-sm font-sans mt-4 font-medium">
                Je t'écoute…
              </p>
              <p className="text-muted-foreground text-xs font-sans mt-1">
                Appuie pour arrêter
              </p>
            </motion.div>
          )}

          {/* Analyzing state */}
          {isAnalyzing && messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-secondary/80 border border-border/20">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-sans text-foreground/80 font-medium">Analyse de ta demande…</p>
                    <p className="text-xs font-sans text-muted-foreground mt-0.5">Film parfait en cours de recherche</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm font-sans ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary/80 text-secondary-foreground rounded-bl-md border border-border/20"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}

          {/* Detected filters badges */}
          {detectedFilters && detectedFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-start"
            >
              <div className="flex flex-wrap gap-1.5 px-1">
                <span className="text-[10px] text-muted-foreground font-sans mr-1">Détecté :</span>
                {detectedFilters.map((f, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-sans font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {micError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
              <div className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-sans text-center max-w-[90%]">
                {micError}
              </div>
            </motion.div>
          )}

          {/* Live transcription preview */}
          {partialText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm font-sans bg-primary/50 text-primary-foreground/70 italic">
                {partialText}…
              </div>
            </motion.div>
          )}

          {isLoading && !isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-secondary/80 text-secondary-foreground border border-border/20">
                <div className="flex items-center gap-2 text-sm font-sans">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Réflexion…</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border/10 px-5 py-3 flex items-center gap-2">
          {/* Mic button in input when messages exist */}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => isListening ? stopListening() : startListening()}
              disabled={isLoading}
              className={`rounded-full flex-shrink-0 ${isListening ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ou tape ton message ici…"
            className="flex-1 bg-transparent text-foreground text-sm font-sans placeholder:text-muted-foreground/40 outline-none"
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSend(inputText)}
            disabled={isLoading || !inputText.trim()}
            className="text-primary hover:text-primary/80 rounded-full"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VoiceChat;
