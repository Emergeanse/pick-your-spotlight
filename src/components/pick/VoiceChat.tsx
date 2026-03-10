import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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

const VoiceChat = ({ onClose, onMovieSuggested }: VoiceChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimText]);

  const sendToAI = useCallback(async (allMessages: ChatMessage[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("movie-chat", {
        body: { messages: allMessages },
      });

      if (error) throw error;

      if (data?.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }

      if (data?.movie) {
        // Small delay before showing movie result
        setTimeout(() => {
          onMovieSuggested(data.movie as MovieDetail);
        }, 1500);
      }
    } catch (e) {
      console.error("Chat error:", e);
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
    setInterimText("");
    await sendToAI(newMessages);
  }, [messages, sendToAI]);

  const startListening = useCallback(() => {
    if (!speechSupported) {
      setMicError("La reconnaissance vocale n'est pas supportée par ton navigateur. Tape ton message.");
      inputRef.current?.focus();
      return;
    }
    setMicError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        setInterimText("");
        handleSend(final);
      }
    };

    recognition.onerror = (e: any) => {
      console.error("SpeechRecognition error:", e.error);
      setIsListening(false);
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        setMicError("Accès au micro refusé. Autorise le micro dans les paramètres de ton navigateur.");
      } else if (e.error === "no-speech") {
        setMicError("Aucune voix détectée. Réessaie ou tape ton message.");
      } else {
        setMicError("Erreur micro. Tape ton message à la place.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setMicError("Impossible de démarrer le micro. Tape ton message.");
    }
  }, [speechSupported, handleSend]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Chat card */}
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="relative z-10 w-full max-w-lg bg-card/90 backdrop-blur-md border border-border/30 rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div>
            <h2 className="font-serif text-lg">Parle-moi</h2>
            <p className="text-muted-foreground text-xs font-sans">Dis-moi ce que tu veux regarder…</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
          {messages.length === 0 && !isListening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-10"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Mic className="w-7 h-7 text-primary" />
              </div>
              <p className="text-foreground/60 text-sm font-sans max-w-xs">
                Appuie sur le micro et dis-moi comment tu te sens ou ce que tu as envie de regarder
              </p>
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
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
          )}

          {micError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
              <div className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-sans text-center max-w-[90%]">
                {micError}
              </div>
            </motion.div>
          )}

          {interimText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm font-sans bg-primary/50 text-primary-foreground/70 italic">
                {interimText}…
              </div>
            </motion.div>
          )}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-secondary text-secondary-foreground">
                <div className="flex items-center gap-2 text-sm font-sans">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Réflexion…</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border/20 px-4 py-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ou tape ton message ici…"
            className="flex-1 bg-transparent text-foreground text-sm font-sans placeholder:text-muted-foreground/50 outline-none"
            disabled={isLoading}
          />

          {inputText.trim() ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSend(inputText)}
              disabled={isLoading}
              className="text-primary hover:text-primary/80"
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : speechSupported ? (
            <Button
              variant={isListening ? "default" : "ghost"}
              size="icon"
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={isListening ? "bg-primary text-primary-foreground animate-pulse" : "text-primary hover:text-primary/80"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSend(inputText)}
              disabled={isLoading || !inputText.trim()}
              className="text-primary hover:text-primary/80"
            >
              <Send className="w-5 h-5" />
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VoiceChat;
