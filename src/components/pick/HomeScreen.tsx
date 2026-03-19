import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, Dices, Tv, Sparkles, Loader2, Zap, Flame, Target, Trophy, Shuffle, Brain, Users } from "lucide-react";
import WhoStep, { type WhoOption } from "./WhoStep";
import WhatStep, { type WhatOption } from "./WhatStep";
import ExplorationStep from "./ExplorationStep";
import StepLayout from "./StepLayout";
import { getTrendingMovies, getBackdropUrl, getSurpriseRecommendation, getPosterUrl, getDisplayTitle, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeUserTasteVector } from "@/lib/taste-engine";
import { getEngagementData, getProgressionMessage, getStreakLabel, type EngagementData } from "@/lib/engagement";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";
import TasteTrainer from "./TasteTrainer";
import TrainingProgress from "./TrainingProgress";

import { useNavigate } from "react-router-dom";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onSurprise: (movie: MovieDetail) => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
  openTrainerOnMount?: boolean;
  onTrainerOpened?: () => void;
  isActivation?: boolean;
  onActivationComplete?: () => void;
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
  "Attends, j'ai peut-être la perle parfaite.",
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
   "J'ai peut-être la recommandation parfaite pour ce soir.",
  "Tiens, j'ai pensé à un truc qui devrait te plaire.",
  "Avant que tu choisisses… regarde celui-là.",
  "J'ai une idée pour toi ce soir.",
  "Psst… j'ai trouvé quelque chose.",
  "Tu vas me remercier pour celui-là.",
  "J'ai une suggestion qui te correspond bien.",
  "Celui-ci a ton nom écrit dessus.",
  "Je crois que j'ai trouvé ta soirée.",
  "Attends de voir ce que j'ai déniché…",
  "Je parie que tu vas adorer.",
  "J'ai un petit pressentiment sur celui-là…",
  "Regarde ce que j'ai trouvé en fouillant pour toi.",
  "Du sur-mesure pour toi.",
  "Un petit bijou juste pour toi ce soir.",
];

const HomeScreen = ({ onStart, onOpenChat, onSurprise, onMovieSelect, loading, openTrainerOnMount, onTrainerOpened, isActivation, onActivationComplete }: HomeScreenProps) => {
  const navigate = useNavigate();
  const [isSurprising, setIsSurprising] = useState(false);
  const [surpriseMsg, setSurpriseMsg] = useState("");
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  
  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [tonightProviders, setTonightProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [pickAnimating, setPickAnimating] = useState(false);
  
  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const [userExcludedPlatformIds, setUserExcludedPlatformIds] = useState<number[]>([]);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [userExcludedGenres, setUserExcludedGenres] = useState<string[]>([]);
  const [userMinRating, setUserMinRating] = useState<number>(0);
  
  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [progressionMsg, setProgressionMsg] = useState<string | null>(null);
  const [historyExcludeIds, setHistoryExcludeIds] = useState<number[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);
  const [flowStep, setFlowStep] = useState<"idle" | "who" | "what" | "exploration">("idle");
  const [explorationLevel, setExplorationLevel] = useState<number>(5);
  const [whatChoice, setWhatChoice] = useState<WhatOption>("both");
  const [whoChoice, setWhoChoice] = useState<WhoOption | null>(null);
  const [totalEvaluated, setTotalEvaluated] = useState(0);

  // Open trainer from MyCinema navigation or activation flow
  useEffect(() => {
    if (openTrainerOnMount) {
      setShowTrainer(true);
      onTrainerOpened?.();
    }
    }
  }, [openTrainerOnMount]);
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

  // Load user's full profile preferences + interaction history for exclusion
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
    // Load interaction history (all types) to avoid repeats
    supabase.from("user_interactions")
      .select("tmdb_id")
      .eq("user_id", user.id)
      .in("action_type", ["watched", "skipped", "already_seen", "liked", "unsure"])
      .limit(500)
      .then(({ data }) => {
        if (data) {
          const ids = [...new Set(data.map(d => d.tmdb_id))];
          setHistoryExcludeIds(ids);
        }
      });
  }, [user]);

  // Helper: invoke surprise-personalized with retry on 429
  const invokeSurprisePersonalized = async (body: any, retries = 2): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });
    if (error) {
      const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
      if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
        return invokeSurprisePersonalized(body, retries - 1);
      }
      throw error;
    }
    return data;
  };




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
          const [userTasteVector, tasteProfile] = await Promise.all([
            computeUserTasteVector(user.id),
            getUserTasteProfile(),
          ]);
          const data = await invokeSurprisePersonalized({
            likedMovies: liked, userTasteVector, tasteProfile,
            platformIds: userPlatformIds, excludedPlatformIds: userExcludedPlatformIds, excludedGenres: userExcludedGenres, minRating: userMinRating,
            outOfComfortZone: true, excludeIds: historyExcludeIds,
          });
          movie = data.movie as MovieDetail;
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
    const allExcludeIds = [...new Set([...excludeList, ...historyExcludeIds])];
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
          const [userTasteVector, tasteProfile] = await Promise.all([
            computeUserTasteVector(user.id),
            getUserTasteProfile(),
          ]);
          const data = await invokeSurprisePersonalized({
            likedMovies: liked, userTasteVector, tasteProfile,
            platformIds: userPlatformIds, excludedPlatformIds: userExcludedPlatformIds, excludedGenres: userExcludedGenres, minRating: userMinRating, excludeIds: allExcludeIds, rejectionContext,
            explorationLevel,
            mediaType: whatChoice,
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
    // Don't reset rejectedIds — keep excluding previously rejected movies
    setTonightPick(null);
    generateTonightPick(rejectedIds);
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
          


          {/* Pick character + greeting */}
          {!isSurprising && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-6 md:mb-8"
            >
              <PickCharacter mood="wave" showGreeting size="md" animate />
            </motion.div>
          )}

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
              {/* Three main actions */}
              <div className="flex flex-col items-center gap-4">

                {/* 1. Pick pour ce soir — with popcorn animation */}
                <motion.button
                  data-tour="pick-ce-soir"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setPickAnimating(true);
                    setTimeout(() => setPickAnimating(false), 900);
                    setFlowStep("who");
                  }}
                  disabled={loading || tonightLoading || flowStep !== "idle"}
                  className="group w-full text-left rounded-2xl p-5 bg-gradient-to-br from-primary/20 via-primary/15 to-accent/10 border-2 border-primary/50 hover:border-primary/70 hover:from-primary/25 transition-all disabled:opacity-50 relative overflow-hidden shadow-[0_0_30px_-8px_hsl(var(--primary)/0.35)]"
                >
                  {/* Popcorn burst animation on click */}
                  <AnimatePresence>
                    {pickAnimating && (
                      <>
                        {["🍿", "🎬", "🎥", "✨", "🍿"].map((emoji, i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 1, scale: 0.5, x: 0, y: 0 }}
                            animate={{
                              opacity: 0,
                              scale: 1.2,
                              x: (i - 2) * 40 + (Math.random() - 0.5) * 30,
                              y: -60 - Math.random() * 40,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.7, delay: i * 0.06, ease: "easeOut" }}
                            className="absolute left-1/2 top-1/2 text-lg pointer-events-none z-20"
                          >
                            {emoji}
                          </motion.span>
                        ))}
                      </>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-4">
                    <motion.div
                      animate={pickAnimating ? { rotate: [0, -10, 10, -5, 0], scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.5 }}
                      className="w-12 h-12 rounded-xl bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/40 transition-colors shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)]"
                    >
                      <span className="text-xl">🍿</span>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-sans font-bold text-foreground mb-0.5">Pick pour ce soir</h3>
                      <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">
                        Une suggestion sur-mesure pour ta soirée.
                      </p>
                    </div>
                  </div>
                </motion.button>

                {/* 2. Parle à Pick */}
                <motion.button
                  data-tour="parle-a-pick"
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

      {/* Tonight loading overlay */}
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
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${getBackdropUrl(tonightPick.backdrop_path) || getPosterUrl(tonightPick.poster_path, "w780")})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />

            <div className="relative z-10 flex justify-between items-center px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
              <button
                onClick={() => setTonightPick(null)}
                className="text-foreground/50 hover:text-foreground text-xs font-sans transition-colors"
              >
                ← Retour
              </button>
            </div>

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

                <p className="text-foreground/40 text-[13px] font-sans italic mb-4">
                  Pick pense que {tonightPick.first_air_date ? "cette série est parfaite" : "ce film est parfait"} pour toi.
                </p>

                <div className="flex flex-col items-center gap-4 w-full">
                  <Button
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-8 h-12 gap-2 text-base neon-glow transition-all active:scale-[0.97] w-full max-w-xs"
                    onClick={() => {
                      onSurprise(tonightPick);
                      setTonightPick(null);
                    }}
                  >
                    <Tv className="w-5 h-5" />
                    On regarde ?
                  </Button>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        if (!tonightPick) return;
                        trackInteraction(tonightPick.id, "skipped", {
                          reason: "not_my_style",
                          genres: (tonightPick.genres || []).map(g => g.name),
                        });
                        const nextRejected = [...rejectedIds, tonightPick.id];
                        const rejContext = {
                          reason: "not_my_style" as const,
                          rejectedGenres: (tonightPick.genres || []).map(g => g.name),
                          rejectedTitle: getDisplayTitle(tonightPick),
                        };
                        setRejectedIds(nextRejected);
                        setTonightPick(null);
                        generateTonightPick(nextRejected, rejContext);
                      }}
                      disabled={tonightLoading}
                      className="text-foreground/40 text-[12px] font-sans hover:text-foreground/60 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {tonightLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Dices className="w-3 h-3" />
                      )}
                      Autre suggestion
                    </button>

                    <span className="text-foreground/15 text-[10px]">·</span>

                    <button
                      onClick={() => {
                        if (!tonightPick) return;
                        trackInteraction(tonightPick.id, "already_seen", {});
                        const nextRejected = [...rejectedIds, tonightPick.id];
                        setRejectedIds(nextRejected);
                        setTonightPick(null);
                        generateTonightPick(nextRejected, {
                          reason: "already_seen",
                          rejectedGenres: (tonightPick.genres || []).map(g => g.name),
                          rejectedTitle: getDisplayTitle(tonightPick),
                        });
                      }}
                      disabled={tonightLoading}
                      className="text-foreground/35 text-[12px] font-sans hover:text-foreground/60 transition-colors disabled:opacity-50"
                    >
                      Déjà vu
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Who/What flow overlay */}
      <AnimatePresence mode="wait">
        {flowStep !== "idle" && (
          <motion.div
            key={flowStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background"
          >
            <BrandHeader showBack onBack={() => { setFlowStep("idle"); setWhoChoice(null); }} />
            <StepLayout currentStep={flowStep === "who" ? 1 : flowStep === "what" ? 2 : 3} totalSteps={3}>
              {flowStep === "who" && (
                <WhoStep onSelect={(w) => {
                  setWhoChoice(w);
                  if (w === "duo" || w === "group") {
                    setFlowStep("idle");
                    setWhoChoice(null);
                    navigate("/app/pick-together");
                    return;
                  }
                  setFlowStep("what");
                }} />
              )}
              {flowStep === "what" && (
                <WhatStep onSelect={(w) => {
                  setWhatChoice(w);
                  setFlowStep("exploration");
                }} />
              )}
              {flowStep === "exploration" && (
                <ExplorationStep onSelect={(level) => {
                  setExplorationLevel(level);
                  setFlowStep("idle");
                  setTonightPick(null);
                  generateTonightPick(rejectedIds);
                }} />
              )}
            </StepLayout>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Taste Trainer overlay */}
      <AnimatePresence>
        {showTrainer && (
          <TasteTrainer onClose={() => setShowTrainer(false)} />
        )}
      </AnimatePresence>

    </div>
  );
};

export default HomeScreen;
