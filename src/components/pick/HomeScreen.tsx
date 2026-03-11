import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, Wand2, SlidersHorizontal, Dices } from "lucide-react";
import { getTrendingMovies, getBackdropUrl, getSurpriseRecommendation } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeUserTasteVector } from "@/lib/taste-engine";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";
import DiscoverySection from "./DiscoverySection";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onSurprise: (movie: MovieDetail) => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
}

const SURPRISE_MESSAGES = [
  "Analyse de tes goûts…",
  "Parcours des pépites cachées…",
  "Un peu de magie…",
  "Presque prêt…",
];

const HomeScreen = ({ onStart, onOpenChat, onSurprise, onMovieSelect, loading }: HomeScreenProps) => {
  const [isSurprising, setIsSurprising] = useState(false);
  const [surpriseMsg, setSurpriseMsg] = useState("");
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const { user } = useAuth();

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

  const handleSurprise = async () => {
    setIsSurprising(true);
    let msgIndex = 0;
    setSurpriseMsg(SURPRISE_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIndex++;
      if (msgIndex < SURPRISE_MESSAGES.length) {
        setSurpriseMsg(SURPRISE_MESSAGES[msgIndex]);
      }
    }, 500);

    try {
      let movie: MovieDetail;

      if (user) {
        const liked = await getLikedMovies();
        if (liked.length >= 2) {
          const userTasteVector = await computeUserTasteVector(user.id);
          const { data, error } = await supabase.functions.invoke("surprise-personalized", {
            body: { likedMovies: liked, userTasteVector },
          });
          if (error) throw error;
          movie = data.movie as MovieDetail;
        } else {
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
      <BrandHeader showDiscoveryToggle onToggleDiscovery={() => setShowDiscovery(v => !v)} discoveryOpen={showDiscovery} />

      {/* Background slideshow */}
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
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
      <div className="absolute inset-0 bg-background/30" />

      {/* Scrollable content */}
      <div className="relative z-10 h-full overflow-y-auto">
        {/* Hero section */}
        <div className="min-h-[85vh] md:min-h-[80vh] flex flex-col items-center justify-center text-center px-5 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="max-w-md"
          >
            <h1 className="text-3xl md:text-6xl lg:text-7xl font-serif mb-3 md:mb-4">
              Tu ne sais pas quoi regarder ?
            </h1>
            <p className="text-foreground/50 text-sm md:text-base font-sans font-light mb-8 md:mb-10 max-w-sm mx-auto">
              Décris ton envie, on trouve le film ou la série parfaite en quelques secondes.
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
              className="flex flex-col items-center gap-3"
            >
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

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-sm text-foreground/60 hover:text-foreground border border-border/30 hover:border-primary/40 hover:bg-primary/5"
                  onClick={handleSurprise}
                  disabled={loading}
                >
                  <Wand2 className="w-4 h-4" />
                  Surprends-moi
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  className="text-sm text-foreground/60 hover:text-foreground border border-border/30 hover:border-primary/40 hover:bg-primary/5"
                  onClick={onStart}
                  disabled={loading}
                >
                  <Compass className="w-4 h-4" />
                  Guidé
                </Button>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col items-center gap-2.5 mt-2"
              >
                <div className="flex items-center gap-2">
                  {[
                    { logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg", name: "Netflix" },
                    { logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg", name: "Prime" },
                    { logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg", name: "Disney+" },
                    { logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg", name: "Apple TV+" },
                    { logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg", name: "Max" },
                  ].map((p) => (
                    <img
                      key={p.name}
                      src={p.logo}
                      alt={p.name}
                      className="w-5 h-5 md:w-6 md:h-6 rounded-md object-cover opacity-50"
                      loading="lazy"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground/40 text-[10px] md:text-[11px] font-sans">
                  Compatible avec toutes les plateformes
                </p>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Discovery sections — hidden by default, toggled via header */}
        <AnimatePresence>
          {showDiscovery && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.4 }}
              className="px-5 pb-12"
            >
              <DiscoverySection onMovieSelect={onMovieSelect} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HomeScreen;
