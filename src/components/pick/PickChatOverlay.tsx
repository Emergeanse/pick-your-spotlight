import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, PanInfo } from "framer-motion";
import { X, Send, Star, ExternalLink, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useCompanion } from "@/contexts/CompanionContext";
import { getDisplayTitle, getPosterUrl } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useScribe } from "@elevenlabs/react";
import { usePickPlus } from "@/hooks/use-pick-plus";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import squirrelImg from "@/assets/pick-squirrel.png";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  movie?: any; // embedded movie recommendation
}

const DISCOVERY_CHIPS_FREE = [
  { label: "Un film ce soir 🍿", msg: "Trouve-moi un bon film pour ce soir !" },
  { label: "Envie de rire 😂", msg: "J'ai envie de rigoler, trouve-moi une bonne comédie !" },
  { label: "Soirée en couple 💕", msg: "Soirée en couple ce soir, trouve-nous le film parfait !" },
  { label: "Film intense 🔥", msg: "J'ai envie d'un truc intense et puissant ce soir !" },
];

const DISCOVERY_CHIPS_PREMIUM = [
  { label: "Un film ce soir 🍿", msg: "Trouve-moi un bon film pour ce soir !" },
  { label: "Comment ça marche ?", msg: "Explique-moi comment fonctionne l'appli Pick." },
  { label: "Recommande-moi", msg: "Qu'est-ce que tu me recommandes en ce moment ?" },
  { label: "C'est quoi Pick+ ?", msg: "C'est quoi Pick+ et qu'est-ce que ça apporte ?" },
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
  const [streamingContent, setStreamingContent] = useState("");
  const [userPrefs, setUserPrefs] = useState<{ minRating: number; excludedGenres: string[] }>({ minRating: 0, excludedGenres: [] });
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const y = useMotionValue(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  
  const pendingVoiceRef = useRef<string | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: "vad" as any,
    onPartialTranscript: (data) => {
      if (data.text) {
        setInput(data.text);
      }
    },
    onCommittedTranscript: (data) => {
      if (data.text?.trim()) {
        const finalText = data.text.trim();
        setInput(finalText);
        scribe.disconnect();
        setIsListening(false);
        // Store for auto-send (sendMessage not yet available in this scope)
        pendingVoiceRef.current = finalText;
      }
    },
  });

  // Auto-send when voice transcription completes
  useEffect(() => {
    if (pendingVoiceRef.current && !isStreaming) {
      const text = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      // Small delay to let sendMessage be defined
      const timer = setTimeout(() => {
        sendMessageRef.current?.(text);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isListening, isStreaming]);

  const sendMessageRef = useRef<(text: string) => void>();

  const currentMessages = mode === "companion" ? companionMessages : messages;
  
  const title = activeMovie ? getDisplayTitle(activeMovie) : "";
  const poster = activeMovie?.poster_path ? getPosterUrl(activeMovie.poster_path, "w92") : null;

  // Load user preferences (minRating, excludedGenres)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("min_rating, excluded_genres").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setUserPrefs({
            minRating: (data as any).min_rating || 0,
            excludedGenres: (data as any).excluded_genres || [],
          });
        }
      });
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, streamingContent]);

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus(), 400);
    } else {
      // Disconnect mic when overlay closes
      if (scribe.isConnected) {
        scribe.disconnect();
        setIsListening(false);
      }
    }
  }, [isOverlayOpen]);

  // Focus input after mic stops so user can send
  useEffect(() => {
    if (!isListening && input.trim()) {
      inputRef.current?.focus();
    }
  }, [isListening]);

  const toggleMic = useCallback(async () => {
    if (scribe.isConnected) {
      scribe.disconnect();
      setIsListening(false);
      return;
    }
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scribe-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const { token } = await resp.json();
      if (!token) throw new Error("No token");
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      setIsListening(true);
      setInput("");
    } catch (e) {
      console.error("Mic error:", e);
      setIsListening(false);
    }
  }, [scribe]);

  const pickPlus = usePickPlus();
  const chips = mode === "companion" ? COMPANION_CHIPS : (pickPlus.isPremium ? DISCOVERY_CHIPS_PREMIUM : DISCOVERY_CHIPS_FREE);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Free users: check if discovery chat is still available
    if (!pickPlus.isPremium && mode !== "companion") {
      if (!pickPlus.canDiscoveryChat) {
        pickPlus.showPaywall("chat_limit");
        return;
      }
    }

    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    addMessage(userMsg);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    const allMessages = [...currentMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const body: any = {
        messages: allMessages,
        mode: mode === "companion" ? "companion" : "discovery",
        isPremium: pickPlus.isPremium,
        minRating: userPrefs.minRating,
        excludedGenres: userPrefs.excludedGenres,
      };

      if (mode === "companion" && activeMovie) {
        body.movieTitle = title;
        body.movieYear = activeMovie.release_date?.slice(0, 4) || activeMovie.first_air_date?.slice(0, 4) || "";
        body.movieOverview = activeMovie.overview || "";
        body.spoilerMode = "no-spoilers";
        body.movieProgress = "beginning";
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pick-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Erreur réseau");
      }

      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && resp.body) {
        // Streaming response (companion mode)
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
                setStreamingContent(assistantContent);
              }
            } catch { /* partial JSON */ }
          }
        }

        if (assistantContent) {
          addMessage({ role: "assistant", content: assistantContent });
        }
        setStreamingContent("");
      } else {
        // JSON response (discovery mode)
        const data = await resp.json();

        if (data.type === "recommendation" && data.movie) {
          addMessage({
            role: "assistant",
            content: data.reply,
            movie: data.movie,
          } as any);
          // Lock discovery chat for free users after receiving a recommendation
          if (!pickPlus.isPremium) {
            pickPlus.lockDiscoveryChat();
            await pickPlus.recordDiscoveryConvo();
          }
        } else if (data.type === "youtube" && data.videos?.length > 0) {
          addMessage({
            role: "assistant",
            content: data.reply,
            youtubeVideos: data.videos,
          } as any);
        } else {
          addMessage({ role: "assistant", content: data.reply || "Hmm, dis-moi en plus !" });
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      addMessage({ role: "assistant", content: `Oups, ${e.message || "une erreur est survenue"}. Réessaie ! 🎬` });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [isStreaming, currentMessages, mode, activeMovie, title, addMessage]);

  // Keep ref in sync for voice auto-send
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleMovieClick = (movie: any) => {
    closeOverlay();
    // Dispatch a custom event so Index.tsx can pick it up even without remount
    sessionStorage.setItem("pick-fab-movie", JSON.stringify(movie));
    window.dispatchEvent(new CustomEvent("pick-chat-movie"));
    navigate("/app?from=pick-chat");
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
  const hasUserMessages = currentMessages.some(m => m.role === "user");

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
            className="fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-[20px] overflow-hidden bg-background"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
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
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-500 font-sans">Companion actif</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-serif font-medium">Parle à Pick</p>
                    <p className="text-[10px] text-muted-foreground font-sans">
                      {pickPlus.isPremium ? "Films, séries, appli — demande-moi tout" : "Trouve ton film du soir"}
                    </p>
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
                      <>
                        <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {/* Inline movie card */}
                        {(msg as any).movie && <MovieCard movie={(msg as any).movie} onClick={() => handleMovieClick((msg as any).movie)} />}
                        {(msg as any).youtubeVideos && (msg as any).youtubeVideos.map((video: any) => (
                          <YouTubeCard key={video.id} video={video} />
                        ))}
                      </>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Streaming content */}
              {streamingContent && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] font-sans leading-relaxed bg-card/60 border border-border/15 rounded-bl-md">
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Loading dots (only when no streaming content yet) */}
              {isStreaming && !streamingContent && (
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
                      : pickPlus.isPremium
                        ? "Films, séries, ou l'appli — demande-moi tout ! 🎬"
                        : "Dis-moi ton humeur, je trouve ton film du soir ! 🎬"
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Suggestion chips */}
            {!hasUserMessages && (
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
            )}

            {/* Input bar */}
            <div className="relative z-10 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 border-t border-border/10">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  onClick={toggleMic}
                  disabled={isStreaming}
                  className={`rounded-full w-10 h-10 flex-shrink-0 transition-all ${
                    isListening
                      ? "bg-primary text-primary-foreground animate-pulse"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isListening
                    ? "Écoute en cours…"
                    : pickPlus.discoveryConvoLocked && !pickPlus.isPremium
                      ? "Conversation terminée pour aujourd'hui"
                      : mode === "companion"
                        ? "Pose-moi une question sur le film…"
                        : pickPlus.isPremium
                          ? "Demande-moi ce que tu veux…"
                          : "Dis-moi ton humeur pour ce soir…"
                  }
                  disabled={isStreaming || (pickPlus.discoveryConvoLocked && !pickPlus.isPremium && mode !== "companion")}
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
              {/* Status indicator for free users */}
              {!pickPlus.isPremium && mode !== "companion" && (
                <p className="text-center text-[10px] text-muted-foreground/40 font-sans mt-1.5">
                  {pickPlus.discoveryConvoLocked
                    ? "Film trouvé ! Passe à Pick+ pour le chatbot complet 👑"
                    : !pickPlus.canDiscoveryChat
                      ? "Conversation du jour utilisée — Reviens demain ou passe à Pick+ 👑"
                      : "1 conversation découverte par jour"
                  }
                </p>
              )}
              </form>
            </div>
          </motion.div>
        </>
      )}

      {/* Pick+ Paywall */}
      <PickPlusPaywall
        open={pickPlus.shouldShowPaywall}
        onClose={pickPlus.hidePaywall}
        trigger={pickPlus.paywallTrigger as any}
      />
    </AnimatePresence>
  );
}

/** Inline movie recommendation card */
function MovieCard({ movie, onClick }: { movie: any; onClick: () => void }) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w154${movie.poster_path}`
    : null;
  const movieTitle = movie.title || movie.name || "Film inconnu";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
  const rating = movie.vote_average || 0;

  return (
    <button
      onClick={onClick}
      className="mt-2 flex items-center gap-3 w-full p-2 rounded-xl bg-secondary/40 border border-border/15 text-left hover:bg-secondary/60 transition-all active:scale-[0.98]"
    >
      {posterUrl && (
        <img src={posterUrl} alt={movieTitle} className="w-10 h-14 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-serif font-medium truncate">{movieTitle}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          {year && <span>{year}</span>}
          {rating > 0 && (
            <span className="flex items-center gap-0.5 text-primary">
              <Star className="w-2.5 h-2.5 fill-primary" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

/** Inline YouTube video card */
function YouTubeCard({ video }: { video: any }) {
  return (
    <button
      onClick={() => window.open(video.url, "_blank", "noopener")}
      className="mt-2 flex items-center gap-3 w-full p-2 rounded-xl bg-secondary/40 border border-border/15 text-left hover:bg-secondary/60 transition-all active:scale-[0.98] group"
    >
      <div className="relative w-16 aspect-video rounded-lg overflow-hidden flex-shrink-0">
        {video.thumbnail && (
          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-red-600/90 flex items-center justify-center">
            <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-sans font-medium truncate">{video.title}</p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{video.channelTitle}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
