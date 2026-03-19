import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Shield, ShieldAlert, ShieldOff, Clock, Sparkles, User, Clapperboard, Music, Eye, Star, ChevronDown, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getPosterUrl, getBackdropUrl } from "@/lib/tmdb";

type SpoilerMode = "no-spoilers" | "up-to-current" | "full-spoilers";
type MovieProgress = "beginning" | "middle" | "near-end";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const getQuickActions = (isTv: boolean) => {
  const label = isTv ? "cette série" : "ce film";
  return [
    { label: "Fun fact", icon: Sparkles, message: `Donne-moi un fun fact sur ${label} !` },
    { label: "Cet acteur ?", icon: User, message: "Qui est l'acteur/actrice principal(e) et quels sont ses autres rôles connus ?" },
    { label: "Cette scène", icon: Eye, message: "Explique-moi cette scène sans spoilers." },
    { label: "Coulisses", icon: Clapperboard, message: "Raconte-moi une anecdote de tournage !" },
    { label: "Musique", icon: Music, message: `Parle-moi de la musique / bande-son de ${label}.` },
    { label: "Sans spoilers", icon: Shield, message: `Explique-moi le contexte de ${label} sans me spoiler.` },
  ];
};

const CONTEXTUAL_PROMPTS = [
  "Pourquoi ce personnage fait ça ?",
  "Explique cette scène sans spoiler",
  "Qui joue ce personnage ?",
];

const SPOILER_MODES: { value: SpoilerMode; label: string; icon: typeof Shield; color: string }[] = [
  { value: "no-spoilers", label: "Sans spoilers", icon: Shield, color: "text-green-400 border-green-400/30 bg-green-400/10" },
  { value: "up-to-current", label: "Jusqu'ici", icon: ShieldAlert, color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  { value: "full-spoilers", label: "Tout révéler", icon: ShieldOff, color: "text-red-400 border-red-400/30 bg-red-400/10" },
];

const PROGRESS_OPTIONS: { value: MovieProgress; label: string }[] = [
  { value: "beginning", label: "Début" },
  { value: "middle", label: "Milieu" },
  { value: "near-end", label: "Bientôt la fin" },
];

interface CompanionModeProps {
  movie: MovieDetail;
  onClose: () => void;
  pickPlus?: {
    canAskCompanion: (movieId: number) => boolean;
    recordCompanionQuestion: (movieId: number) => Promise<boolean>;
    getCompanionUsed: (movieId: number) => number;
    companionLimit: number;
    isPremium: boolean;
    showPaywall: () => void;
  };
}

// Proactive suggestions that Pick surfaces periodically
const getProactiveSuggestions = (isTv: boolean) => [
  "Tu veux un fun fact sur cette scène ? 🎬",
  "Je connais une anecdote sur cet acteur 👀",
  `Tu savais que ${isTv ? "cette série a failli ne jamais sortir" : "ce film a failli ne jamais sortir"} ?`,
  "Envie d'en savoir plus sur la musique de cette scène ? 🎵",
  "Le réalisateur a caché un easter egg ici…",
  `Ce plan est une référence à ${isTv ? "une autre série" : "un autre film"}, tu veux savoir ${isTv ? "laquelle" : "lequel"} ?`,
  "L'acteur a improvisé cette réplique !",
  "Fun fact : ce lieu de tournage est réel 🗺️",
];

export default function CompanionMode({ movie, onClose, pickPlus }: CompanionModeProps) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    return [{
      role: "assistant" as const,
      content: `C'est parti pour **${getDisplayTitle(movie)}** ! 🍿\nPose-moi une question quand tu veux, je suis là tout le long.`
    }];
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [spoilerMode, setSpoilerMode] = useState<SpoilerMode>("no-spoilers");
  const [movieProgress, setMovieProgress] = useState<MovieProgress>("beginning");
  const [showSettings, setShowSettings] = useState(false);
  const [proactiveSuggestion, setProactiveSuggestion] = useState<string | null>(null);
  const proactiveIndexRef = useRef(0);
  const proactiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isTv = !!movie.first_air_date;
  const QUICK_ACTIONS = getQuickActions(isTv);
  const PROACTIVE_SUGGESTIONS = getProactiveSuggestions(isTv);

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const poster = getPosterUrl(movie.poster_path, "w342");
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const runtime = movie.runtime || movie.episode_run_time?.[0] || 0;
  const rating = movie.vote_average || 0;

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Proactive suggestions — surface one every 15-20 minutes
  useEffect(() => {
    const showNextSuggestion = () => {
      if (isStreaming) return; // Don't interrupt active conversation
      const idx = proactiveIndexRef.current % PROACTIVE_SUGGESTIONS.length;
      setProactiveSuggestion(PROACTIVE_SUGGESTIONS[idx]);
      proactiveIndexRef.current++;
    };

    // First suggestion after 15 min (900s), then every 18 min
    const initialDelay = setTimeout(() => {
      showNextSuggestion();
      proactiveTimerRef.current = setInterval(showNextSuggestion, 18 * 60 * 1000);
    }, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialDelay);
      if (proactiveTimerRef.current) clearInterval(proactiveTimerRef.current);
    };
  }, [isStreaming]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Check companion limit
    if (pickPlus && !pickPlus.canAskCompanion(movie.id)) {
      pickPlus.showPaywall();
      return;
    }
    if (pickPlus) {
      await pickPlus.recordCompanionQuestion(movie.id);
    }

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

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur ${resp.status}`);
      }

      if (!resp.body) throw new Error("Pas de réponse du serveur");

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
            // partial JSON
          }
        }
      }

      // If no content was streamed, show fallback
      if (!assistantContent) {
        assistantContent = "Hmm, je n'ai pas réussi à répondre. Réessaie ! 🎬";
        setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      }
    } catch (e: any) {
      console.error("Companion chat error:", e);
      assistantContent = `Oups, ${e.message || "une erreur est survenue"}. Réessaie ! 🎬`;
      setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const currentSpoilerConfig = SPOILER_MODES.find(s => s.value === spoilerMode)!;
  const hasUserMessages = messages.some(m => m.role === "user");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Backdrop image — subtle */}
      {backdrop && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-border/10">
        <div className="flex items-center gap-3 px-4 py-3 safe-area-top">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-9 h-9 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <img src={poster} alt={title} className="w-9 h-13 rounded-lg object-cover shadow-lg border border-border/20" />

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-serif font-medium truncate leading-tight">{title}</h2>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              {year && <span>{year}</span>}
              {runtime > 0 && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {runtime} min
                </span>
              )}
              {rating > 0 && (
                <span className="flex items-center gap-0.5 text-primary">
                  <Star className="w-2.5 h-2.5 fill-primary" />
                  {rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${currentSpoilerConfig.color}`}
          >
            <currentSpoilerConfig.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{currentSpoilerConfig.label}</span>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 flex-shrink-0 overflow-hidden border-b border-border/10"
          >
            <div className="p-4 space-y-4 bg-card/30 backdrop-blur-md">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans font-semibold mb-2">Protection spoilers</p>
                <div className="flex gap-2">
                  {SPOILER_MODES.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setSpoilerMode(mode.value)}
                      className={`flex-1 rounded-xl p-2.5 text-center transition-all text-xs font-sans ${
                        spoilerMode === mode.value
                          ? "bg-primary/15 border border-primary/30 text-primary"
                          : "bg-secondary/50 border border-border/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <mode.icon className="w-4 h-4 mx-auto mb-1" />
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {spoilerMode === "up-to-current" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans font-semibold mb-2">Où en es-tu ?</p>
                  <div className="flex gap-2">
                    {PROGRESS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setMovieProgress(opt.value)}
                        className={`flex-1 rounded-xl p-2.5 text-center text-xs font-sans transition-all ${
                          movieProgress === opt.value
                            ? "bg-primary/15 border border-primary/30 text-primary"
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

      {/* Main Content Area */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto">
        {/* ===== CHAT MESSAGES ===== */}
        <div className="px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-sans leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card/60 backdrop-blur-sm border border-border/20 rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0 [&_strong]:text-primary/90">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}

          {/* Streaming dots */}
          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-card/60 backdrop-blur-sm border border-border/20 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Quick actions — horizontal scrollable chips */}
      {!hasUserMessages && (
        <div className="relative z-10 flex-shrink-0 px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.message)}
                disabled={isStreaming}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary/60 border border-border/20 text-xs font-sans text-foreground/60 hover:text-primary hover:border-primary/25 transition-all disabled:opacity-50 active:scale-[0.97]"
              >
                <action.icon className="w-3 h-3" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contextual prompts after a few exchanges */}
      {hasUserMessages && messages.length >= 3 && messages.length < 8 && (
        <div className="relative z-10 flex-shrink-0 px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CONTEXTUAL_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={isStreaming}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-border/15 text-xs font-sans text-muted-foreground hover:text-primary hover:border-primary/25 transition-all disabled:opacity-50"
              >
                <MessageCircle className="w-3 h-3" />
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proactive suggestion bubble */}
      <AnimatePresence>
        {proactiveSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative z-10 flex-shrink-0 px-4 pb-2"
          >
            <button
              onClick={() => {
                sendMessage(proactiveSuggestion);
                setProactiveSuggestion(null);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-primary/10 border border-primary/25 text-left transition-all hover:bg-primary/15 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-foreground/70 text-[13px] font-sans leading-snug flex-1">{proactiveSuggestion}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setProactiveSuggestion(null); }}
                className="text-foreground/30 hover:text-foreground/60 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="relative z-10 flex-shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border/10 bg-background/80 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Pose-moi une question sur ${movie.first_air_date ? "la série" : "le film"}`}
            disabled={isStreaming}
            className="flex-1 bg-secondary/50 border border-border/20 rounded-full px-4 py-2.5 text-sm font-sans placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/20 disabled:opacity-50 transition-all"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="rounded-full w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 transition-all disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
