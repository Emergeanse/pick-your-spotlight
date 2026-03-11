import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, ChevronRight, Star, Clock, Sparkles, Heart, Lightbulb, PartyPopper, Loader2, Bookmark, Mic, Tv, ChevronDown, ChevronUp } from "lucide-react";
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
  const [matchExpanded, setMatchExpanded] = useState(false);
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

  useEffect(() => {
    getWatchProviders(movie.id, mediaType).then(setProviders).catch(() => setProviders([]));
    getMovieTrailerUrl(movie.id, mediaType).then(setTrailerUrl).catch(() => setTrailerUrl(null));
  }, [movie.id, mediaType]);

  useEffect(() => {
    setMatchData(null);
    setMatchLoading(true);
    setMatchExpanded(false);
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
    if (!user) { toast.info("Connecte-toi pour sauvegarder tes films !"); return; }
    setLikeLoading(true);
    try {
      if (liked) { await unlikeMovie(movie.id); setLiked(false); toast.success("Retiré des favoris"); }
      else { await likeMovie(movie); setLiked(true); toast.success("Ajouté aux favoris !"); }
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setLikeLoading(false); }
  };

  const handleToggleBookmark = async () => {
    if (!user) { toast.info("Connecte-toi pour ta watchlist !"); return; }
    setBookmarkLoading(true);
    try {
      if (bookmarked) { await removeFromWatchlist(movie.id); setBookmarked(false); toast.success("Retiré de ta watchlist"); }
      else { await addToWatchlist(movie); setBookmarked(true); toast.success("Ajouté à ta watchlist !"); }
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setBookmarkLoading(false); }
  };

  return (
    <div ref={ref} className="h-full w-full overflow-y-auto">
      <BrandHeader showBack onBack={onRestart} />

      <div className="relative min-h-screen w-full">
        {/* Background image */}
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

            {/* Genres */}
            {genres && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-primary/70 text-[10px] md:text-xs mb-1.5 tracking-[0.15em] uppercase font-sans font-medium"
              >
                {genres}
              </motion.p>
            )}

            {/* Title */}
            <h1 className="text-2xl md:text-5xl lg:text-7xl font-serif mb-2 md:mb-3 leading-[1.05]">
              {title}
            </h1>

            {/* Meta info */}
            <div className="flex items-center gap-3 text-foreground/50 text-xs mb-3 font-sans flex-wrap">
              {year && <span className="font-medium text-foreground/70">{year}</span>}
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

            {/* AI Match — collapsible card */}
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
                  className="mb-4 max-w-md"
                >
                  {/* Collapsed: just headline */}
                  <button
                    onClick={() => setMatchExpanded(!matchExpanded)}
                    className="w-full text-left bg-foreground/[0.04] backdrop-blur-md border border-primary/15 rounded-xl px-4 py-3 group hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] md:text-sm font-serif text-primary/90 leading-snug">
                        {matchData.headline}
                      </p>
                      <ChevronDown className={`w-4 h-4 text-primary/40 flex-shrink-0 mt-0.5 transition-transform ${matchExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {matchExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-foreground/[0.04] backdrop-blur-md border border-t-0 border-primary/15 rounded-b-xl px-4 py-3 space-y-3 -mt-px">
                          {[
                            { icon: Lightbulb, label: "Pourquoi ça matche", text: matchData.whyItMatches },
                            { icon: Heart, label: "Ce que tu vas ressentir", text: matchData.emotionalJourney },
                            { icon: PartyPopper, label: "Moment idéal", text: matchData.perfectFor },
                            { icon: Sparkles, label: "Le savais-tu ?", text: matchData.funFact },
                          ].map(({ icon: Icon, label, text }) => (
                            <div key={label} className="flex gap-2.5">
                              <div className="mt-0.5 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-3 h-3 text-primary" />
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest text-primary/60 font-sans font-semibold mb-0.5">{label}</p>
                                <p className="text-foreground/60 text-xs font-sans font-light leading-relaxed">{text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons — compact row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-2 flex-wrap"
            >
              {/* Icon buttons: like & bookmark */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleLike}
                disabled={likeLoading}
                className={`rounded-full w-9 h-9 border transition-all ${
                  liked
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border/30 text-foreground/40 hover:text-primary hover:border-primary/30"
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-primary" : ""}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleBookmark}
                disabled={bookmarkLoading}
                className={`rounded-full w-9 h-9 border transition-all ${
                  bookmarked
                    ? "bg-accent/20 border-accent/40 text-accent"
                    : "border-border/30 text-foreground/40 hover:text-accent hover:border-accent/30"
                }`}
              >
                <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-accent" : ""}`} />
              </Button>

              {/* Divider */}
              <div className="w-px h-5 bg-border/20 mx-0.5" />

              {/* Primary actions */}
              {onStartCompanion && (
                <Button
                  size="sm"
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-sans font-medium px-4 h-9 gap-1.5"
                  onClick={onStartCompanion}
                >
                  <Tv className="w-3.5 h-3.5" />
                  Je regarde
                </Button>
              )}

              {trailerUrl && (
                <Button
                  size="sm"
                  className="rounded-full bg-foreground/10 text-foreground/80 hover:bg-foreground/15 text-xs font-sans font-medium px-4 h-9 gap-1.5 border border-border/20"
                  onClick={() => window.open(trailerUrl, "_blank")}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Trailer
                </Button>
              )}

              <Button
                size="sm"
                className="rounded-full bg-foreground/10 text-foreground/80 hover:bg-foreground/15 text-xs font-sans font-medium px-4 h-9 gap-1.5 border border-border/20"
                onClick={onShowAnother}
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Autre
              </Button>

              {onRefineWithVoice && (
                <Button
                  size="sm"
                  className="rounded-full bg-foreground/10 text-foreground/80 hover:bg-foreground/15 text-xs font-sans font-medium px-3.5 h-9 gap-1.5 border border-border/20"
                  onClick={onRefineWithVoice}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Affiner
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-foreground/30 hover:text-foreground/60 text-xs font-sans h-9 px-3 gap-1"
                onClick={onRestart}
              >
                <RotateCcw className="w-3 h-3" />
                Relancer
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
