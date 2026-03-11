import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, ChevronRight, Star, Clock, Sparkles, Heart, Lightbulb, PartyPopper, Loader2, Bookmark, Mic } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders, getMovieTrailerUrl } from "@/lib/tmdb";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie, isMovieLiked } from "@/lib/liked-movies";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { toast } from "sonner";
import BrandHeader from "./BrandHeader";

const IMG_BASE = "https://image.tmdb.org/t/p";

interface MatchData {
  matchScore: number;
  headline: string;
  whyItMatches: string;
  emotionalJourney: string;
  perfectFor: string;
  funFact: string;
}

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: () => void;
  onRestart: () => void;
  onRefineWithVoice?: () => void;
  hasMore: boolean;
  userCriteria?: {
    mood: Mood | null;
    context: Context | null;
    time: TimeAvailable | null;
  };
}

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({ movie, onShowAnother, onRestart, onRefineWithVoice, hasMore, userCriteria }, ref) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const { user } = useAuth();

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const runtime = movie.runtime || (movie.episode_run_time?.[0]) || 0;
  const genres = movie.genres?.map(g => g.name).join(", ") || "";
  const overview = movie.overview || "Aucune description disponible.";
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const bgImage = backdrop || poster;

  useEffect(() => {
    getWatchProviders(movie.id, mediaType).then(setProviders).catch(() => setProviders([]));
    getMovieTrailerUrl(movie.id, mediaType).then(setTrailerUrl).catch(() => setTrailerUrl(null));
  }, [movie.id, mediaType]);

  useEffect(() => {
    setMatchData(null);
    setMatchLoading(true);
    supabase.functions.invoke("movie-match", {
      body: { movie, userCriteria },
    }).then(({ data, error }) => {
      if (error) {
        console.error("Match error:", error);
        setMatchLoading(false);
        return;
      }
      setMatchData(data as MatchData);
      setMatchLoading(false);
    });
  }, [movie.id]);

  useEffect(() => {
    if (user) {
      isMovieLiked(movie.id).then(setLiked).catch(() => {});
      isInWatchlist(movie.id).then(setBookmarked).catch(() => {});
    }
  }, [movie.id, user]);

  const handleToggleLike = async () => {
    if (!user) {
      toast.info("Connecte-toi pour sauvegarder tes films !");
      return;
    }
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikeMovie(movie.id);
        setLiked(false);
        toast.success("Film retiré de tes favoris");
      } else {
        await likeMovie(movie);
        setLiked(true);
        toast.success("Film ajouté à tes favoris !");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLikeLoading(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!user) {
      toast.info("Connecte-toi pour ta watchlist !");
      return;
    }
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await removeFromWatchlist(movie.id);
        setBookmarked(false);
        toast.success("Retiré de ta watchlist");
      } else {
        await addToWatchlist(movie);
        setBookmarked(true);
        toast.success("Ajouté à ta watchlist !");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setBookmarkLoading(false);
    }
  };

  return (
    <div ref={ref} className="h-full w-full overflow-y-auto">
      <BrandHeader showBack onBack={onRestart} />

      <div className="relative min-h-screen w-full">
        {bgImage && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}
        <div className="absolute inset-0 poster-gradient" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-screen p-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:p-12 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl"
          >
            {matchData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 mb-3 md:mb-4"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary text-xs md:text-sm font-sans font-semibold">
                  Match {matchData.matchScore}%
                </span>
              </motion.div>
            )}

            {genres && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-primary/80 text-[10px] md:text-xs mb-2 md:mb-3 tracking-[0.15em] uppercase font-sans font-medium"
              >
                {genres}
              </motion.p>
            )}

            <h1 className="text-3xl md:text-6xl lg:text-8xl font-serif mb-3 md:mb-4 leading-[1.05]">
              {title}
            </h1>

            <div className="flex items-center gap-3 md:gap-4 text-foreground/60 text-xs md:text-sm mb-4 md:mb-5 font-sans flex-wrap">
              {year && <span className="font-medium text-foreground/80">{year}</span>}
              {runtime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {runtime} min
                </span>
              )}
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <Star className="w-3 h-3 fill-primary" />
                  {movie.vote_average.toFixed(1)}
                </span>
              )}
            </div>

            <p className="text-foreground/70 text-sm md:text-base leading-relaxed mb-5 md:mb-7 max-w-lg font-sans font-light line-clamp-3">
              {overview}
            </p>

            {providers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 md:gap-3 mb-5 md:mb-7"
              >
                <span className="text-foreground/40 text-[10px] md:text-xs font-sans">Disponible sur</span>
                <div className="flex gap-1.5 md:gap-2">
                  {providers.map((p) => (
                    <img
                      key={p.name}
                      src={`${IMG_BASE}/w92${p.logo_path}`}
                      alt={p.name}
                      title={p.name}
                      className="w-7 h-7 md:w-9 md:h-9 rounded-lg object-cover border border-border/30"
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* AI Match Card */}
            <AnimatePresence>
              {matchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 md:mb-7 bg-foreground/5 backdrop-blur-md border border-border/30 rounded-xl p-5 max-w-md w-full"
                >
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-foreground/50 text-sm font-sans">Analyse de votre match…</span>
                  </div>
                </motion.div>
              )}

              {matchData && !matchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="mb-5 md:mb-7 bg-foreground/5 backdrop-blur-md border border-primary/20 rounded-xl p-5 max-w-md w-full space-y-4"
                >
                  <p className="text-sm md:text-base font-serif text-primary font-medium">
                    {matchData.headline}
                  </p>

                  <div className="space-y-3">
                    {[
                      { icon: Lightbulb, label: "Pourquoi ça matche", text: matchData.whyItMatches },
                      { icon: Heart, label: "Ce que tu vas ressentir", text: matchData.emotionalJourney },
                      { icon: PartyPopper, label: "Moment idéal", text: matchData.perfectFor },
                      { icon: Sparkles, label: "Le savais-tu ?", text: matchData.funFact },
                    ].map(({ icon: Icon, label, text }) => (
                      <div key={label} className="flex gap-3">
                        <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-primary/70 font-sans font-semibold mb-1">{label}</p>
                          <p className="text-foreground/70 text-xs md:text-sm font-sans font-light leading-relaxed">{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-2 md:gap-3 items-center"
            >
              {/* Like button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleLike}
                disabled={likeLoading}
                className={`rounded-full w-11 h-11 border transition-all ${
                  liked
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-border/30 text-foreground/50 hover:text-primary hover:border-primary/30"
                }`}
              >
                <Heart className={`w-5 h-5 ${liked ? "fill-primary" : ""}`} />
              </Button>

              {/* Bookmark button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleBookmark}
                disabled={bookmarkLoading}
                className={`rounded-full w-11 h-11 border transition-all ${
                  bookmarked
                    ? "bg-accent/20 border-accent/50 text-accent"
                    : "border-border/30 text-foreground/50 hover:text-accent hover:border-accent/30"
                }`}
              >
                <Bookmark className={`w-5 h-5 ${bookmarked ? "fill-accent" : ""}`} />
              </Button>

              {trailerUrl && (
                <Button
                  variant="hero"
                  size="xl"
                  className="text-sm md:text-base"
                  onClick={() => window.open(trailerUrl, "_blank")}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Bande-annonce
                </Button>
              )}

              {hasMore && (
                <Button
                  variant="heroOutline"
                  size="xl"
                  className="text-sm md:text-base"
                  onClick={onShowAnother}
                >
                  <ChevronRight className="w-4 h-4" />
                  Autre suggestion
                </Button>
              )}

              {onRefineWithVoice && (
                <Button
                  variant="heroOutline"
                  size="xl"
                  className="text-sm md:text-base"
                  onClick={onRefineWithVoice}
                >
                  <Mic className="w-4 h-4" />
                  Affiner
                </Button>
              )}

              <Button
                variant="ghost"
                size="xl"
                className="text-foreground/50 hover:text-foreground text-sm md:text-base"
                onClick={onRestart}
              >
                <RotateCcw className="w-4 h-4" />
                Recommencer
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
});

ResultScreen.displayName = "ResultScreen";

export default ResultScreen;
