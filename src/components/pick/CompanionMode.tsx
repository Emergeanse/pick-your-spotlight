import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Shield, ShieldAlert, ShieldOff, Clock, Sparkles, User, Clapperboard, Music, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getPosterUrl } from "@/lib/tmdb";

type SpoilerMode = "no-spoilers" | "up-to-current" | "full-spoilers";
type MovieProgress = "beginning" | "middle" | "near-end";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS = [
  { label: "Fun fact", icon: Sparkles, message: "Donne-moi un fun fact sur ce film !" },
  { label: "Cet acteur ?", icon: User, message: "Qui est l'acteur/actrice principal(e) et quels sont ses autres films connus ?" },
  { label: "Cette scène", icon: Eye, message: "Explique-moi cette scène sans spoilers." },
  { label: "Coulisses", icon: Clapperboard, message: "Raconte-moi une anecdote de tournage !" },
  { label: "Musique", icon: Music, message: "Parle-moi de la musique / bande-son de ce film." },
  { label: "Sans spoilers", icon: Shield, message: "Explique-moi le contexte de ce film sans me spoiler." },
];

const SPOILER_MODES: { value: SpoilerMode; label: string; icon: typeof Shield; desc: string }[] = [
  { value: "no-spoilers", label: "Sans spoilers", icon: Shield, desc: "Aucun spoiler" },
  { value: "up-to-current", label: "Jusqu'ici", icon: ShieldAlert, desc: "Spoilers jusqu'à ta progression" },
  { value: "full-spoilers", label: "Tout révéler", icon: ShieldOff, desc: "Spoilers complets" },
];

const PROGRESS_OPTIONS: { value: MovieProgress; label: string }[] = [
  { value: "beginning", label: "Début" },
  { value: "middle", label: "Milieu" },
  { value: "near-end", label: "Bientôt la fin" },
];

interface CompanionModeProps {
  movie: MovieDetail;
  onClose: () => void;
}

export default function CompanionMode({ movie, onClose }: CompanionModeProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [spoilerMode, setSpoilerMode] = useState<SpoilerMode>("no-spoilers");
  const [movieProgress, setMovieProgress] = useState<MovieProgress>("beginning");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const poster = getPosterUrl(movie.poster_path, "w342");
  const runtime = movie.runtime || movie.episode_run_time?.[0] || 0;

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    let assistantContent = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/companion-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            movieTitle: title,
            movieYear: year,
            movieOverview: movie.overview || "",
            spoilerMode,
            movieProgress,
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error("Stream failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
            }
          } catch {
            // partial JSON, wait
          }
        }
      }
    } catch (e) {
      console.error("Companion chat error:", e);
      assistantContent = "Oups, une erreur est survenue. Réessaie ! 🎬";
      setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (message: string) => {
    sendMessage(message);
  };

  const currentSpoilerConfig = SPOILER_MODES.find(s => s.value === spoilerMode)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex-shrink-0 relative">
        {/* Backdrop blur header */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-border/20" />
        <div className="relative z-10 flex items-center gap-3 px-4 py-3 safe-area-top">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-9 h-9 text-foreground/60">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={poster} alt={title} className="w-10 h-14 rounded-lg object-cover shadow-lg border border-border/20" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-serif font-medium truncate">{title}</h2>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {year && <span>{year}</span>}
              {runtime > 0 && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {runtime} min
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`rounded-full text-xs gap-1.5 h-8 px-3 ${
              spoilerMode === "no-spoilers"
                ? "text-green-400 border border-green-400/30"
                : spoilerMode === "up-to-current"
                ? "text-yellow-400 border border-yellow-400/30"
                : "text-red-400 border border-red-400/30"
            }`}
          >
            <currentSpoilerConfig.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{currentSpoilerConfig.label}</span>
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-border/20"
          >
            <div className="p-4 space-y-4 bg-card/50 backdrop-blur-md">
              {/* Spoiler mode */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Protection spoilers</p>
                <div className="flex gap-2">
                  {SPOILER_MODES.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setSpoilerMode(mode.value)}
                      className={`flex-1 rounded-xl p-2.5 text-center transition-all text-xs ${
                        spoilerMode === mode.value
                          ? "bg-primary/20 border border-primary/40 text-primary"
                          : "bg-secondary/50 border border-border/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <mode.icon className="w-4 h-4 mx-auto mb-1" />
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress selector */}
              {spoilerMode === "up-to-current" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Où en es-tu ?</p>
                  <div className="flex gap-2">
                    {PROGRESS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setMovieProgress(opt.value)}
                        className={`flex-1 rounded-xl p-2.5 text-center text-xs transition-all ${
                          movieProgress === opt.value
                            ? "bg-primary/20 border border-primary/40 text-primary"
                            : "bg-secondary/50 border border-border/20 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome message */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-20 h-28 mx-auto mb-4 rounded-xl overflow-hidden shadow-2xl border border-border/20">
              <img src={poster} alt={title} className="w-full h-full object-cover" />
            </div>
            <h3 className="font-serif text-lg mb-1">Bon visionnage ! 🍿</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Je suis ton compagnon pour <span className="text-primary font-medium">{title}</span>. Pose-moi des questions pendant le film !
            </p>
          </motion.div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border/30 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </motion.div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-card border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length < 2 && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.message)}
                disabled={isStreaming}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary/80 border border-border/30 text-xs text-foreground/70 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
              >
                <action.icon className="w-3 h-3" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border/20 bg-background/80 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pose une question sur le film…"
            disabled={isStreaming}
            className="flex-1 bg-secondary/60 border border-border/30 rounded-full px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="rounded-full w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
