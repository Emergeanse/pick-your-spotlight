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
  { id: "too-long", label: "Trop long", emoji: "⏳" },
  { id: "too-intense", label: "Trop intense", emoji: "⚡" },
  { id: "dislike", label: "Pas pour moi", emoji: "👎" },
];

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
  recommendationBatch?: MovieDetail[];
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
      recommendationBatch,
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
      const source =
        recommendationBatch && recommendationBatch.length > 0
          ? recommendationBatch
          : [movie, ...(alternativeMovies || [])];

      const all = source.filter(Boolean);
      const seen = new Set<number>();
      return all.filter((candidate) => {
        if (!candidate?.id || seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        return true;
      });
    }, [recommendationBatch, movie, alternativeMovies]);
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
              title,
              source: sessionId ? "session" : "browse",
              scoreBreakdown: { match: cached.matchScore ?? cached.score ?? 0 },
              context: { sessionId: sessionId ?? null },
            }).catch(() => {});
          }
          return;
        }

        setMatchLoading(true);
        const data = await fetchMatchDataForMovie(movie);
        if (cancelled) return;
        setMatchData(data);
        setMatchLoading(false);

        if (data) {
          setPrefetchedMatchData((prev) => ({ ...prev, [movie.id]: data }));
          if (user) {
            trackRecommendationEvent({
              tmdbId: movie.id,
              title,
              source: sessionId ? "session" : "browse",
              scoreBreakdown: { match: data.matchScore ?? data.score ?? 0 },
              context: { sessionId: sessionId ?? null },
            }).catch(() => {});
          }
        }
      };

      loadCurrentMatchData();
      return () => {
        cancelled = true;
      };
    }, [movie.id, fetchMatchDataForMovie, prefetchedMatchData, sessionId, title, user]);

    const handleRejectWithReason = async (reasonId: string) => {
      setRejectReaction(reasonId);
      setFeedbackGiven("bad");
      toast.success("Bien noté, Pick affine ses choix");

      try {
        await updateRecommendationReaction(movie.id, "rejected", reasonId);
      } catch {}

      const nextRejected = new Set<number>(externalRejected || []);
      nextRejected.add(movie.id);
      onBatchRejectedIdsChange?.(nextRejected);

      setShowRejectReasons(false);

      if (nextRejected.size >= totalCount) {
        setTimeout(() => onShowAnother(reasonId === "dislike" ? "dislike" : "seen", movie), 400);
        return;
      }

      if (onNext && currentIndex < totalCount - 1) {
        setTimeout(() => onNext(), 250);
      } else if (onPrevious && currentIndex > 0) {
        setTimeout(() => onPrevious(), 250);
      }
    };

    const cast = credits?.cast?.slice(0, 10) || [];
    const director = credits?.director ? { name: credits.director } : undefined;

    return (
      <div ref={ref} className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-background">
        {bgImage && (
          <motion.div
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9 }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}
        <div className="absolute inset-0 poster-gradient" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />

        <div className="relative z-10 min-h-full px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-8 lg:px-12">
          <BrandHeader />

          <div className="max-w-xl pt-4 md:pt-6">
            <RecommendationMovieCardHeader movie={movie} onOpenDetails={() => setMovieDetailOpen(true)} />

            {matchLoading ? (
              <div className="mb-5 flex items-center gap-2 text-foreground/40 text-sm font-sans">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyse de Pick…
              </div>
            ) : currentRecommendationText ? (
              <MatchAnalysis matchData={currentRecommendationText} mediaType={mediaType} movieId={movie.id} />
            ) : null}

            <StreamingSection streamingLinks={streamingLinks} />

            {overview && (
              <div className="mb-4 max-w-xl">
                <button
                  onClick={() => setSynopsisExpanded((v) => !v)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2"
                >
                  Synopsis
                  {synopsisExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <p className={`text-sm text-foreground/72 leading-relaxed ${synopsisExpanded ? "" : "line-clamp-4"}`}>
                  {overview}
                </p>
              </div>
            )}

            {cast.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
                  Casting
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {cast.map((actor) => (
                    <ActorCard
                      key={actor.id}
                      actor={actor}
                      onClick={() => setPersonDetail({ item: actor, isOpen: true })}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              {trailerUrl ? (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-sans font-semibold shadow-lg hover:opacity-95 transition-opacity"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Voir la bande-annonce
                </a>
              ) : null}
            </div>
          </div>

          <div className="fixed left-0 right-0 bottom-0 z-20 border-t border-border/20 bg-background/84 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-18px_40px_hsl(var(--background)/0.32)]">
            <div className="mx-auto max-w-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  onClick={onRestart}
                  className="rounded-full bg-foreground/5 p-2 text-foreground/30 transition-all hover:bg-foreground/10"
                  aria-label="Revenir"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2 text-center">
                  {currentFeedback || interaction.watchlist || interaction.seen ? (
                    <FeedbackBadge
                      type={currentFeedback}
                      inWatchlist={interaction.watchlist}
                      seen={interaction.seen}
                      size="sm"
                    />
                  ) : null}
                </div>

                <button
                  onClick={() => setShowOptions(true)}
                  className="rounded-full bg-foreground/5 p-2 text-foreground/30 transition-all hover:bg-foreground/10"
                  aria-label="Options"
                >
                  <Dices className="h-5 w-5" />
                </button>
              </div>

              <MovieActionBar
                movie={movie}
                sessionId={sessionId}
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
                    {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}5
                    autres suggestions
                  </button>
                  {!allVisited && (
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block whitespace-nowrap rounded-lg bg-background/95 border border-border/20 px-2.5 py-1.5 shadow-xl">
                      <p className="text-[10px] text-foreground/50 font-sans">
                        Parcours les {totalCount} suggestions d'abord
                      </p>
                    </div>
                  )}
                </div>
                {totalCount > 1 && (
                  <p className="text-[10px] text-foreground/25 font-sans">
                    {visitedMovieIds.size}/{totalCount} vues
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

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

        <AnimatePresence>
          {showRejectReasons && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowRejectReasons(false)}
                className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/20 rounded-t-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              >
                <div className="w-10 h-1 rounded-full bg-foreground/10 mx-auto mb-4" />
                <p className="text-foreground/80 text-sm font-sans font-semibold mb-3">Pourquoi pas ?</p>
                <div className="grid grid-cols-2 gap-2">
                  {REJECT_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => handleRejectWithReason(reason.id)}
                      className="flex items-center gap-2 px-3 py-3 rounded-xl bg-foreground/[0.04] border border-border/15 hover:bg-foreground/[0.08] transition-all text-left"
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
