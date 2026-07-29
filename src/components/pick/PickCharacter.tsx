import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, Loader2 } from "lucide-react";
import pickDefault from "@/assets/pick-squirrel.webp";
import pickWave from "@/assets/pick-squirrel-wave.webp";
import pickThink from "@/assets/pick-squirrel-think.webp";
import { getDayPeriod } from "@/lib/time-context";

export type PickMood = "default" | "wave" | "think";

const PICK_IMAGES: Record<PickMood, string> = {
  default: pickDefault,
  wave: pickWave,
  think: pickThink,
};

function getTimeAwareGreetings(): string[] {
  const period = getDayPeriod();
  const universal = [
    "J'ai plein de pépites à te montrer !",
    "Dis-moi ton humeur, je m'occupe du reste.",
    "Je connais le film parfait pour toi.",
    "Tu tombes bien, j'ai justement un truc pour toi.",
    "Installe-toi, je gère tout.",
    "Hmm… j'ai quelques films en tête. On en parle ?",
    "T'as l'air d'avoir besoin d'un bon film.",
    "Dis-moi tout, je t'écoute !",
    "Tiens, je pensais justement à toi.",
    "Mon radar ciné est activé. À toi de jouer.",
    "Tu veux un classique ou un truc surprenant ?",
  ];

  switch (period) {
    case "morning":
      return [
        "Salut ! Déjà en mode ciné ?",
        "Une idée de film pour plus tard ?",
        "Bonjour ! Je te prépare quelque chose pour plus tard.",
        "Matinée ciné ? J'adore l'idée.",
        ...universal,
      ];
    case "afternoon":
      return [
        "Un film pour cet après-midi ?",
        "Allez, on se trouve un bon film.",
        "L'après-midi parfaite pour un bon film.",
        "Yo ! Envie de regarder quelque chose ?",
        ...universal,
      ];
    case "evening":
      return [
        "Alors… qu'est-ce qu'on se mate ce soir ?",
        "Prêt pour une soirée ciné ?",
        "Salut ! T'as envie de quoi ce soir ?",
        "Ce soir c'est ciné, et j'ai les clés du cinéma.",
        "Je sens que ce soir va être une bonne soirée ciné.",
        "Bonsoir ! J'ai rechargé mes batteries cinématographiques.",
        "Allez, on va trouver THE film du soir.",
        "Je suis en forme, j'ai plein d'idées ce soir !",
        ...universal,
      ];
    case "night":
      return [
        "Encore debout ? J'ai un film pour cette nuit.",
        "Un dernier film avant de dormir ?",
        "Nuit ciné ? Parfait, j'ai des idées.",
        "Le calme de la nuit, le film parfait.",
        ...universal,
      ];
  }
}

interface PickCharacterProps {
  mood?: PickMood;
  message?: string;
  showGreeting?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
  /** When true, plays the bounce reaction (recommendation appeared) */
  bounce?: boolean;
  /** Show a play button to hear Pick speak */
  speakable?: boolean;
}

const SIZE_MAP = {
  sm: "w-16 h-16",
  md: "w-28 h-28",
  lg: "w-36 h-36",
};

const PickCharacter = ({
  mood = "default",
  message,
  showGreeting = false,
  size = "md",
  className = "",
  animate = true,
  bounce = false,
  speakable = false,
}: PickCharacterProps) => {
  const [greeting, setGreeting] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  useEffect(() => {
    if (showGreeting && !message) {
      const greetings = getTimeAwareGreetings();
      setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    }
  }, [showGreeting, message]);

  const displayMessage = message || (showGreeting ? greeting : "");

  const playBrowserFallback = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const handleSpeak = useCallback(async () => {
    if (!displayMessage || audioLoading || speaking) return;
    setAudioLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pick-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: displayMessage }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`TTS failed: ${response.status} ${errorBody}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setSpeaking(true);
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      console.error("Pick TTS error:", e);
      const fallbackStarted = playBrowserFallback(displayMessage);
      if (!fallbackStarted) {
        setSpeaking(false);
      }
    } finally {
      setAudioLoading(false);
    }
  }, [displayMessage, audioLoading, speaking, playBrowserFallback]);

  // Determine which CSS animation class to apply
  const getAnimationClass = () => {
    if (bounce) return "pick-bounce";
    if (mood === "think") return "pick-thinking";
    if (animate) return "pick-float";
    return "";
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        {displayMessage && (
          <motion.div
            key={displayMessage}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative max-w-[260px] px-4 py-2.5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-lg"
          >
            <p className="text-foreground/80 text-[13px] font-sans leading-relaxed text-center">
              {displayMessage}
            </p>

            {/* Play button */}
            {speakable && (
              <button
                onClick={handleSpeak}
                disabled={audioLoading || speaking}
                className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-card border border-border/40 flex items-center justify-center text-foreground/40 hover:text-primary hover:border-primary/30 transition-all active:scale-90 shadow-sm"
                title="Écouter Pick"
              >
                {audioLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Volume2 className={`w-3 h-3 ${speaking ? "text-primary" : ""}`} />
                )}
              </button>
            )}

            {/* Bubble tail */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card/80 border-r border-b border-border/30" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character — CSS micro-animations */}
      <div className="relative">
        <img
          key={mood}
          src={PICK_IMAGES[mood]}
          alt="Pick"
          className={`${SIZE_MAP[size]} object-contain drop-shadow-lg ${getAnimationClass()}`}
        />
      </div>
    </div>
  );
};

export default PickCharacter;
