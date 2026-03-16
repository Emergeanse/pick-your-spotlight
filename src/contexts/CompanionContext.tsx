import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { MovieDetail } from "@/lib/tmdb";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  movie?: any;
}

interface CompanionState {
  activeMovie: MovieDetail | null;
  isOverlayOpen: boolean;
  mode: "discovery" | "companion";
  messages: ChatMsg[];
  companionMessages: ChatMsg[];
}

interface CompanionContextValue extends CompanionState {
  activateCompanion: (movie: MovieDetail) => void;
  deactivateCompanion: () => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  addMessage: (msg: ChatMsg) => void;
  setMessages: (msgs: ChatMsg[]) => void;
}

const CompanionContext = createContext<CompanionContextValue | null>(null);

const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const [activeMovie, setActiveMovie] = useState<MovieDetail | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [companionMessages, setCompanionMessages] = useState<ChatMsg[]>([]);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mode = activeMovie ? "companion" : "discovery";

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (activeMovie) {
      inactivityTimer.current = setTimeout(() => {
        setActiveMovie(null);
        setCompanionMessages([]);
      }, INACTIVITY_TIMEOUT);
    }
  }, [activeMovie]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [activeMovie, resetInactivityTimer]);

  const activateCompanion = useCallback((movie: MovieDetail) => {
    setActiveMovie(movie);
    setCompanionMessages([{
      role: "assistant",
      content: `C'est parti pour **${movie.title || movie.name}** ! 🍿\nPose-moi une question quand tu veux, je suis là tout le long.`
    }]);
  }, []);

  const deactivateCompanion = useCallback(() => {
    setActiveMovie(null);
    setCompanionMessages([]);
  }, []);

  const openOverlay = useCallback(() => setIsOverlayOpen(true), []);
  const closeOverlay = useCallback(() => setIsOverlayOpen(false), []);

  const addMessage = useCallback((msg: ChatMsg) => {
    if (activeMovie) {
      setCompanionMessages(prev => [...prev, msg]);
    } else {
      setMessages(prev => [...prev, msg]);
    }
    resetInactivityTimer();
  }, [activeMovie, resetInactivityTimer]);

  return (
    <CompanionContext.Provider value={{
      activeMovie, isOverlayOpen, mode, messages, companionMessages,
      activateCompanion, deactivateCompanion, openOverlay, closeOverlay,
      addMessage, setMessages,
    }}>
      {children}
    </CompanionContext.Provider>
  );
}

export function useCompanion() {
  const ctx = useContext(CompanionContext);
  if (!ctx) throw new Error("useCompanion must be used within CompanionProvider");
  return ctx;
}
