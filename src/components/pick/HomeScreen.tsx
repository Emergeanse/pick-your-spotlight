import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSurpriseRecommendation, getBackdropUrl, getPosterUrl, getDisplayTitle, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeUserTasteVector } from "@/lib/taste-engine";
import type { MovieDetail } from "@/lib/tmdb";
import PickCharacter from "./PickCharacter";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onSurprise: (movie: MovieDetail) => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
}

const CHAT_PLACEHOLDERS = [
  "Dis-moi ton humeur…",
  "Un film comme Interstellar ?",
  "Quelque chose de court ce soir ?",
];

const CHIP_SUGGESTIONS = [
  "Un thriller haletant",
  "Comédie feel-good",
  "Film d'auteur récent",
  "Classique à voir absolument",
];

const HomeScreen = ({ onStart, onOpenChat, onSurprise, onMovieSelect, loading }: HomeScreenProps) => {
  const { user } = useAuth();
  const [heroPick, setHeroPick] = useState<MovieDetail | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroProviders, setHeroProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [heroExplanation, setHeroExplanation] = useState("");
  const [heroMatch, setHeroMatch] = useState(0);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [chipPair, setChipPair] = useState<string[]>([]);

  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const [userExcludedGenres, setUserExcludedGenres] = useState<string[]>([]);
  const [userMinRating, setUserMinRating] = useState(0);
  const [rejectedIds, setRejectedIds] = useState<number[]>([]);

  // Load user prefs
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_platforms, excluded_genres, min_rating").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.preferred_platforms) setUserPlatformIds(data.preferred_platforms);
        if ((data as any)?.excluded_genres) setUserExcludedGenres((data as any).excluded_genres);
        if ((data as any)?.min_rating) setUserMinRating((data as any).min_rating);
      });
  }, [user]);

  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % CHAT_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Random chip pair
  useEffect(() => {
    const shuffled = [...CHIP_SUGGESTIONS].sort(() => Math.random() - 0.5);
    setChipPair(shuffled.slice(0, 2));
  }, []);

  // Invoke surprise-personalized with retry
  const invokeSurprise = async (body: any, retries = 2): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });
    if (error) {
      const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
      if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
        return invokeSurprise(body, retries - 1);
      }
      throw error;
    }
    return data;
  };

  // Fetch hero recommendation
  const fetchHeroPick = async (excludeIds: number[] = []) => {
    setHeroLoading(true);
    try {
      let movie: MovieDetail;
      let explanation = "Pick a choisi ce film rien que pour toi.";
      let match = Math.floor(Math.random() * 15) + 80; // 80-94

      if (user) {
        const liked = await getLikedMovies();
        if (liked.length >= 2) {
          const userTasteVector = await computeUserTasteVector(user.id);
          const data = await invokeSurprise({
            likedMovies: liked,
            userTasteVector,
            platformIds: userPlatformIds,
            excludedGenres: userExcludedGenres,
            minRating: userMinRating,
            excludeIds,
          });
          movie = data.movie as MovieDetail;
          if (data.explanation) explanation = data.explanation;
          if (data.matchScore) match = data.matchScore;
        } else {
          movie = await getSurpriseRecommendation(excludeIds, {
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
          });
        }
      } else {
        movie = await getSurpriseRecommendation(excludeIds, {
          platformIds: userPlatformIds,
          minRating: userMinRating,
          excludedGenres: userExcludedGenres,
        });
      }

      setHeroPick(movie);
      setHeroExplanation(explanation);
      setHeroMatch(match);

      const mediaType = movie.first_air_date ? "tv" : "movie";
      getWatchProviders(movie.id, mediaType).then(setHeroProviders).catch(() => {});
    } catch (e) {
      console.error("Hero pick error:", e);
      try {
        const movie = await getSurpriseRecommendation(excludeIds, {
          platformIds: userPlatformIds,
          minRating: userMinRating,
          excludedGenres: userExcludedGenres,
        });
        setHeroPick(movie);
        setHeroExplanation("Pick a choisi ce film rien que pour toi.");
        setHeroMatch(Math.floor(Math.random() * 15) + 80);
        const mediaType = movie.first_air_date ? "tv" : "movie";
        getWatchProviders(movie.id, mediaType).then(setHeroProviders).catch(() => {});
      } catch {
        // silent
      }
    } finally {
      setHeroLoading(false);
    }
  };

  useEffect(() => {
    fetchHeroPick();
  }, [user, userPlatformIds]);

  const handleAnotherSuggestion = () => {
    if (heroPick) {
      const newRejected = [...rejectedIds, heroPick.id];
      setRejectedIds(newRejected);
      setHeroPick(null);
      setHeroProviders([]);
      fetchHeroPick(newRejected);
    }
  };

  const handleWatchThis = () => {
    if (heroPick) {
      onSurprise(heroPick);
    }
  };

  const bgImage = heroPick?.backdrop_path
    ? getBackdropUrl(heroPick.backdrop_path)
    : heroPick?.poster_path
      ? getPosterUrl(heroPick.poster_path, "w780")
      : null;

  return (
    <div className="relative w-full h-full overflow-y-auto">
      {/* Minimal header */}
      <div className="absolute top-0 left-0 right-0 z-30 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span className="font-serif text-lg tracking-wide text-foreground/80">Pick</span>
      </div>

      {/* Hero Block — 65% screen */}
      <div className="relative w-full" style={{ minHeight: "65vh" }}>
        {/* Background image */}
        <AnimatePresence mode="wait">
          {bgImage && (
            <motion.div
              key={bgImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${bgImage})` }}
            />
          )}
        </AnimatePresence>
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/40" />
        <div className="absolute inset-0 bg-background/20" />

        {/* Hero content */}
        <div className="relative z-10 flex flex-col justify-end h-full px-5 pb-6" style={{ minHeight: "65vh" }}>
          {heroLoading ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <PickCharacter mood="think" message="Je cherche le film parfait…" size="md" animate />
            </div>
          ) : heroPick ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Pick du soir badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 mb-3">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-primary text-[11px] font-sans font-semibold uppercase tracking-wider">Pick du soir</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2 leading-tight">
                {getDisplayTitle(heroPick)}
              </h1>

              {/* Genres */}
              {heroPick.genres && (
                <p className="text-foreground/40 text-[11px] font-sans uppercase tracking-wider mb-3">
                  {heroPick.genres.map(g => g.name).join(" · ")}
                </p>
              )}

              {/* Explanation */}
              <p className="text-foreground/60 text-[13px] font-sans leading-relaxed mb-3 max-w-md line-clamp-2">
                {heroExplanation}
              </p>

              {/* Match score + Providers */}
              <div className="flex items-center gap-3 mb-5">
                <span className="px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-[12px] font-sans font-semibold">
                  {heroMatch}% match
                </span>
                {heroProviders.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {heroProviders.slice(0, 3).map(p => (
                      <img
                        key={p.name}
                        src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                        alt={p.name}
                        className="w-5 h-5 rounded-md object-cover border border-border/20"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2.5 w-full">
                <Button
                  onClick={handleWatchThis}
                  className="w-full rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold text-sm neon-glow transition-all active:scale-[0.98]"
                >
                  Je regarde ça ce soir
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleAnotherSuggestion}
                  disabled={heroLoading}
                  className="w-full rounded-xl h-11 border border-border/25 text-foreground/50 hover:text-foreground hover:border-border/40 font-sans text-sm transition-all active:scale-[0.98]"
                >
                  {heroLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Autre suggestion
                </Button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Chat entry bar */}
      <div className="relative z-10 px-5 py-5">
        {/* Suggestion chips */}
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
          {chipPair.map(chip => (
            <button
              key={chip}
              onClick={onOpenChat}
              className="shrink-0 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary/70 text-[12px] font-sans font-medium hover:bg-primary/15 hover:text-primary transition-all active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Chat input bar */}
        <button
          onClick={onOpenChat}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card/60 border border-border/20 hover:border-primary/25 transition-all group"
        >
          <div className="w-8 h-8 shrink-0">
            <PickCharacter mood="default" size="sm" animate={false} />
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={placeholderIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-foreground/30 text-[13px] font-sans flex-1 text-left"
            >
              {CHAT_PLACEHOLDERS[placeholderIndex]}
            </motion.span>
          </AnimatePresence>
          <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-primary/50 transition-colors" />
        </button>
      </div>
    </div>
  );
};

export default HomeScreen;
