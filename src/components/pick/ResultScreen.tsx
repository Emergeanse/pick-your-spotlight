import { useState, useEffect, forwardRef, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Check, Play, Star, Clock, Heart, Bookmark, ChevronDown, ChevronUp, RefreshCw, Share2, Zap, Lock, ExternalLink } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders, getMovieTrailerUrl, getMovieCredits } from "@/lib/tmdb";
import type { MovieCredits } from "@/lib/tmdb";
import { buildStreamingLinks, type StreamingLink } from "@/lib/streaming-links";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie, isMovieLiked, getLikedMovies } from "@/lib/liked-movies";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { toast } from "sonner";
import { computeUserTasteVector, ensureMovieEmbedding } from "@/lib/taste-engine";
import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";

// Extracted sub-components
import ActorCard from "./result/ActorCard";
import MatchAnalysis from "./result/MatchAnalysis";
import type { MatchData } from "./result/MatchAnalysis";
import StreamingSection from "./result/StreamingSection";
import RefineSheet from "./result/RefineSheet";
import OptionsSheet from "./result/OptionsSheet";
import RejectSheet from "./result/RejectSheet";
import ReviewSheet from "./result/ReviewSheet";
import AlternativeMovies from "./result/AlternativeMovies";

const IMG_BASE = "https://image.tmdb.org/t/p";
const CONFIDENCE_THRESHOLD = 30;

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: (rejectReason?: string, rejectedMovie?: MovieDetail) => void;
  onRestart: () => void;
  onRefineWithVoice?: () => void;
  onRefineWithMessage?: (message: string) => void;
  hasMore: boolean;
  userCriteria?: { mood: Mood | null; context: Context | null; time: TimeAvailable | null };
  alternativeMovies?: MovieDetail[];
  onSelectAlternative?: (movie: MovieDetail) => void;
  searchTags?: string[];
  onRemoveTag?: (tag: string) => void;
  refining?: boolean;
  profileConfidence?: number;
}

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({
  movie, onShowAnother, onRestart, onRefineWithVoice, onRefineWithMessage,
  hasMore, userCriteria, alternativeMovies, onSelectAlternative,
  searchTags, onRemoveTag, refining, profileConfidence = 0,
}, ref) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string; provider_id: number }[]>([]);
  const [credits, setCredits] = useState<MovieCredits | null>(null);
  const [streamingLinks, setStreamingLinks] = useState<StreamingLink[]>([]);
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
  const [markedSeen, setMarkedSeen] = useState(false);
  const [rejectReaction, setRejectReaction] = useState<string | null>(null);
  const [showRefineSheet, setShowRefineSheet] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const { user } = useAuth();

  const isWhyUnlocked = true;

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const runtime = movie.runtime || (movie.episode_run_time?.[0]) || 0;
  const genres = movie.genres?.map(g => g.name).join(" · ") || "";
  const overview = movie.overview || "Aucune description disponible.";
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const isDocumentary = movie.genres?.some(g => g.id === 99);
  const mediaLabel = isDocumentary ? "Documentaire" : mediaType === "tv" ? "Série" : "Film";
  const seasons = (movie as any).number_of_seasons;
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
    getWatchProviders(movie.id, mediaType).then((p) => {
      setProviders(p);
      setStreamingLinks(buildStreamingLinks(p, title));
    }).catch(() => { setProviders([]); setStreamingLinks([]); });
    getMovieTrailerUrl(movie.id, mediaType).then(setTrailerUrl).catch(() => setTrailerUrl(null));
    getMovieCredits(movie.id, mediaType).then(setCredits).catch(() => setCredits(null));
  }, [movie.id, mediaType]);

  useEffect(() => {
    setMatchData(null);
    setCredits(null);
    setMatchLoading(true);
    setShowOptions(false);
    setMarkedSeen(false);
    setFeedbackGiven(null);

    ensureMovieEmbedding(
      movie.id,
      movie.title || movie.name || "",
      movie.overview || "",
      (movie.genres || []).map(g => g.name)
    );

    Promise.all([
      getUserTasteProfile(),
      user ? computeUserTasteVector(user.id) : Promise.resolve(null),
      user ? getLikedMovies().catch(() => []) : Promise.resolve([]),
      user ? supabase.from("cinematic_profiles" as any).select("personality_title, narrative, taste_traits").eq("user_id", user.id).maybeSingle().then(r => r.data) : Promise.resolve(null),
    ]).then(([tasteProfile, userTasteVector, likedMovies, cinematicProfile]) => {
      const likedMovieTitles = (likedMovies || []).map((m: any) => m.title);
      supabase.functions.invoke("movie-match", {
        body: { movie, userCriteria, tasteProfile, userTasteVector, likedMovieTitles, searchTags, cinematicProfile },
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
        window.dispatchEvent(new CustomEvent("pick-watchlist-added"));
      }
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setBookmarkLoading(false); }
  };

  return (
    <div ref={ref} className="h-full w-full overflow-x-hidden overflow-y-auto">
      <BrandHeader showBack onBack={onRestart} />

      <div className="relative min-h-screen w-full overflow-hidden">
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
            {/* Poster + Title block */}
            <div className="flex items-end gap-4 mb-3">
              {movie.poster_path && (
                <motion.img
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  src={getPosterUrl(movie.poster_path, "w342") || ""}
                  alt={title}
                  className="w-20 h-[120px] md:w-28 md:h-[168px] rounded-xl object-cover shadow-2xl border border-border/20 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif mb-1.5 leading-[1.05]">{title}</h1>
                <div className="flex items-center gap-2 text-foreground/50 text-xs font-sans mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-sans font-semibold uppercase tracking-wide">{mediaLabel}</span>
                  {year && <span className="font-medium text-foreground/70">{year}</span>}
                  {mediaType === "tv" && seasons && seasons > 0 && (
                    <><span className="text-foreground/20">•</span><span>{seasons} saison{seasons > 1 ? "s" : ""}</span></>
                  )}
                  {runtime > 0 && (
                    <><span className="text-foreground/20">•</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{runtime} min</span></>
                  )}
                  {movie.vote_average > 0 && (
                    <><span className="text-foreground/20">•</span><span className="flex items-center gap-1 text-primary font-medium"><Star className="w-3 h-3 fill-primary" />{movie.vote_average.toFixed(1)}</span></>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {genres && <p className="text-primary/60 text-[10px] md:text-xs tracking-[0.12em] uppercase font-sans font-medium">{genres}</p>}
                  {(movie as any)._surpriseComfortZone && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-amber-400 text-[10px] font-sans font-semibold">Hors de ta zone</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Where to watch */}
            <StreamingSection
              movieId={movie.id}
              title={title}
              releaseDate={movie.release_date}
              streamingLinks={streamingLinks}
              bookmarked={bookmarked}
              bookmarkLoading={bookmarkLoading}
              onToggleBookmark={handleToggleBookmark}
            />

            {/* Synopsis */}
            <div className="mb-4">
              <p className={`text-foreground/60 text-[13px] md:text-sm leading-relaxed font-sans font-light ${!synopsisExpanded ? "line-clamp-2" : ""}`}>{overview}</p>
              {overview.length > 120 && (
                <button onClick={() => setSynopsisExpanded(!synopsisExpanded)} className="text-primary/70 text-[11px] font-sans font-medium mt-1 flex items-center gap-0.5 hover:text-primary transition-colors">
                  {synopsisExpanded ? "Moins" : "Lire plus"}
                  {synopsisExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Cast & Crew */}
            {credits && (credits.director || credits.cast.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2.5">
                  {mediaType === "tv" ? "Équipe de la série" : "Équipe du film"}
                </p>
                <div className="rounded-xl bg-foreground/[0.04] border border-border/15 p-3.5">
                  {credits.director && (
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden shrink-0">
                        {credits.director.profile_path ? (
                          <img src={`${IMG_BASE}/w185${credits.director.profile_path}`} alt={credits.director.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary text-[11px] font-sans font-bold">{credits.director.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground/80 text-[13px] font-sans font-semibold leading-tight truncate">{credits.director.name}</p>
                        <p className="text-primary/50 text-[10px] font-sans font-medium uppercase tracking-wider">Réalisateur</p>
                      </div>
                    </div>
                  )}
                  {credits.cast.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                      {credits.cast.map((actor) => (
                        <ActorCard key={actor.id} actor={actor} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Trailer */}
            {trailerUrl && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => window.open(trailerUrl, "_blank")}
                className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/[0.05] border border-border/15 hover:border-primary/25 hover:bg-foreground/[0.08] transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Play className="w-3 h-3 text-primary fill-primary ml-0.5" />
                </div>
                <span className="text-foreground/60 text-[13px] font-sans font-medium group-hover:text-foreground transition-colors">Voir le trailer</span>
                <ExternalLink className="w-3 h-3 text-foreground/20" />
              </motion.button>
            )}

            {/* Match Analysis */}
            <AnimatePresence>
              {matchLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-4 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60" />
                  <span className="text-foreground/40 text-xs font-sans">Analyse en cours…</span>
                </motion.div>
              )}

              {!matchLoading && !isWhyUnlocked && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="mb-5 max-w-md">
                  <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/30 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-full bg-muted border-2 border-border/40 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-sans font-semibold mb-0.5">Pourquoi {mediaType === "tv" ? "cette série" : "ce film"}</p>
                        <p className="text-muted-foreground text-[12px] sm:text-[13px] font-sans leading-snug">Utilise Pick un peu plus pour débloquer l'analyse personnalisée.</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground/60 font-sans">Confiance du profil</span>
                        <span className="text-[10px] text-muted-foreground/60 font-sans font-medium">{profileConfidence}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((profileConfidence / CONFIDENCE_THRESHOLD) * 100, 100)}%` }} transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }} className="h-full rounded-full bg-primary/40" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {matchData && !matchLoading && isWhyUnlocked && (
                <MatchAnalysis matchData={matchData} mediaType={mediaType} movieId={movie.id} />
              )}
            </AnimatePresence>

            {/* Primary Actions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  data-tour="sauvegarder"
                  onClick={handleToggleBookmark}
                  disabled={bookmarkLoading}
                  className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-xs font-sans font-medium transition-all active:scale-95 ${
                    bookmarked ? "bg-primary/15 border-primary/30 text-primary" : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? "fill-primary" : ""}`} />
                  Sauvegarder
                </button>
                <button
                  onClick={handleToggleLike}
                  disabled={likeLoading}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                    liked ? "bg-primary/15 border-primary/30 text-primary" : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${liked ? "fill-primary" : ""}`} />
                </button>
                <button
                  onClick={() => {
                    const shareText = `Pick me suggère "${title}" ce soir — tu veux qu'on le regarde ensemble ? 🍿`;
                    const shareUrl = window.location.origin;
                    if (navigator.share) {
                      navigator.share({ title: `Pick — ${title}`, text: shareText, url: shareUrl }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => toast.success("Lien copié !")).catch(() => {});
                    }
                  }}
                  className="w-9 h-9 rounded-full border border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25 flex items-center justify-center transition-all active:scale-95"
                  title="Partager"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  data-tour="autre-suggestion"
                  onClick={() => onShowAnother()}
                  className="flex items-center gap-1.5 px-3.5 h-9 rounded-full border border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25 text-xs font-sans font-medium transition-all active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Autre suggestion
                </button>
              </div>

              {refining && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-3">
                  <PickCharacter mood="think" message="Attends, je cherche mieux…" size="sm" animate={false} />
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Alternative recommendations */}
      {alternativeMovies && alternativeMovies.length > 0 && onSelectAlternative && (
        <AlternativeMovies
          movies={alternativeMovies.filter((_, i) => i < 2)}
          onSelect={onSelectAlternative}
        />
      )}

      {/* Bottom Sheets */}
      <RefineSheet
        open={showRefineSheet}
        onClose={() => setShowRefineSheet(false)}
        onRefineWithMessage={onRefineWithMessage}
        mediaType={mediaType}
      />

      <OptionsSheet
        open={showOptions}
        onClose={() => setShowOptions(false)}
        onShowAnother={() => onShowAnother()}
        onRefineWithVoice={onRefineWithVoice}
      />

      <RejectSheet
        open={showRejectReasons}
        onClose={() => setShowRejectReasons(false)}
        movie={movie}
        mediaType={mediaType}
        userCriteria={userCriteria}
        onShowAnother={onShowAnother}
        rejectReaction={rejectReaction}
        onRejectReaction={setRejectReaction}
        onFeedbackGiven={setFeedbackGiven}
      />

      <ReviewSheet
        open={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
        movieId={movie.id}
        userCriteria={userCriteria}
      />
    </div>
  );
});

ResultScreen.displayName = "ResultScreen";

export default ResultScreen;
