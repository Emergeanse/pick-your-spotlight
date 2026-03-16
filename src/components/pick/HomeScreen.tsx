import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, Dices, Tv, Sparkles, Loader2, Zap, X, Flame, Target, Trophy, Shuffle } from "lucide-react";
import { getTrendingMovies, getBackdropUrl, getSurpriseRecommendation, getPosterUrl, getDisplayTitle, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeUserTasteVector } from "@/lib/taste-engine";
import { getEngagementData, getProgressionMessage, getStreakLabel, type EngagementData } from "@/lib/engagement";
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
  "Hmm, voyons voir…",
  "Laisse-moi une seconde, je tiens quelque chose.",
  "Ooh, j'ai peut-être LA pépite.",
  "Je fais le tri dans mes coups de cœur…",
  "Celui-ci pourrait bien te scotcher.",
  "Patience, la magie opère…",
  "Je consulte ma mémoire cinématographique…",
  "Accroche-toi, ça arrive !",
];

const LOADING_MESSAGES = [
  "Je cherche la perle rare…",
  "Voyons voir ce que j'ai pour toi…",
  "Attends, j'ai peut-être le film parfait.",
  "Je parcours mes favoris…",
  "Laisse-moi réfléchir deux secondes…",
  "Je fouille dans ma cinémathèque…",
  "Un instant, je fais chauffer mes neurones.",
  "C'est presque prêt, promis !",
  "Je compare quelques options pour toi…",
  "Hmm, difficile de choisir, t'as bon goût !",
  "J'affine ma sélection…",
  "Encore un petit moment, ça va valoir le coup.",
  "Je suis en train de te concocter un truc sympa.",
  "Ça cogite sévère de mon côté !",
];

const PROACTIVE_MESSAGES = [
  "J'ai peut-être le film parfait pour ce soir.",
  "Tiens, j'ai pensé à un truc qui devrait te plaire.",
  "Avant que tu choisisses… regarde celui-là.",
  "J'ai une idée pour toi ce soir.",
  "Psst… j'ai trouvé quelque chose.",
  "Tu vas me remercier pour celui-là.",
  "J'ai une suggestion qui te correspond bien.",
  "Celui-ci a ton nom écrit dessus.",
  "Je crois que j'ai trouvé ta soirée.",
  "Attends de voir ce que j'ai déniché…",
  "Je parie que tu vas adorer celui-là.",
  "J'ai un petit pressentiment sur ce film…",
  "Regarde ce que j'ai trouvé en fouillant pour toi.",
  "Ce film-là, c'est du sur-mesure pour toi.",
  "Un petit bijou juste pour toi ce soir.",
];

const HomeScreen = ({ onStart, onOpenChat, onSurprise, onMovieSelect, loading }: HomeScreenProps) => {
  const [isSurprising, setIsSurprising] = useState(false);
  const [surpriseMsg, setSurpriseMsg] = useState("");
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  
  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [tonightProviders, setTonightProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [proactivePick, setProactivePick] = useState<MovieDetail | null>(null);
  const [proactiveMsg] = useState(() => PROACTIVE_MESSAGES[Math.floor(Math.random() * PROACTIVE_MESSAGES.length)]);
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  
  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const [userExcludedPlatformIds, setUserExcludedPlatformIds] = useState<number[]>([]);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [userExcludedGenres, setUserExcludedGenres] = useState<string[]>([]);
  const [userMinRating, setUserMinRating] = useState<number>(0);
  
  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [progressionMsg, setProgressionMsg] = useState<string | null>(null);
  const { user } = useAuth();

  // Load engagement data
  useEffect(() => {
    if (!user) return;
    getEngagementData(user.id).then(data => {
      if (data) {
        setEngagement(data);
        setProgressionMsg(getProgressionMessage(data));
      }
    });
  }, [user]);

  // Load user's full profile preferences
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.preferred_platforms) setUserPlatformIds(data.preferred_platforms);
        if ((data as any)?.excluded_platforms) setUserExcludedPlatformIds((data as any).excluded_platforms);
        if (data?.favorite_genres) setUserGenres(data.favorite_genres);
        if ((data as any)?.excluded_genres) setUserExcludedGenres((data as any).excluded_genres);
        if ((data as any)?.min_rating) setUserMinRating((data as any).min_rating);
      });
  }, [user]);

  // Helper: invoke surprise-personalized with retry on 429
  const invokeSurprisePersonalized = async (body: any, retries = 2): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });
    if (error) {
      // Check if it's a rate limit (429) - retry after delay
      const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
      if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
        return invokeSurprisePersonalized(body, retries - 1);
      }
      throw error;
    }
    return data;
  };

  // Proactive recommendation — silently fetch for users with taste data (delayed to avoid rate limits)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const liked = await getLikedMovies();
        if (liked.length < 3) return;
        const userTasteVector = await computeUserTasteVector(user.id);
        const data = await invokeSurprisePersonalized({
          likedMovies: liked, userTasteVector, platformIds: userPlatformIds, excludedPlatformIds: userExcludedPlatformIds, excludedGenres: userExcludedGenres, minRating: userMinRating,
        });
        if (!cancelled) setProactivePick(data.movie as MovieDetail);
      } catch {
        // Silently fail — proactive is optional
      }
    }, 3000); // 3s delay to avoid competing with other AI calls
    return () => { cancelled = true; clearTimeout(timer); };
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
          const data = await invokeSurprisePersonalized({
            likedMovies: liked, userTasteVector, platformIds: userPlatformIds, excludedPlatformIds: userExcludedPlatformIds, excludedGenres: userExcludedGenres, minRating: userMinRating,
            outOfComfortZone: true,
          });
          movie = data.movie as MovieDetail;
          // Tag as comfort zone exit
          (movie as any)._surpriseComfortZone = true;
        } else {
          movie = await getSurpriseRecommendation([], { platformIds: userPlatformIds, minRating: userMinRating, excludedGenres: userExcludedGenres });
        }
      } else {
        movie = await getSurpriseRecommendation([], { platformIds: userPlatformIds, minRating: userMinRating, excludedGenres: userExcludedGenres });
      }

      clearInterval(msgInterval);
      setSurpriseMsg("✨ Trouvé !");
      await new Promise(r => setTimeout(r, 400));
      onSurprise(movie);
    } catch (e) {
      console.error(e);
      try {
        const movie = await getSurpriseRecommendation([], { platformIds: userPlatformIds, minRating: userMinRating, excludedGenres: userExcludedGenres });
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

  const generateTonightPick = async (excludeList: number[] = rejectedIds, rejectionContext?: { reason: string; rejectedGenres: string[]; rejectedTitle: string }) => {
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
          const data = await invokeSurprisePersonalized({
            likedMovies: liked, userTasteVector, platformIds: userPlatformIds, excludedPlatformIds: userExcludedPlatformIds, excludedGenres: userExcludedGenres, minRating: userMinRating, excludeIds: excludeList, rejectionContext,
          });
          movie = data.movie as MovieDetail;
        } else {
          movie = await getSurpriseRecommendation(excludeList, { platformIds: userPlatformIds, minRating: userMinRating, excludedGenres: userExcludedGenres });
        }
      } else {
        movie = await getSurpriseRecommendation(excludeList, { platformIds: userPlatformIds, minRating: userMinRating, excludedGenres: userExcludedGenres });
      }
      clearInterval(msgInterval);
      setTonightPick(movie);
      const mediaType = movie.first_air_date ? "tv" : "movie";
      getWatchProviders(movie.id, mediaType).then(setTonightProviders).catch(() => {});
    } catch (e) {
      console.error(e);
      try {
        const movie = await getSurpriseRecommendation(excludeList, { platformIds: userPlatformIds, minRating: userMinRating, excludedGenres: userExcludedGenres });
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
    setRejectedIds([]);
    setTonightPick(null);
    generateTonightPick([]);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <BrandHeader />


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
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
      <div className="absolute inset-0 bg-background/30" />

      {/* Scrollable content */}
      <div className="relative z-10 h-full overflow-y-auto">
        {/* Hero section */}
        <div className="min-h-[85vh] md:min-h-[80vh] flex flex-col items-center justify-center text-center px-5 pt-16">
          
          {/* Engagement banner — streaks & progression */}
          {engagement && (engagement.streakCount >= 2 || progressionMsg) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="w-full max-w-md px-2 mb-4"
            >
              <div className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-primary/8 border border-primary/15">
                {engagement.streakCount >= 2 && (
                  <div className="flex items-center gap-1.5">
                    {engagement.streakCount >= 10 ? <Trophy className="w-4 h-4 text-primary" /> :
                     engagement.streakCount >= 5 ? <Target className="w-4 h-4 text-primary" /> :
                     <Flame className="w-4 h-4 text-primary" />}
                    <span className="text-primary text-[12px] font-sans font-semibold">
                      {getStreakLabel(engagement.streakCount)}
                    </span>
                  </div>
                )}
                {engagement.profileConfidence > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${engagement.profileConfidence}%` }} />
                    </div>
                    <span className="text-foreground/40 text-[10px] font-sans">{engagement.profileConfidence}%</span>
                  </div>
                )}
              </div>
              {progressionMsg && (
                <p className="text-center text-foreground/50 text-[11px] font-sans mt-1.5">
                  {progressionMsg}
                </p>
              )}
            </motion.div>
          )}

          {/* Pick character + greeting or proactive suggestion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 md:mb-8"
          >
            {proactivePick && !proactiveDismissed ? (
              <PickCharacter mood="default" message={proactiveMsg} size="md" animate />
            ) : (
              <PickCharacter mood="wave" showGreeting size="md" animate />
            )}
          </motion.div>

          {/* Proactive recommendation card */}
          <AnimatePresence>
            {proactivePick && !proactiveDismissed && !isSurprising && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 180 }}
                className="w-full max-w-md px-2 mb-6"
              >
                <div className="relative rounded-2xl overflow-hidden border border-gold/25 bg-card/70 backdrop-blur-md shadow-xl">
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
                      <p className="text-[10px] uppercase tracking-widest text-gold/70 font-sans font-semibold mb-1">
                        ✨ Pick du soir
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
                          Je découvre
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
              <div className="flex flex-col items-center gap-4">

                {/* 1. Pick pour ce soir - PRIMARY CTA */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTonightPick}
                  disabled={loading || tonightLoading}
                  className="group w-full text-left rounded-2xl p-5 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border-2 border-primary/40 hover:border-primary/60 hover:from-primary/20 transition-all disabled:opacity-50 relative overflow-hidden"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/25 border border-primary/40 flex items-center justify-center shrink-0 group-hover:bg-primary/35 transition-colors shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)]">
                      <Zap className="w-5 h-5 text-primary fill-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-sans font-semibold text-foreground mb-0.5">Pick pour ce soir</h3>
                      <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">
                        Une suggestion sur-mesure pour ta soirée.
                      </p>
                    </div>
                  </div>
                </motion.button>

                {/* 2. Parle à Pick - natural language */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenChat}
                  disabled={loading}
                  className="group relative w-full text-left rounded-2xl p-5 bg-gradient-to-r from-primary/10 to-transparent border-2 border-primary/30 hover:border-primary/50 hover:from-primary/15 transition-all"
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

                {/* 3. Surprends-moi — out of comfort zone */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSurprise}
                  disabled={loading || isSurprising}
                  className="group relative w-full text-left rounded-2xl p-4 bg-foreground/[0.03] border border-border/20 hover:border-primary/30 hover:bg-primary/[0.04] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-foreground/[0.06] border border-border/15 flex items-center justify-center shrink-0 group-hover:bg-primary/15 group-hover:border-primary/25 transition-colors">
                      <Shuffle className="w-4 h-4 text-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-sans font-semibold text-foreground mb-0.5">Surprends-moi</h3>
                      <p className="text-foreground/40 text-[12px] font-sans leading-relaxed">
                        Un film hors de tes habitudes, mais qui pourrait te plaire.
                      </p>
                    </div>
                  </div>
                </motion.button>

              </div>




              {/* Platform logos */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-6 flex flex-col items-center gap-2.5"
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
                    Je découvre
                  </Button>

                   <Button
                    variant="ghost"
                    size="lg"
                    className="rounded-full border border-border/30 text-foreground/50 hover:text-foreground hover:border-border/50 font-sans font-medium px-5 h-11 gap-2 text-sm transition-all active:scale-[0.97]"
                    onClick={() => {
                      const nextRejected = tonightPick ? [...rejectedIds, tonightPick.id] : rejectedIds;
                      const rejContext = tonightPick ? {
                        reason: "not_my_style" as const,
                        rejectedGenres: (tonightPick.genres || []).map(g => g.name),
                        rejectedTitle: getDisplayTitle(tonightPick),
                      } : undefined;
                      setRejectedIds(nextRejected);
                      setTonightPick(null);
                      generateTonightPick(nextRejected, rejContext);
                    }}
                    disabled={tonightLoading}
                  >
                    {tonightLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Dices className="w-4 h-4" />
                    )}
                    Autre suggestion
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
