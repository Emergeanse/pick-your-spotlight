import { useState, useEffect, forwardRef, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Sparkles,
  Play,
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Share2,
  Zap,
  Lock,
  ExternalLink,
  Tv,
  Dices,
} from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import {
  getDisplayTitle,
  getYear,
  getBackdropUrl,
  getPosterUrl,
  getWatchProviders,
  getMovieTrailerUrl,
  getMovieCredits,
} from "@/lib/tmdb";
import type { MovieCredits, CastMember } from "@/lib/tmdb";
import { buildStreamingLinks, type StreamingLink } from "@/lib/streaming-links";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getLikedMovies } from "@/lib/liked-movies";
import {
  trackInteraction,
  getUserTasteProfile,
  trackRecommendationEvent,
  updateRecommendationReaction,
} from "@/lib/interactions";
import { toast } from "sonner";
import { computeUserTasteVector, ensureMovieEmbedding } from "@/lib/taste-engine";
import { Button } from "@/components/ui/button";
import MovieActionBar from "@/components/pick/MovieActionBar";
import FlipCardDetail from "@/components/pick/FlipCardDetail";
import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";
import FeedbackBadge from "./FeedbackBadge";
import { RecommendationMovieCardHeader } from "./RecommendationMovieCard";
import { useMovieInteractions, useMovieInteraction } from "@/hooks/use-movie-interactions";
import { inferCatalogMediaType } from "@/lib/catalog";

const IMG_BASE = "https://image.tmdb.org/t/p";
const CONFIDENCE_THRESHOLD = 30;

interface MatchData {
  matchScore?: number;
  score?: number;
  headline?: string;
  whyItMatches?: string;
  detailedExplanation?: string;
  emotionalJourney?: string;
  perfectFor?: string;
  funFact?: string;
  summary?: string;
  reasons?: string[];
  tone?: string;
  matchingReasons?: string[];
  pickNote?: string | null;
}

const ActorCard = ({ actor, onClick }: { actor: CastMember; onClick?: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 min-w-[56px] group cursor-pointer">
    <div className="w-11 h-11 rounded-full bg-foreground/[0.06] border border-border/15 overflow-hidden shrink-0 group-hover:border-primary/30 transition-colors">
      {actor.profile_path ? (
        <img src={`${IMG_BASE}/w185${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-foreground/30 text-[11px] font-sans font-bold">{actor.name.charAt(0)}</span>
        </div>
      )}
    </div>
    <div className="text-center min-w-0 max-w-[64px]">
      <p className="text-foreground/70 text-[10px] font-sans font-medium leading-tight truncate group-hover:text-primary transition-colors">
        {actor.name}
      </p>
      <p className="text-foreground/30 text-[9px] font-sans leading-tight truncate">{actor.character}</p>
    </div>
  </button>
);

const MatchAnalysis = ({ matchData, mediaType }: { matchData: MatchData; mediaType: string; movieId: number }) => {
  const score = matchData.matchScore ?? matchData.score;
  const summary = matchData.detailedExplanation || matchData.whyItMatches || matchData.summary;
  const headline = matchData.headline;
  const reasons = matchData.matchingReasons || matchData.reasons;
  const funFact = matchData.funFact;
  const perfectFor = matchData.perfectFor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="mb-5 max-w-md"
    >
      <div className="p-3 sm:p-4 rounded-xl bg-primary/[0.04] border border-primary/15 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
                Pourquoi {mediaType === "tv" ? "cette série" : "ce film"}
              </p>
              {score != null && (
                <span className="text-[10px] font-sans font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {score}%
                </span>
              )}
            </div>
            {headline && <p className="text-foreground/80 text-[13px] font-sans font-semibold mb-1">{headline}</p>}
            {summary && (
              <p className="text-foreground/70 text-[12px] sm:text-[13px] font-sans leading-snug mb-2">{summary}</p>
            )}
            {reasons && reasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {reasons.map((reason, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-sans text-primary/70 bg-primary/8 px-2 py-0.5 rounded-full border border-primary/10"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
            {perfectFor && <p className="text-foreground/50 text-[11px] font-sans italic">{perfectFor}</p>}
            {funFact && (
              <p className="text-foreground/40 text-[11px] font-sans mt-2 leading-snug">
                <span className="text-primary/50">💡</span> {funFact}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StreamingSection = ({ streamingLinks }: { streamingLinks: StreamingLink[] }) => {
  if (streamingLinks.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mb-4"
    >
      <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
        Où regarder
      </p>
      <div className="flex flex-wrap gap-2">
        {streamingLinks.map((link) => (
          <a
            key={link.providerId}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/[0.04] border border-border/15 hover:border-primary/25 hover:bg-foreground/[0.08] transition-all group"
          >
            {link.logo_path && (
              <img
                src={`${IMG_BASE}/w92${link.logo_path}`}
                alt={link.name}
                className="w-5 h-5 rounded-md object-contain"
              />
            )}
            <span className="text-foreground/60 text-[12px] font-sans font-medium group-hover:text-foreground transition-colors">
              {link.name}
            </span>
            <ExternalLink className="w-3 h-3 text-foreground/20" />
          </a>
        ))}
      </div>
    </motion.div>
  );
};

const RefineSheet = ({
  open,
  onClose,
  onRefineWithMessage,
  mediaType,
}: {
  open: boolean;
  onClose: () => void;
  onRefineWithMessage?: (msg: string) => void;
  mediaType: string;
}) => {
  const [message, setMessage] = useState("");
  if (!open) return null;
  const handleSend = () => {
    if (message.trim() && onRefineWithMessage) {
      onRefineWithMessage(message.trim());
      setMessage("");
      onClose();
    }
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/20 rounded-t-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-foreground/10 mx-auto mb-4" />
            <p className="text-foreground/80 text-sm font-sans font-semibold mb-3">Affine ta recherche</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Dis-moi ce que tu cherches de différent…"
              className="w-full h-20 rounded-xl bg-foreground/[0.04] border border-border/15 p-3 text-sm font-sans text-foreground placeholder:text-foreground/30 resize-none focus:outline-none focus:border-primary/30"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="mt-3 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-sans font-semibold disabled:opacity-40 transition-opacity"
            >
              Envoyer
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const OptionsSheet = ({
  open,
  onClose,
  onShowAnother,
  onRefineWithVoice,
}: {
  open: boolean;
  onClose: () => void;
  onShowAnother: () => void;
  onRefineWithVoice?: () => void;
}) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/20 rounded-t-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-foreground/10 mx-auto mb-4" />
            <div className="space-y-2">
              <button
                onClick={() => {
                  onShowAnother();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-foreground/[0.04] border border-border/15 hover:bg-foreground/[0.08] transition-all"
              >
                <RefreshCw className="w-4 h-4 text-foreground/40" />
                <span className="text-foreground/70 text-sm font-sans font-medium">5 autres suggestions</span>
              </button>
              {onRefineWithVoice && (
                <button
                  onClick={() => {
                    onRefineWithVoice();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-foreground/[0.04] border border-border/15 hover:bg-foreground/[0.08] transition-all"
                >
                  <Sparkles className="w-4 h-4 text-primary/60" />
                  <span className="text-foreground/70 text-sm font-sans font-medium">Affiner vocalement</span>
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const REJECT_REASONS = [
  { id: "seen", label: "Déjà vu", emoji: "👀" },
  { id: "not-mood", label: "Pas dans le mood", emoji: "😐" },
  { id: "not-genre", label: "Pas le genre", emoji: "🎭" },
  { id: "too-long", label: "Trop long", emoji: "⏱️" },
];

const RejectSheet = ({
  open,
  onClose,
  movie,
  mediaType,
  onShowAnother,
  onRejectReaction,
  onFeedbackGiven,
}: {
  open: boolean;
  onClose: () => void;
  movie: MovieDetail;
  mediaType: string;
  userCriteria?: { mood: Mood | null; context: Context | null; time: TimeAvailable | null };
  onShowAnother: (reason?: string, movie?: MovieDetail) => void;
  rejectReaction: string | null;
  onRejectReaction: (r: string | null) => void;
  onFeedbackGiven: (f: "good" | "bad" | null) => void;
}) => {
  if (!open) return null;
  const handleReject = (reasonId: string) => {
    onRejectReaction(reasonId);
    onFeedbackGiven("bad");
    trackInteraction(movie.id, "skipped", { reason: reasonId });
    onClose();
    onShowAnother(reasonId, movie);
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/20 rounded-t-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-foreground/10 mx-auto mb-4" />
            <p className="text-foreground/80 text-sm font-sans font-semibold mb-3">
              Pourquoi pas {mediaType === "tv" ? "cette série" : "ce film"} ?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {REJECT_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => handleReject(reason.id)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-foreground/[0.04] border border-border/15 hover:bg-foreground/[0.08] transition-all"
                >
                  <span>{reason.emoji}</span>
                  <span className="text-foreground/70 text-sm font-sans font-medium">{reason.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const ReviewSheet = ({
  open,
  onClose,
  movieId,
  userCriteria,
}: {
  open: boolean;
  onClose: () => void;
  movieId: number;
  userCriteria?: { mood: Mood | null; context: Context | null; time: TimeAvailable | null };
}) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  if (!open) return null;
  const handleSubmit = () => {
    if (rating > 0) {
      trackInteraction(movieId, "reviewed", { rating, ...userCriteria });
      toast.success("Avis enregistré !");
      onClose();
      setRating(0);
    }
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/20 rounded-t-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-foreground/10 mx-auto mb-4" />
            <p className="text-foreground/80 text-sm font-sans font-semibold mb-3">Note ce film</p>
            <div className="flex items-center gap-2 justify-center mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${star <= (hoveredStar || rating) ? "text-primary fill-primary" : "text-foreground/20"}`}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={rating === 0}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-sans font-semibold disabled:opacity-40 transition-opacity"
            >
              Enregistrer
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const AlternativeMovies = ({ movies, onSelect }: { movies: MovieDetail[]; onSelect: (m: MovieDetail) => void }) => {
  const interactions = useMovieInteractions(
    movies.map((m) => ({
      tmdbId: m.id,
      mediaType: inferCatalogMediaType(m),
    })),
  );

  if (movies.length === 0) return null;

  return (
    <div className="px-5 py-6 md:px-12">
      <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-3">
        Autres suggestions
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {movies.map((movie) => {
          const state = interactions[movie.id];

          return (
            <motion.button
              key={movie.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(movie)}
              className="flex-shrink-0 w-28 group"
            >
              <div className="relative w-28 h-[168px] rounded-xl overflow-hidden border border-border/15 mb-2">
                {movie.poster_path ? (
                  <img
                    src={getPosterUrl(movie.poster_path, "w342") || ""}
                    alt={getDisplayTitle(movie)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full bg-foreground/[0.04] flex items-center justify-center">
                    <span className="text-foreground/20 text-xs font-sans">No img</span>
                  </div>
                )}

                {state?.hasInteraction && (
                  <div className="absolute top-1.5 left-1.5">
                    <FeedbackBadge type={state.primaryStatus} inWatchlist={state.watchlist} seen={state.seen} />
                  </div>
                )}
              </div>

              <p className="text-foreground/60 text-[11px] font-sans font-medium leading-tight truncate">
                {getDisplayTitle(movie)}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

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
  currentIndex?: number;
  totalCount?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  visitedMovieIds?: Set<number>;
  onVisitedMovieIdsChange?: (movieIds: Set<number>) => void;
  batchRejectedIds?: Set<number>;
  onBatchRejectedIdsChange?: (ids: Set<number>) => void;
  sessionId?: string | null;
  onFeedback?: (type: string, movie: MovieDetail) => void;
}

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(
  (
    {
      movie,
      onShowAnother,
      onRestart,
      onRefineWithVoice,
      onRefineWithMessage,
      hasMore,
      userCriteria,
      alternativeMovies,
      onSelectAlternative,
      searchTags,
      onRemoveTag,
      refining,
      profileConfidence = 0,
      currentIndex = 0,
      totalCount = 1,
      onNext,
      onPrevious,
      visitedMovieIds: externalVisited,
      onVisitedMovieIdsChange,
      batchRejectedIds: externalRejected,
      onBatchRejectedIdsChange,
      sessionId,
      onFeedback,
    },
    ref,
  ) => {
    const [providers, setProviders] = useState<{ name: string; logo_path: string; provider_id: number }[]>([]);
    const [credits, setCredits] = useState<MovieCredits | null>(null);
    const [streamingLinks, setStreamingLinks] = useState<StreamingLink[]>([]);
    const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
    const [matchData, setMatchData] = useState<MatchData | null>(null);
    const [prefetchedMatchData, setPrefetchedMatchData] = useState<Record<number, MatchData>>({});
    const [matchLoading, setMatchLoading] = useState(false);
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showRejectReasons, setShowRejectReasons] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState<"good" | "bad" | null>(null);
    const [markedSeen, setMarkedSeen] = useState(false);
    const [rejectReaction, setRejectReaction] = useState<string | null>(null);
    const [showRefineSheet, setShowRefineSheet] = useState(false);
    const [showReviewSheet, setShowReviewSheet] = useState(false);
    const [movieDetailOpen, setMovieDetailOpen] = useState(false);
    const [personDetail, setPersonDetail] = useState<{ item: any; isOpen: boolean }>({ item: null, isOpen: false });
    const [internalVisitedMovieIds, setInternalVisitedMovieIds] = useState<Set<number>>(() => new Set([movie.id]));
    const visitedMovieIds = externalVisited ?? internalVisitedMovieIds;

    const setVisitedMovieIds = (updater: Set<number> | ((prev: Set<number>) => Set<number>)) => {
      const newVal = typeof updater === "function" ? updater(visitedMovieIds) : updater;
      if (onVisitedMovieIdsChange) {
        onVisitedMovieIdsChange(newVal);
      } else {
        setInternalVisitedMovieIds(newVal);
      }
    };

    const { user } = useAuth();
    const interaction = useMovieInteraction(movie.id, inferCatalogMediaType(movie));
    const currentFeedback = interaction.primaryStatus;
    const recommendationCandidates = useMemo(() => {
      const all = [movie, ...(alternativeMovies || [])].filter(Boolean);
      const seen = new Set<number>();
      return all.filter((candidate) => {
        if (!candidate?.id || seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        return true;
      });
    }, [movie, alternativeMovies]);
    const currentRecommendationText = prefetchedMatchData[movie.id] ?? matchData ?? null;

    useEffect(() => {
      if (visitedMovieIds.has(movie.id)) return;
      const next = new Set(visitedMovieIds);
      next.add(movie.id);
      setVisitedMovieIds(next);
    }, [movie.id, visitedMovieIds]);

    const batchKeyRef = useRef<string>("");
    useEffect(() => {
      const key = `${totalCount}-${movie.id}`;
      if (!onVisitedMovieIdsChange && batchKeyRef.current && batchKeyRef.current !== key && currentIndex === 0) {
        setInternalVisitedMovieIds(new Set([movie.id]));
      }
      batchKeyRef.current = key;
    }, [currentIndex, movie.id, onVisitedMovieIdsChange, totalCount]);

    const allVisited = visitedMovieIds.size >= totalCount;
    const isWhyUnlocked = true;

    const title = getDisplayTitle(movie);
    const backdrop = getBackdropUrl(movie.backdrop_path);
    const poster = getPosterUrl(movie.poster_path, "w780");
    const overview = movie.overview || "Aucune description disponible.";
    const mediaType = movie.first_air_date ? "tv" : "movie";
    const isDocumentary = movie.genres?.some((g) => g.id === 99);
    const bgImage = backdrop || poster;

    useEffect(() => {
      trackInteraction(movie.id, "opened", {
        mood: userCriteria?.mood,
        context: userCriteria?.context,
        time: userCriteria?.time,
      });
    }, [movie.id]);

    useEffect(() => {
      getWatchProviders(movie.id, mediaType)
        .then((p) => {
          setProviders(p);
          setStreamingLinks(buildStreamingLinks(p, title));
        })
        .catch(() => {
          setProviders([]);
          setStreamingLinks([]);
        });

      getMovieTrailerUrl(movie.id, mediaType)
        .then(setTrailerUrl)
        .catch(() => setTrailerUrl(null));

      getMovieCredits(movie.id, mediaType)
        .then(setCredits)
        .catch(() => setCredits(null));
    }, [movie.id, mediaType, title]);

    const fetchMatchDataForMovie = useCallback(
      async (targetMovie: MovieDetail): Promise<MatchData | null> => {
        try {
          ensureMovieEmbedding(
            targetMovie.id,
            targetMovie.title || targetMovie.name || "",
            targetMovie.overview || "",
            (targetMovie.genres || []).map((g) => g.name),
          );

          const [tasteProfile, userTasteVector, likedMovies, cinematicProfile, vectorData] = await Promise.all([
            getUserTasteProfile(),
            user ? computeUserTasteVector(user.id) : Promise.resolve(null),
            user ? getLikedMovies().catch(() => []) : Promise.resolve([]),
            user
              ? supabase
                  .from("cinematic_profiles" as any)
                  .select("personality_title, narrative, taste_traits")
                  .eq("user_id", user.id)
                  .maybeSingle()
                  .then((r) => r.data)
              : Promise.resolve(null),
            user
              ? supabase
                  .from("user_taste_vectors" as any)
                  .select("avoidance_vector, recent_taste_vector")
                  .eq("user_id", user.id)
                  .maybeSingle()
                  .then((r) => r.data)
              : Promise.resolve(null),
          ]);

          const likedMovieTitles = (likedMovies || []).map((m: any) => m.title);
          const enrichedProfile = tasteProfile
            ? {
                ...tasteProfile,
                recentTasteVector: (vectorData as any)?.recent_taste_vector || null,
                avoidanceVector: (vectorData as any)?.avoidance_vector || null,
              }
            : null;

          const peoplePreferences = tasteProfile?.peoplePreferences || null;

          const { data, error } = await supabase.functions.invoke("movie-match", {
            body: {
              movie: targetMovie,
              userCriteria,
              tasteProfile: enrichedProfile,
              userTasteVector,
              likedMovieTitles,
              searchTags,
              cinematicProfile,
              peoplePreferences,
              userName: user?.user_metadata?.display_name || user?.email?.split("@")[0] || null,
            },
          });

          if (error) {
            console.error("Match error:", error);
            return null;
          }

          return (data as MatchData) ?? null;
        } catch (error) {
          console.error("fetchMatchDataForMovie failed:", error);
          return null;
        }
      },
      [user, userCriteria, searchTags],
    );

    useEffect(() => {
      let cancelled = false;

      const preloadAllRecommendationTexts = async () => {
        const missingMovies = recommendationCandidates.filter(
          (candidate) => candidate?.id && !prefetchedMatchData[candidate.id],
        );

        if (!missingMovies.length) return;

        const results = await Promise.all(
          missingMovies.map(async (candidate) => ({
            movieId: candidate.id,
            data: await fetchMatchDataForMovie(candidate),
          })),
        );

        if (cancelled) return;

        setPrefetchedMatchData((prev) => {
          const next = { ...prev };
          for (const result of results) {
            if (result.data) next[result.movieId] = result.data;
          }
          return next;
        });
      };

      preloadAllRecommendationTexts();

      return () => {
        cancelled = true;
      };
    }, [recommendationCandidates, prefetchedMatchData, fetchMatchDataForMovie]);

    useEffect(() => {
      let cancelled = false;

      setCredits(null);
      setShowOptions(false);
      setMarkedSeen(false);
      setFeedbackGiven(null);

      const loadCurrentMatchData = async () => {
        const cached = prefetchedMatchData[movie.id];

        if (cached) {
          setMatchData(cached);
          setMatchLoading(false);

          if (user) {
            trackRecommendationEvent({
              tmdbId: movie.id,
              title: movie.title || movie.name || "",
              source: "result_screen",
              scoreBreakdown: (cached as any).scores || {},
            });
          }
          return;
        }

        setMatchData(null);
        setMatchLoading(true);

        const data = await fetchMatchDataForMovie(movie);

        if (cancelled) return;

        if (data) {
          setMatchData(data);
          setPrefetchedMatchData((prev) => ({ ...prev, [movie.id]: data }));

          if (user) {
            trackRecommendationEvent({
              tmdbId: movie.id,
              title: movie.title || movie.name || "",
              source: "result_screen",
              scoreBreakdown: (data as any).scores || {},
            });
          }
        }

        setMatchLoading(false);
      };

      loadCurrentMatchData();

      return () => {
        cancelled = true;
      };
    }, [movie.id, movie, prefetchedMatchData, fetchMatchDataForMovie, user]);

    useEffect(() => {
      const fb = currentFeedback;
      if (fb === "like" || fb === "love") setFeedbackGiven("good");
      else if (fb === "not_for_me" || fb === "dislike") setFeedbackGiven("bad");
      else setFeedbackGiven(null);

      setMarkedSeen(interaction.seen);
      setRejectReaction(fb === "not_for_me" ? "not_for_me" : interaction.seen ? "seen" : null);
    }, [movie.id, currentFeedback, interaction.seen]);

    return (
      <div ref={ref} className="h-full w-full overflow-x-hidden overflow-y-auto">
        <BrandHeader showBack onBack={onRestart} />

        <div className="relative min-h-screen w-full overflow-hidden">
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

          <div className="relative z-10 flex flex-col justify-end min-h-screen px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-12 lg:px-16 md:pb-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-xl"
            >
              {totalCount >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-center gap-4 mb-5"
                >
                  <button
                    onClick={onPrevious}
                    disabled={currentIndex <= 0}
                    className="w-10 h-10 rounded-full bg-card/60 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <span className="text-foreground text-sm font-sans font-semibold tabular-nums px-3 py-1 rounded-full bg-card/60 backdrop-blur-md border border-border/30 shadow-lg">
                    {currentIndex + 1} / {totalCount}
                  </span>
                  <button
                    onClick={onNext}
                    disabled={currentIndex >= totalCount - 1}
                    className="w-10 h-10 rounded-full bg-card/60 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                </motion.div>
              )}

              <button type="button" onClick={() => setMovieDetailOpen(true)} className="block w-full text-left">
                <RecommendationMovieCardHeader movie={movie} />
              </button>

              <StreamingSection streamingLinks={streamingLinks} />

              <div className="mb-4">
                <p
                  className={`text-foreground/60 text-[13px] md:text-sm leading-relaxed font-sans font-light ${!synopsisExpanded ? "line-clamp-2" : ""}`}
                >
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

              {credits && (credits.director || credits.cast.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  className="mb-4"
                >
                  <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2.5">
                    {mediaType === "tv" ? "Équipe de la série" : "Équipe du film"}
                  </p>
                  <div className="rounded-xl bg-foreground/[0.04] border border-border/15 p-3.5">
                    {credits.director && (
                      <button
                        onClick={() =>
                          setPersonDetail({
                            item: {
                              id: credits.director!.id,
                              name: credits.director!.name,
                              profile_path: credits.director!.profile_path,
                            },
                            isOpen: true,
                          })
                        }
                        className="flex items-center gap-2.5 mb-3 group cursor-pointer w-full text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-primary/40 transition-colors">
                          {credits.director.profile_path ? (
                            <img
                              src={`${IMG_BASE}/w185${credits.director.profile_path}`}
                              alt={credits.director.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-primary text-[11px] font-sans font-bold">
                              {credits.director.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground/80 text-[13px] font-sans font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                            {credits.director.name}
                          </p>
                          <p className="text-primary/50 text-[10px] font-sans font-medium uppercase tracking-wider">
                            Réalisateur
                          </p>
                        </div>
                      </button>
                    )}
                    {credits.cast.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                        {credits.cast.map((actor) => (
                          <ActorCard
                            key={actor.id}
                            actor={actor}
                            onClick={() =>
                              setPersonDetail({
                                item: { id: actor.id, name: actor.name, profile_path: actor.profile_path },
                                isOpen: true,
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {trailerUrl && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => window.open(trailerUrl, "_blank")}
                  className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/[0.05] border border-border/15 hover:border-primary/25 hover:bg-foreground/[0.08] transition-all group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Play className="w-3 h-3 text-primary fill-primary ml-0.5" />
                  </div>
                  <span className="text-foreground/60 text-[13px] font-sans font-medium group-hover:text-foreground transition-colors">
                    Voir le trailer
                  </span>
                  <ExternalLink className="w-3 h-3 text-foreground/20" />
                </motion.button>
              )}

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
                {!matchLoading && !isWhyUnlocked && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="mb-5 max-w-md"
                  >
                    <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/30 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-14 h-14 rounded-full bg-muted border-2 border-border/40 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-sans font-semibold mb-0.5">
                            Pourquoi {mediaType === "tv" ? "cette série" : "ce film"}
                          </p>
                          <p className="text-muted-foreground text-[12px] sm:text-[13px] font-sans leading-snug">
                            Utilise Pick un peu plus pour débloquer l'analyse personnalisée.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground/60 font-sans">Confiance du profil</span>
                          <span className="text-[10px] text-muted-foreground/60 font-sans font-medium">
                            {profileConfidence}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((profileConfidence / CONFIDENCE_THRESHOLD) * 100, 100)}%` }}
                            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full bg-primary/40"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                {matchData && !matchLoading && isWhyUnlocked && (
                  <MatchAnalysis matchData={matchData} mediaType={mediaType} movieId={movie.id} />
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-4 w-full">
                  <Button
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-8 h-12 gap-2 text-base neon-glow transition-all active:scale-[0.97] w-full max-w-xs"
                    onClick={() => {
                      trackInteraction(movie.id, "watched", {
                        mood: userCriteria?.mood,
                        context: userCriteria?.context,
                      });
                      updateRecommendationReaction(movie.id, "accepted", "on_regarde");
                      toast.success("Bon visionnage ! 🍿");
                    }}
                  >
                    <Tv className="w-5 h-5" />
                    On regarde ?
                  </Button>

                  <MovieActionBar
                    key={movie.id}
                    movie={movie}
                    sessionId={sessionId ?? null}
                    contextType={sessionId ? "solo_session" : "browse"}
                    onInteraction={(type) => {
                      onFeedback?.(type, movie);
                      if (type === "already_seen" || type === "dislike") {
                        const nextRejected = new Set<number>(externalRejected || []);
                        nextRejected.add(movie.id);
                        onBatchRejectedIdsChange?.(nextRejected);

                        if (nextRejected.size >= totalCount) {
                          setTimeout(() => onShowAnother(type === "dislike" ? "dislike" : "seen", movie), 400);
                          return;
                        }

                        if (onNext && currentIndex < totalCount - 1) {
                          setTimeout(() => onNext(), 250);
                        } else if (onPrevious && currentIndex > 0) {
                          setTimeout(() => onPrevious!(), 250);
                        }
                      }
                    }}
                  />

                  <div className="flex flex-col items-center gap-1.5 mt-2">
                    <div className="relative group">
                      <button
                        data-tour="autre-suggestion"
                        onClick={() => onShowAnother()}
                        disabled={refining || !allVisited}
                        className={`text-[12px] font-sans transition-all flex items-center gap-1.5 ${
                          allVisited
                            ? "text-foreground/40 hover:text-foreground/60"
                            : "text-foreground/20 cursor-not-allowed"
                        } disabled:opacity-50`}
                      >
                        {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dices className="w-3 h-3" />}5
                        autres suggestions
                      </button>
                    </div>
                    {!allVisited && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-foreground/25 text-[10px] font-sans text-center"
                      >
                        Parcourez les {totalCount} films pour débloquer ({visitedMovieIds.size}/{totalCount})
                      </motion.p>
                    )}
                  </div>

                  {refining && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-3">
                      <PickCharacter mood="think" message="Attends, je cherche mieux…" size="sm" animate={false} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {alternativeMovies && alternativeMovies.length > 0 && onSelectAlternative && (
          <AlternativeMovies movies={alternativeMovies.filter((_, i) => i < 2)} onSelect={onSelectAlternative} />
        )}

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
        <FlipCardDetail
          item={movie}
          type="movie"
          isOpen={movieDetailOpen}
          onClose={() => setMovieDetailOpen(false)}
          recommendationTexts={currentRecommendationText}
          recommendationTextsByMovieId={prefetchedMatchData}
        />
        <FlipCardDetail
          item={personDetail.item}
          type="person"
          isOpen={personDetail.isOpen}
          onClose={() => setPersonDetail({ item: null, isOpen: false })}
        />
      </div>
    );
  },
);

ResultScreen.displayName = "ResultScreen";

export default ResultScreen;
