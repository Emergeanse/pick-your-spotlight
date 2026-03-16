import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X, Send, Mic, Sparkles, User, Eye, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useCompanion } from "@/contexts/CompanionContext";
import { getDisplayTitle, getPosterUrl } from "@/lib/tmdb";
import squirrelImg from "@/assets/pick-squirrel.png";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const DISCOVERY_CHIPS = [
  { label: "Un film ce soir", icon: Sparkles, msg: "Trouve-moi un bon film pour ce soir !" },
  { label: "Recommandation", icon: Eye, msg: "Qu'est-ce que tu me recommandes en ce moment ?" },
];

const COMPANION_CHIPS = [
  { label: "Fun fact 🎬", msg: "Donne-moi un fun fact sur ce film !" },
  { label: "Cet acteur ?", msg: "Qui est l'acteur/actrice principal(e) et quels sont ses autres films connus ?" },
  { label: "Cette scène", msg: "Explique-moi cette scène sans spoilers." },
  { label: "Contexte historique", msg: "Donne-moi le contexte historique de ce film." },
];

export default function PickChatOverlay() {
  const { isOverlayOpen, closeOverlay, activeMovie, mode, messages, companionMessages, addMessage, setMessages } = useCompanion();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const y = useMotionValue(0);

  const currentMessages = mode === "companion" ? companionMessages : messages;
  const chips = mode === "companion" ? COMPANION_CHIPS : DISCOVERY_CHIPS;
  const title = activeMovie ? getDisplayTitle(activeMovie) : "";
  const poster = activeMovie?.poster_path ? getPosterUrl(activeMovie.poster_path, "w92") : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages]);

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOverlayOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    addMessage(userMsg);
    setInput("");
    setIsStreaming(true);

    const allMessages = [...currentMessages, userMsg];

    try {
      const endpoint = mode === "companion" ? "companion-chat" : "movie-chat";
      const body = mode === "companion" && activeMovie
        ? {
            messages: allMessages,
            movieTitle: title,
            movieYear: activeMovie.release_date?.slice(0, 4) || "",
            movieOverview: activeMovie.overview || "",
            spoilerMode: "no-spoilers",
            movieProgress: "beginning",
          }
        : { messages: allMessages };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

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
              // We need to update messages through context - use a temp approach
            }
          } catch { /* partial JSON */ }
        }
      }

      if (assistantContent) {
        addMessage({ role: "assistant", content: assistantContent });
      }
    } catch (e) {
      console.error("Chat error:", e);
      addMessage({ role: "assistant", content: "Oups, une erreur est survenue. Réessaie ! 🎬" });
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, currentMessages, mode, activeMovie, title, addMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 150) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        closeOverlay();
      }
    } else if (info.velocity.y < -300 || info.offset.y < -100) {
      setIsExpanded(true);
    }
    y.set(0);
  };

  const overlayHeight = isExpanded ? "92vh" : "55vh";

  return (
    <AnimatePresence>
      {isOverlayOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={closeOverlay}
          />

          {/* Overlay */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ y, height: overlayHeight }}
            className="fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-[20px] overflow-hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            <div className="absolute inset-0 bg-[hsl(260,20%,7%)] backdrop-blur-xl" />

            {/* Drag handle */}
            <div className="relative z-10 flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center gap-3 px-4 pb-3 border-b border-border/10">
              <img src={squirrelImg} alt="Pick" className="w-8 h-8 rounded-full object-cover" />
              
              <div className="flex-1 min-w-0">
                {mode === "companion" && activeMovie ? (
                  <div className="flex items-center gap-2">
                    {poster && <img src={poster} alt={title} className="w-6 h-9 rounded object-cover" />}
                    <div className="min-w-0">
                      <p className="text-sm font-serif font-medium truncate">{title}</p>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-400 font-sans">Companion actif</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-serif font-medium">Pick</p>
                    <p className="text-[10px] text-muted-foreground font-sans">Découverte</p>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="icon" onClick={closeOverlay} className="rounded-full w-8 h-8 text-muted-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat area */}
            <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {currentMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] font-sans leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card/60 border border-border/15 rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-card/60 border border-border/15 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center pt-6 text-center">
                  <img src={squirrelImg} alt="Pick" className="w-16 h-16 rounded-full object-cover mb-3 opacity-60" />
                  <p className="text-sm text-muted-foreground font-sans">
                    {mode === "companion"
                      ? "Pose-moi une question sur le film !"
                      : "Dis-moi ce que tu veux regarder…"
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Suggestion chips */}
            <div className="relative z-10 px-4 pb-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {chips.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => sendMessage(chip.msg)}
                    disabled={isStreaming}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/15 text-[11px] font-sans text-foreground/60 hover:text-primary hover:border-primary/25 transition-all disabled:opacity-50 active:scale-[0.97]"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input bar */}
            <div className="relative z-10 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 border-t border-border/10">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={mode === "companion"
                    ? "Pose-moi une question sur le film…"
                    : "Dis-moi ce que tu veux regarder…"
                  }
                  disabled={isStreaming}
                  className="flex-1 bg-secondary/50 border border-border/20 rounded-full px-4 py-2.5 text-sm font-sans placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition-all"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isStreaming}
                  className="rounded-full w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
