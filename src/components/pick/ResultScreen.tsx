import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Star, Clock, Sparkles, Heart, Loader2, Bookmark, Tv, ChevronDown, ChevronUp, MoreHorizontal, RefreshCw, Mic, X } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders, getMovieTrailerUrl } from "@/lib/tmdb";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie, isMovieLiked, getLikedMovies } from "@/lib/liked-movies";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { toast } from "sonner";
import { computeUserTasteVector, ensureMovieEmbedding } from "@/lib/taste-engine";
import BrandHeader from "./BrandHeader";

const IMG_BASE = "https://image.tmdb.org/t/p";

interface MatchData {
  matchScore: number;
  headline: string;
  whyItMatches: string;
  emotionalJourney: string;
  perfectFor: string;
  funFact: string;
  similarLikedMovies?: string[];
  matchingReasons?: string[];
}

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: () => void;
  onRestart: () => void;
  onRefineWithVoice?: () => void;
  onStartCompanion?: () => void;
  hasMore: boolean;
  userCriteria?: {
    mood: Mood | null;
    context: Context | null;
    time: TimeAvailable | null;
  };
}

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({ movie, onShowAnother, onRestart, onRefineWithVoice, onStartCompanion, hasMore, userCriteria }, ref) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const { user } = useAuth();

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const runtime = movie.runtime || (movie.episode_run_time?.[0]) || 0;
  const genres = movie.genres?.map(g => g.name).join(" · ") || "";
  const overview = movie.overview || "Aucune description disponible.";
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const bgImage = backdrop || poster;

  // Track movie opened
  useEffect(() => {
    trackInteraction(movie.id, "opened", {
      mood: userCriteria?.mood,
      context: userCriteria?.context,
      time: userCriteria?.time,
    });
  }, [movie.id]);

  useEffect(() => {
    getWatchProviders(movie.id, mediaType).then(setProviders).catch(() => setProviders([]));
    getMovieTrailerUrl(movie.id, mediaType).then(setTrailerUrl).catch(() => setTrailerUrl(null));
  }, [movie.id, mediaType]);

  useEffect(() => {
    setMatchData(null);
    setMatchLoading(true);
    setShowOptions(false);

    // Pre-generate embedding for this movie (fire & forget)
    ensureMovieEmbedding(
      movie.id,
      movie.title || movie.name || "",
      movie.overview || "",
      (movie.genres || []).map(g => g.name)
    );

    // Load taste profile + user taste vector + liked movies and pass to match function
    Promise.all([
      getUserTasteProfile(),
      user ? computeUserTasteVector(user.id) : Promise.resolve(null),
      user ? getLikedMovies().catch(() => []) : Promise.resolve([]),
    ]).then(([tasteProfile, userTasteVector, likedMovies]) => {
      const likedMovieTitles = (likedMovies || []).map((m: any) => m.title);
      supabase.functions.invoke("movie-match", {
        body: { movie, userCriteria, tasteProfile, userTasteVector, likedMovieTitles },
      }).then(({ data, error }) => {
        if (error) { console.error("Match error:", error); setMatchLoading(false); return; }
        setMatchData(data as MatchData);
        setMatchLoading(false);
      });
    });
  }, [movie.id]);

  useEffect(() => {
    if (user) {
      isMovieLiked(movie.id).then(setLiked).catch(() => {});
      isInWatchlist(movie.id).then(setBookmarked).catch(() => {});
    }
  }, [movie.id, user]);

  const handleToggleLike = async () => {
    if (!user) { toast.info("Connecte-toi pour sauvegarder tes films !"); return; }
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikeMovie(movie.id); setLiked(false); toast.success("Retiré des favoris");
        trackInteraction(movie.id, "unliked");
      } else {
        await likeMovie(movie); setLiked(true); toast.success("Ajouté aux favoris !");
        trackInteraction(movie.id, "liked");
      }
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setLikeLoading(false); }
  };

  const handleToggleBookmark = async () => {
    if (!user) { toast.info("Connecte-toi pour ta watchlist !"); return; }
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await removeFromWatchlist(movie.id); setBookmarked(false); toast.success("Retiré de ta watchlist");
        trackInteraction(movie.id, "unsaved");
      } else {
        await addToWatchlist(movie); setBookmarked(true); toast.success("Ajouté à ta watchlist !");
        trackInteraction(movie.id, "saved");
      }
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setBookmarkLoading(false); }
  };

  return (
    <div ref={ref} className="h-full w-full overflow-y-auto">
      <BrandHeader showBack onBack={onRestart} />

      <div className="relative min-h-screen w-full">
        {/* Background */}
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
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end min-h-screen px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-12 lg:px-16 md:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl"
          >
            {/* Match badge */}
            {matchData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/25 mb-3"
              >
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-primary text-[11px] font-sans font-semibold">
                  Match {matchData.matchScore}%
                </span>
              </motion.div>
            )}

            {/* Title */}
            <h1 className="text-2xl md:text-5xl lg:text-7xl font-serif mb-2 leading-[1.05]">
              {title}
            </h1>

            {/* Meta: Year • Runtime • Rating */}
            <div className="flex items-center gap-2 text-foreground/50 text-xs font-sans mb-1.5 flex-wrap">
              {year && <span className="font-medium text-foreground/70">{year}</span>}
              {year && runtime > 0 && <span className="text-foreground/20">•</span>}
              {runtime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {runtime} min
                </span>
              )}
              {movie.vote_average > 0 && (
                <>
                  <span className="text-foreground/20">•</span>
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <Star className="w-3 h-3 fill-primary" />
                    {movie.vote_average.toFixed(1)}
                  </span>
                </>
              )}
            </div>

            {/* Genres */}
            {genres && (
              <p className="text-primary/60 text-[10px] md:text-xs tracking-[0.12em] uppercase font-sans font-medium mb-3">
                {genres}
              </p>
            )}

            {/* Synopsis — expandable */}
            <div className="mb-3">
              <p className={`text-foreground/60 text-[13px] md:text-sm leading-relaxed font-sans font-light ${!synopsisExpanded ? "line-clamp-2" : ""}`}>
                {overview}
              </p>
              {overview.length > 120 && (
                <button
                  onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                  className="text-primary/70 text-[11px] font-sans font-medium mt-1 flex items-center gap-0.5 hover:text-primary transition-colors"
                >
                  {synopsisExpanded ? "Moins" : "Lire plus"}
                  {synopsisExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Platforms */}
            {providers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 mb-4"
              >
                <span className="text-foreground/30 text-[10px] font-sans">Dispo sur</span>
                <div className="flex gap-1.5">
                  {providers.map((p) => (
                    <img
                      key={p.name}
                      src={`${IMG_BASE}/w92${p.logo_path}`}
                      alt={p.name}
                      title={p.name}
                      className="w-6 h-6 md:w-7 md:h-7 rounded-md object-cover border border-border/20"
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* "Pourquoi ce film ?" section */}
            <AnimatePresence>
              {matchLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 flex items-center gap-2"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60" />
                  <span className="text-foreground/40 text-xs font-sans">Analyse en cours…</span>
                </motion.div>
              )}

              {matchData && !matchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mb-5 max-w-md"
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans font-semibold mb-1.5">Pourquoi ce film ?</p>
                  <p className="text-foreground/70 text-[13px] font-sans leading-relaxed">
                    {matchData.headline}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              {/* Main buttons row */}
              <div className="flex items-center gap-2.5">
                {onStartCompanion && (
                  <Button
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-6 h-11 gap-2 text-sm neon-glow transition-all active:scale-[0.97]"
                    onClick={onStartCompanion}
                  >
                    <Tv className="w-4 h-4" />
                    Je regarde
                  </Button>
                )}

                {trailerUrl && (
                  <Button
                    size="lg"
                    className="rounded-full bg-foreground/8 text-foreground/70 hover:bg-foreground/12 hover:text-foreground font-sans font-medium px-5 h-11 gap-2 text-sm border border-border/20 transition-all active:scale-[0.97]"
                    onClick={() => window.open(trailerUrl, "_blank")}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Trailer
                  </Button>
                )}
              </div>

              {/* Bottom row: icons + more */}
              <div className="flex items-center gap-2">
                {/* Like */}
                <button
                  onClick={handleToggleLike}
                  disabled={likeLoading}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    liked
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/35 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? "fill-primary" : ""}`} />
                </button>

                {/* Bookmark */}
                <button
                  onClick={handleToggleBookmark}
                  disabled={bookmarkLoading}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    bookmarked
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/35 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* More options */}
                <button
                  onClick={() => setShowOptions(true)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-full text-foreground/35 hover:text-foreground/60 text-xs font-sans transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span>Plus d'options</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Sheet: Plus d'options */}
      <AnimatePresence>
        {showOptions && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowOptions(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/20 rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-foreground/15" />
              </div>

              <div className="px-5 pb-5 pt-2 space-y-1">
                <button
                  onClick={() => { setShowOptions(false); onShowAnother(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/60 transition-colors active:scale-[0.98]"
                >
                  <RefreshCw className="w-4.5 h-4.5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-sans font-medium text-foreground">Autre suggestion</p>
                    <p className="text-[11px] font-sans text-muted-foreground">Voir un autre film qui correspond</p>
                  </div>
                </button>

                {onRefineWithVoice && (
                  <button
                    onClick={() => { setShowOptions(false); onRefineWithVoice(); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/60 transition-colors active:scale-[0.98]"
                  >
                    <Mic className="w-4.5 h-4.5 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-sans font-medium text-foreground">Affiner la recherche</p>
                      <p className="text-[11px] font-sans text-muted-foreground">Préciser tes envies avec ta voix</p>
                    </div>
                  </button>
                )}

                {/* Cancel */}
                <button
                  onClick={() => setShowOptions(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground text-sm font-sans transition-colors mt-2"
                >
                  <X className="w-4 h-4" />
                  Fermer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

ResultScreen.displayName = "ResultScreen";

export default ResultScreen;
