import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, SlidersHorizontal, Dices, Tv, ThumbsDown, Sparkles, Loader2, Zap, X, Bookmark } from "lucide-react";
import { getTrendingMovies, getBackdropUrl, getSurpriseRecommendation, getPosterUrl, getDisplayTitle, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { getWatchlist } from "@/lib/watchlist";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeUserTasteVector } from "@/lib/taste-engine";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";
import DiscoverySection from "./DiscoverySection";
import PickCharacter from "./PickCharacter";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onSurprise: (movie: MovieDetail) => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
}

const SURPRISE_MESSAGES = [
  "Je fouille dans mes classiques…",
  "Attends, j'ai un truc en tête…",
  "Tu vas voir, celui-là est dingue.",
  "Presque… je peaufine mon choix.",
];

const LOADING_MESSAGES = [
  "Je cherche la perle rare…",
  "Voyons voir ce que j'ai pour toi…",
  "Attends, j'ai peut-être le film parfait.",
  "Je parcours mes favoris…",
  "Laisse-moi réfléchir deux secondes…",
];

const PROACTIVE_MESSAGES = [
  "J'ai peut-être le film parfait pour ce soir.",
  "Tiens, j'ai pensé à un truc qui devrait te plaire.",
  "Avant que tu choisisses… regarde celui-là.",
  "J'ai une idée pour toi ce soir.",
];

const HomeScreen = ({ onStart, onOpenChat, onSurprise, onMovieSelect, loading }: HomeScreenProps) => {
  const [isSurprising, setIsSurprising] = useState(false);
  const [surpriseMsg, setSurpriseMsg] = useState("");
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [tonightProviders, setTonightProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [proactivePick, setProactivePick] = useState<MovieDetail | null>(null);
  const [proactiveMsg] = useState(() => PROACTIVE_MESSAGES[Math.floor(Math.random() * PROACTIVE_MESSAGES.length)]);
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const { user } = useAuth();

  // Load user's preferred platforms
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_platforms").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.preferred_platforms) {
          setUserPlatformIds(data.preferred_platforms);
        }
      });
  }, [user]);

  // Proactive recommendation — silently fetch for users with taste data
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const liked = await getLikedMovies();
        if (liked.length < 3) return; // Need enough taste data
        const userTasteVector = await computeUserTasteVector(user.id);
        const { data, error } = await supabase.functions.invoke("surprise-personalized", {
          body: { likedMovies: liked, userTasteVector, platformIds: userPlatformIds },
        });
        if (error || cancelled) return;
        setProactivePick(data.movie as MovieDetail);
      } catch {
        // Silently fail — proactive is optional
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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
            body: { likedMovies: liked, userTasteVector, platformIds: userPlatformIds },
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

  const generateTonightPick = async () => {
    setTonightLoading(true);
    setTonightProviders([]);
    let msgIndex = 0;
    setTonightLoadingMsg(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setTonightLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2000);

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
      setTonightPick(movie);
      const mediaType = movie.first_air_date ? "tv" : "movie";
      getWatchProviders(movie.id, mediaType).then(setTonightProviders).catch(() => {});
    } catch (e) {
      console.error(e);
      try {
        const movie = await getSurpriseRecommendation();
        clearInterval(msgInterval);
        setTonightPick(movie);
        const mediaType = movie.first_air_date ? "tv" : "movie";
        getWatchProviders(movie.id, mediaType).then(setTonightProviders).catch(() => {});
      } catch {
        clearInterval(msgInterval);
      }
    } finally {
      setTonightLoading(false);
      setTonightLoadingMsg("");
    }
  };

  const handleTonightPick = () => {
    setTonightPick(null);
    generateTonightPick();
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
          
          {/* Pick character + greeting or proactive suggestion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 md:mb-8"
          >
            {proactivePick && !proactiveDismissed ? (
              <PickCharacter mood="default" message={proactiveMsg} size="md" animate speakable />
            ) : (
              <PickCharacter mood="wave" showGreeting size="md" animate speakable />
            )}
          </motion.div>

          {/* Proactive recommendation card */}
          <AnimatePresence>
            {proactivePick && !proactiveDismissed && !isSurprising && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ delay: 0.3, duration: 0.4, type: "spring", stiffness: 200 }}
                className="w-full max-w-md px-2 mb-6"
              >
                <div className="relative rounded-2xl overflow-hidden border border-primary/25 bg-card/60 backdrop-blur-sm">
                  {/* Mini backdrop */}
                  {proactivePick.backdrop_path && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-20"
                      style={{ backgroundImage: `url(${getBackdropUrl(proactivePick.backdrop_path)})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-card/90 via-card/70 to-card/50" />

                  <div className="relative z-10 flex items-center gap-4 p-4">
                    {/* Poster */}
                    {proactivePick.poster_path && (
                      <img
                        src={getPosterUrl(proactivePick.poster_path, "w185") || ""}
                        alt={getDisplayTitle(proactivePick)}
                        className="w-16 h-24 rounded-lg object-cover shadow-lg border border-border/20 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold mb-1">
                        Pick du soir
                      </p>
                      <h3 className="text-sm font-serif text-foreground mb-0.5 line-clamp-1">
                        {getDisplayTitle(proactivePick)}
                      </h3>
                      {proactivePick.genres && (
                        <p className="text-foreground/40 text-[10px] font-sans line-clamp-1">
                          {proactivePick.genres.map(g => g.name).join(" · ")}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => { onSurprise(proactivePick); setProactiveDismissed(true); }}
                          className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-sans font-semibold hover:bg-primary/90 transition-colors active:scale-95"
                        >
                          Je regarde
                        </button>
                        <button
                          onClick={() => { setProactiveDismissed(true); handleTonightPick(); }}
                          className="px-3 py-1.5 rounded-full bg-foreground/[0.06] border border-border/25 text-foreground/50 text-[11px] font-sans hover:text-foreground hover:border-border/40 transition-all active:scale-95"
                        >
                          Autre chose
                        </button>
                        <button
                          onClick={() => setProactiveDismissed(true)}
                          className="ml-auto text-foreground/25 hover:text-foreground/50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isSurprising ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <PickCharacter mood="think" message={surpriseMsg} size="md" animate={false} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="w-full max-w-lg px-2"
            >
              {/* Three main actions - full width cards */}
              <div className="flex flex-col gap-3">
                
                {/* 1. Pick pour ce soir - instant */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTonightPick}
                  disabled={loading || tonightLoading}
                  className="group relative text-left rounded-2xl p-5 bg-gradient-to-r from-primary/20 to-primary/5 border-2 border-primary/40 hover:border-primary/60 hover:from-primary/25 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/25 border border-primary/30 flex items-center justify-center shrink-0 group-hover:bg-primary/35 transition-colors">
                      {tonightLoading ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      ) : (
                        <Zap className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-sans font-semibold text-foreground mb-1">⚡ Pick pour ce soir</h3>
                      <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">
                        Je te trouve un film immédiatement.
                      </p>
                    </div>
                  </div>
                </motion.button>

                {/* 2. Parle à Pick - natural language */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenChat}
                  disabled={loading}
                  className="group relative text-left rounded-2xl p-5 bg-gradient-to-r from-primary/10 to-transparent border-2 border-primary/30 hover:border-primary/50 hover:from-primary/15 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 group-hover:bg-primary/30 transition-colors">
                      <Mic className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-sans font-semibold text-foreground mb-1">🎙 Parle à Pick</h3>
                      <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">
                        Dis-moi ce que tu veux regarder.
                      </p>
                    </div>
                  </div>
                </motion.button>

                {/* 3. Je veux choisir - guided */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onStart}
                  disabled={loading}
                  className="group relative text-left rounded-2xl p-5 bg-foreground/[0.03] border-2 border-border/40 hover:border-primary/40 hover:bg-foreground/[0.06] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-foreground/[0.08] border border-border/30 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                      <SlidersHorizontal className="w-5 h-5 text-foreground/60 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-sans font-semibold text-foreground mb-1">🎬 Je veux choisir</h3>
                      <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">
                        Je te pose quelques questions rapides.
                      </p>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Surprise option - more subtle, below */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 flex justify-center"
              >
                <button
                  onClick={handleSurprise}
                  disabled={loading}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-foreground/[0.03] border border-border/30 hover:border-primary/30 hover:bg-foreground/[0.06] transition-all text-sm font-sans text-foreground/60 hover:text-foreground"
                >
                  <Dices className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
                  <span>Surprise-moi</span>
                </button>
              </motion.div>

              {/* Platform logos */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-8 flex flex-col items-center gap-2.5"
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

      {/* Tonight loading overlay with Pick */}
      <AnimatePresence>
        {tonightLoading && !tonightPick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
            <div className="relative z-10 flex flex-col items-center">
              <PickCharacter mood="think" message={tonightLoadingMsg} size="md" animate />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tonight's Pick overlay */}
      <AnimatePresence>
        {tonightPick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col"
          >
            {/* Background */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${getBackdropUrl(tonightPick.backdrop_path) || getPosterUrl(tonightPick.poster_path, "w780")})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />

            {/* Close */}
            <div className="relative z-10 flex justify-between items-center px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
              <button
                onClick={() => setTonightPick(null)}
                className="text-foreground/50 hover:text-foreground text-xs font-sans transition-colors"
              >
                ← Retour
              </button>
            </div>

            {/* Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center text-center max-w-sm"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 mb-4">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-primary text-[11px] font-sans font-semibold">Tonight's Pick</span>
                </div>

                {/* Poster */}
                {tonightPick.poster_path && (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    src={getPosterUrl(tonightPick.poster_path, "w342") || ""}
                    alt={getDisplayTitle(tonightPick)}
                    className="w-36 h-52 md:w-44 md:h-64 rounded-xl object-cover shadow-2xl border border-border/20 mb-4"
                  />
                )}

                <h2 className="text-xl md:text-2xl font-serif text-foreground mb-1">
                  {getDisplayTitle(tonightPick)}
                </h2>

                {tonightPick.genres && (
                  <p className="text-primary/60 text-[10px] tracking-[0.12em] uppercase font-sans font-medium mb-2">
                    {tonightPick.genres.map(g => g.name).join(" · ")}
                  </p>
                )}

                {/* Platforms */}
                {tonightProviders.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-foreground/30 text-[10px] font-sans">Dispo sur</span>
                    <div className="flex gap-1.5">
                      {tonightProviders.map((p) => (
                        <img
                          key={p.name}
                          src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                          alt={p.name}
                          className="w-5 h-5 rounded-md object-cover border border-border/20"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {tonightPick.overview && (
                  <p className="text-foreground/50 text-[12px] font-sans leading-relaxed line-clamp-3 mb-6">
                    {tonightPick.overview}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 w-full justify-center">
                  <Button
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-6 h-11 gap-2 text-sm neon-glow transition-all active:scale-[0.97]"
                    onClick={() => {
                      onSurprise(tonightPick);
                      setTonightPick(null);
                    }}
                  >
                    <Tv className="w-4 h-4" />
                    Je regarde
                  </Button>

                  <Button
                    variant="ghost"
                    size="lg"
                    className="rounded-full border border-border/30 text-foreground/50 hover:text-foreground hover:border-border/50 font-sans font-medium px-5 h-11 gap-2 text-sm transition-all active:scale-[0.97]"
                    onClick={() => {
                      setTonightPick(null);
                      generateTonightPick();
                    }}
                    disabled={tonightLoading}
                  >
                    {tonightLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="w-4 h-4" />
                    )}
                    Pas pour moi
                  </Button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
