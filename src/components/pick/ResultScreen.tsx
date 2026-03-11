import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Send, Loader2, Sparkles, Check, Play, Star, Clock, Heart, Bookmark, Tv, ChevronDown, ChevronUp, MoreHorizontal, RefreshCw, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
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
  onRefineWithMessage?: (message: string) => void;
  onStartCompanion?: () => void;
  hasMore: boolean;
  userCriteria?: {
    mood: Mood | null;
    context: Context | null;
    time: TimeAvailable | null;
  };
  alternativeMovies?: MovieDetail[];
  onSelectAlternative?: (movie: MovieDetail) => void;
  searchTags?: string[];
  onRemoveTag?: (tag: string) => void;
}

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({ movie, onShowAnother, onRestart, onRefineWithVoice, onRefineWithMessage, onStartCompanion, hasMore, userCriteria, alternativeMovies, onSelectAlternative }, ref) => {
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
  const [showRejectReasons, setShowRejectReasons] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"good" | "bad" | null>(null);
  const [altProviders, setAltProviders] = useState<Record<number, { name: string; logo_path: string }[]>>({});
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

  // Fetch providers for alternative movies
  useEffect(() => {
    if (!alternativeMovies || alternativeMovies.length === 0) return;
    alternativeMovies.forEach((alt) => {
      const altMedia = alt.first_air_date ? "tv" : "movie";
      getWatchProviders(alt.id, altMedia).then((p) => {
        setAltProviders((prev) => ({ ...prev, [alt.id]: p }));
      }).catch(() => {});
    });
  }, [alternativeMovies]);

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
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans font-semibold mb-2">Pourquoi ce film ?</p>
                  
                  <p className="text-foreground/70 text-[13px] font-sans leading-relaxed mb-3">
                    {matchData.headline}
                  </p>

                  {/* Similar liked movies */}
                  {matchData.similarLikedMovies && matchData.similarLikedMovies.length > 0 && (
                    <div className="mb-2.5">
                      <p className="text-[10px] text-muted-foreground font-sans font-medium mb-1.5">Parce que tu as aimé</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchData.similarLikedMovies.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-sans font-medium"
                          >
                            <Heart className="w-2.5 h-2.5 fill-primary" />
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching reasons as tags */}
                  {matchData.matchingReasons && matchData.matchingReasons.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground font-sans font-medium mb-1.5">Et que tu recherches</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchData.matchingReasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center px-2.5 py-1 rounded-full bg-foreground/5 border border-border/30 text-foreground/60 text-[11px] font-sans font-medium"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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

              {/* Feedback actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (feedbackGiven === "good") return;
                    setFeedbackGiven("good");
                    trackInteraction(movie.id, "liked", { mood: userCriteria?.mood, context: userCriteria?.context, time: userCriteria?.time, feedback: "good_reco" });
                    if (!liked && user) { likeMovie(movie).then(() => setLiked(true)).catch(() => {}); }
                    toast.success("Merci pour ton retour !");
                  }}
                  className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-xs font-sans font-medium transition-all active:scale-95 ${
                    feedbackGiven === "good"
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${feedbackGiven === "good" ? "fill-primary" : ""}`} />
                  Bonne reco
                </button>

                <button
                  onClick={() => {
                    setShowRejectReasons(true);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-xs font-sans font-medium transition-all active:scale-95 ${
                    feedbackGiven === "bad"
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "border-border/25 text-foreground/40 hover:text-foreground/60 hover:border-border/40"
                  }`}
                >
                  <ThumbsDown className={`w-3.5 h-3.5 ${feedbackGiven === "bad" ? "fill-destructive" : ""}`} />
                  Pas pour moi
                </button>

                <button
                  onClick={handleToggleBookmark}
                  disabled={bookmarkLoading}
                  className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-xs font-sans font-medium transition-all active:scale-95 ${
                    bookmarked
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? "fill-primary" : ""}`} />
                  Sauvegarder
                </button>
              </div>

              {/* Conversational follow-up */}
              {matchData && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.4 }}
                  className="pt-1"
                >
                  <div className="flex items-start gap-2 mb-2.5">
                    <MessageCircle className="w-3 h-3 text-primary/50 mt-0.5 flex-shrink-0" />
                    <p className="text-foreground/40 text-[11px] font-sans leading-relaxed">
                      Je pense que ce film pourrait te plaire. Tu veux affiner ?
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => onRefineWithMessage?.("Je veux quelque chose de plus intense")}
                      className="px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/25 text-foreground/50 hover:text-primary hover:border-primary/25 hover:bg-primary/5 text-[11px] font-sans transition-all active:scale-95"
                    >
                      Quelque chose de plus intense
                    </button>
                    <button
                      onClick={() => onRefineWithMessage?.("Je préfère un film plus court")}
                      className="px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/25 text-foreground/50 hover:text-primary hover:border-primary/25 hover:bg-primary/5 text-[11px] font-sans transition-all active:scale-95"
                    >
                      Un film plus court
                    </button>
                    <button
                      onClick={() => onRefineWithMessage?.("Montre-moi d'autres options similaires")}
                      className="px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/25 text-foreground/50 hover:text-primary hover:border-primary/25 hover:bg-primary/5 text-[11px] font-sans transition-all active:scale-95"
                    >
                      D'autres options similaires
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Alternative recommendations */}
      {alternativeMovies && alternativeMovies.length > 0 && onSelectAlternative && (
        <div className="relative z-10 px-5 md:px-12 lg:px-16 pb-8 pt-2 bg-background">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans font-semibold mb-3">
            Autres options pour ce soir
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {alternativeMovies.map((alt, i) => {
              const altPoster = getPosterUrl(alt.poster_path, "w342");
              const altTitle = getDisplayTitle(alt);
              const altProvs = altProviders[alt.id] || [];
              return (
                <motion.button
                  key={alt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  onClick={() => onSelectAlternative(alt)}
                  className="flex-shrink-0 w-32 text-left group"
                >
                  <div className="relative w-32 h-48 rounded-xl overflow-hidden mb-2 border border-border/20 group-hover:border-primary/30 transition-colors">
                    {altPoster ? (
                      <img
                        src={altPoster}
                        alt={altTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-foreground/5 flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">No poster</span>
                      </div>
                    )}
                  </div>
                  <p className="text-foreground/80 text-[12px] font-sans font-medium line-clamp-2 leading-tight mb-1 group-hover:text-foreground transition-colors">
                    {altTitle}
                  </p>
                  {altProvs.length > 0 && (
                    <div className="flex gap-1">
                      {altProvs.slice(0, 3).map((p) => (
                        <img
                          key={p.name}
                          src={`${IMG_BASE}/w92${p.logo_path}`}
                          alt={p.name}
                          className="w-4 h-4 rounded-sm object-cover opacity-60"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Bottom Sheet: Reject reasons */}
      <AnimatePresence>
        {showRejectReasons && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowRejectReasons(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/20 rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-foreground/15" />
              </div>
              <div className="px-5 pb-5 pt-2">
                <p className="text-sm font-sans font-semibold text-foreground mb-3">Pourquoi ce film ne te convient pas ?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Déjà vu", value: "already_seen" },
                    { label: "Pas mon style", value: "not_my_style" },
                    { label: "Trop long", value: "too_long" },
                    { label: "Pas ce soir", value: "not_tonight" },
                  ].map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => {
                        setFeedbackGiven("bad");
                        setShowRejectReasons(false);
                        trackInteraction(movie.id, "skipped", {
                          mood: userCriteria?.mood,
                          context: userCriteria?.context,
                          time: userCriteria?.time,
                          feedback: "bad_reco",
                          reject_reason: reason.value,
                        });
                        toast.success("Merci, on fera mieux !");
                      }}
                      className="px-4 py-3 rounded-xl border border-border/30 bg-foreground/[0.03] hover:bg-primary/10 hover:border-primary/20 text-foreground/60 hover:text-foreground text-sm font-sans font-medium transition-all active:scale-[0.97]"
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>
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
