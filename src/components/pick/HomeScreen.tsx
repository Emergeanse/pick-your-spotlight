import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, Play, Wand2 } from "lucide-react";
import { getTrendingMovies, getBackdropUrl, getSurpriseRecommendation } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";
import { useNavigate } from "react-router-dom";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onSurprise: (movie: MovieDetail) => void;
  loading: boolean;
}

const SURPRISE_MESSAGES = [
  "Analyse de tes goûts…",
  "Parcours des pépites cachées…",
  "Un peu de magie…",
  "Presque prêt…",
];

const SURPRISE_MESSAGES_ANON = [
  "Analyse de vos envies…",
  "Parcours des pépites cachées…",
  "Un peu de magie…",
  "Presque prêt…",
];

const HomeScreen = ({ onStart, onOpenChat, onSurprise, loading }: HomeScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSurprising, setIsSurprising] = useState(false);
  const [surpriseMsg, setSurpriseMsg] = useState("");
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getTrendingMovies(20).then((movies: Movie[]) => {
      const bgs = movies
        .filter(m => m.backdrop_path)
        .map(m => getBackdropUrl(m.backdrop_path))
        .filter(Boolean);
      setBgImages(bgs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (bgImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBgIndex(i => (i + 1) % bgImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [bgImages]);

  const handleStart = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onStart();
    }, 800);
  };

  const handleSurprise = async () => {
    setIsSurprising(true);
    const msgs = user ? SURPRISE_MESSAGES : SURPRISE_MESSAGES_ANON;
    let msgIndex = 0;
    setSurpriseMsg(msgs[0]);
    const msgInterval = setInterval(() => {
      msgIndex++;
      if (msgIndex < msgs.length) {
        setSurpriseMsg(msgs[msgIndex]);
      }
    }, 500);

    try {
      let movie: MovieDetail;

      if (user) {
        // Personalized: use liked movies history
        const liked = await getLikedMovies();
        if (liked.length >= 2) {
          const { data, error } = await supabase.functions.invoke("surprise-personalized", {
            body: { likedMovies: liked },
          });
          if (error) throw error;
          movie = data.movie as MovieDetail;
        } else {
          // Not enough history, fall back to random
          movie = await getSurpriseRecommendation();
        }
      } else {
        movie = await getSurpriseRecommendation();
      }

      clearInterval(msgInterval);
      setSurpriseMsg("✨ Trouvé !");
      await new Promise(r => setTimeout(r, 400));
      onSurprise(movie);
    } catch (e) {
      console.error(e);
      // Fallback to random
      try {
        const movie = await getSurpriseRecommendation();
        clearInterval(msgInterval);
        onSurprise(movie);
      } catch {
        clearInterval(msgInterval);
      }
    } finally {
      setIsSurprising(false);
      setSurpriseMsg("");
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <BrandHeader />

      {bgImages.map((bg, i) => (
        <motion.div
          key={bg}
          initial={{ opacity: 0 }}
          animate={{ opacity: i === currentBgIndex ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg})` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      <div className="absolute inset-0 bg-background/40" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-md"
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif mb-3 md:mb-4">
            Qu'est-ce qu'on regarde ?
          </h1>
          <p className="text-foreground/50 text-sm md:text-base font-sans font-light mb-8 md:mb-10 max-w-sm mx-auto">
            {user
              ? "On te connaît — laisse-nous te surprendre"
              : "Dis-nous ce que tu as envie de voir ou laisse-toi guider"}
          </p>
        </motion.div>

        {isSurprising ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Wand2 className="w-7 h-7 text-primary animate-pulse" />
            </div>
            <p className="text-foreground/60 text-sm font-sans animate-pulse">{surpriseMsg}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex flex-col items-center gap-4"
          >
            {/* Primary CTA — Parle-moi */}
            <div className="flex flex-col items-center">
              <Button
                variant="hero"
                size="xl"
                className="text-sm md:text-base px-8"
                onClick={onOpenChat}
                disabled={loading}
              >
                <Mic className="w-4 h-4" />
                Parle-moi
              </Button>
              <p className="text-muted-foreground/50 text-[11px] font-sans mt-2">
                🎤 Essayez : « Un film drôle sur Netflix »
              </p>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-row gap-3 items-center">
              <Button
                variant="heroOutline"
                size="xl"
                className="text-sm md:text-base"
                onClick={handleStart}
                disabled={isLoading || loading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Trouver mon film
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="xl"
                className="text-sm md:text-base text-foreground/60 hover:text-foreground border border-border/30 hover:border-primary/40 hover:bg-primary/5"
                onClick={handleSurprise}
                disabled={loading}
              >
                <Wand2 className="w-4 h-4" />
                Surprends-moi
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
