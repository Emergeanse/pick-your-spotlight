import { useState, useEffect, forwardRef, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Send, Loader2, Sparkles, Check, Play, Star, Clock, Heart, Bookmark, Tv, ChevronDown, ChevronUp, MoreHorizontal, RefreshCw, MessageCircle, Volume2, ExternalLink, Share2, Zap, Lock, PenLine } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders, getMovieTrailerUrl } from "@/lib/tmdb";
import { buildStreamingLinks, openStreamingLink, type StreamingLink } from "@/lib/streaming-links";
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


const IMG_BASE = "https://image.tmdb.org/t/p";

interface MatchData {
  matchScore: number;
  headline: string;
  pickNote?: string | null;
  whyItMatches: string;
  detailedExplanation: string;
  emotionalJourney: string;
  perfectFor: string;
  funFact: string;
  similarLikedMovies?: string[];
  matchingReasons?: string[];
}

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: (rejectReason?: string, rejectedMovie?: MovieDetail) => void;
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
  refining?: boolean;
  profileConfidence?: number;
}

const REJECT_REACTIONS: Record<string, string[]> = {
  already_seen: [
    "Ah t'as déjà vu celui-là ! Attends, j'en ai un autre.",
    "Noté ! Voyons ce que j'ai d'autre dans ma collection.",
    "OK, on raye celui-là. J'ai mieux, promis.",
    "Déjà vu ? T'es rapide. Allez, suivant !",
    "Pas de souci, j'en ai plein d'autres en stock.",
    "Tu connais déjà ? Bon goût ! Allez, un autre.",
  ],
  not_my_style: [
    "Pas ton délire ? OK, je change de direction.",
    "Hmm, je vois. Laisse-moi fouiller dans un autre registre.",
    "OK, changeons d'ambiance.",
    "Compris, c'est pas ton truc. J'ajuste !",
    "Reçu 5 sur 5. Je vais chercher ailleurs.",
    "OK, oublie celui-là. Je reviens avec mieux.",
    "Pas convaincu ? Moi non plus finalement. Suivant !",
    "C'est noté dans mon carnet de tes goûts.",
  ],
  too_long: [
    "Trop long ? J'ai un truc plus court en réserve.",
    "OK, on part sur quelque chose de plus rapide.",
    "Compris, pas le temps pour un marathon. J'adapte.",
    "Plus court, plus punchy. Ça marche !",
    "T'inquiète, j'ai des films express aussi.",
  ],
  not_tonight: [
    "Pas ce soir ? Pas de souci, j'ai mieux pour l'instant.",
    "Attends, celui-ci pourrait mieux te plaire.",
    "Pas convaincu ? J'en ai un autre.",
    "Ça matche pas ? Allez, on repart de zéro.",
    "T'as raison, on peut faire mieux. Regarde ça.",
    "OK, je pioche dans mon autre poche.",
    "Hmm, je comprends. Laisse-moi réfléchir…",
    "Pas grave ! C'est ça le jeu, on cherche ensemble.",
    "Allez hop, on passe au suivant !",
  ],
};

function getRejectReaction(reason: string): string {
  const messages = REJECT_REACTIONS[reason] || REJECT_REACTIONS.not_tonight;
  return messages[Math.floor(Math.random() * messages.length)];
}

const CONFIDENCE_THRESHOLD = 30;

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({ movie, onShowAnother, onRestart, onRefineWithVoice, onRefineWithMessage, onStartCompanion, hasMore, userCriteria, alternativeMovies, onSelectAlternative, searchTags, onRemoveTag, refining, profileConfidence = 0 }, ref) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string; provider_id: number }[]>([]);
  const [streamingLinks, setStreamingLinks] = useState<StreamingLink[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showRejectReasons, setShowRejectReasons] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"good" | "bad" | null>(null);
  const [markedSeen, setMarkedSeen] = useState(false);
  const [rejectReaction, setRejectReaction] = useState<string | null>(null);
  const [altProviders, setAltProviders] = useState<Record<number, { name: string; logo_path: string }[]>>({});
  const [whySpeaking, setWhySpeaking] = useState(false);
  const [whyAudioLoading, setWhyAudioLoading] = useState(false);
  const { user } = useAuth();
  const [youtubeVideo, setYoutubeVideo] = useState<YouTubeVideo | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewVoiceListening, setReviewVoiceListening] = useState(false);
  const [reviewVoiceProcessing, setReviewVoiceProcessing] = useState(false);
  const reviewRecorderRef = useRef<MediaRecorder | null>(null);
  const reviewChunksRef = useRef<Blob[]>([]);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const isWhyUnlocked = true; // All features unlocked for now

  const playBrowserWhyFallback = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setWhySpeaking(true);
    utterance.onend = () => setWhySpeaking(false);
    utterance.onerror = () => setWhySpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const handleReadWhy = useCallback(async () => {
    if (!matchData || whyAudioLoading || whySpeaking) return;
    const textToRead = [
      matchData.headline,
      matchData.detailedExplanation,
      matchData.emotionalJourney,
      matchData.perfectFor,
    ].filter(Boolean).join(". ");
    if (!textToRead) return;
    setWhyAudioLoading(true);

    // Prime an Audio object WITHIN the user gesture to satisfy iOS Safari autoplay policy
    const audio = new Audio();
    audio.volume = 1;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pick-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: textToRead }),
        }
      );
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`TTS failed: ${response.status} ${errorBody}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      setWhySpeaking(true);
      audio.onended = () => { setWhySpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setWhySpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (e) {
      console.error("Why TTS error:", e);
      const fallbackStarted = playBrowserWhyFallback(textToRead);
      if (!fallbackStarted) {
        setWhySpeaking(false);
      }
    } finally {
      setWhyAudioLoading(false);
    }
  }, [matchData, whyAudioLoading, whySpeaking, playBrowserWhyFallback]);

  const isYouTube = !!(movie as any)._youtube;
  const youtubeData = (movie as any)._youtubeData;

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = isYouTube && movie.backdrop_path?.startsWith("http")
    ? movie.backdrop_path
    : getBackdropUrl(movie.backdrop_path);
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
    if (isYouTube) { setProviders([]); setStreamingLinks([]); setTrailerUrl(null); return; }
    getWatchProviders(movie.id, mediaType).then((p) => {
      setProviders(p);
      setStreamingLinks(buildStreamingLinks(p, title));
    }).catch(() => { setProviders([]); setStreamingLinks([]); });
    getMovieTrailerUrl(movie.id, mediaType).then(setTrailerUrl).catch(() => setTrailerUrl(null));
  }, [movie.id, mediaType, isYouTube]);

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
    setMarkedSeen(false);
    setFeedbackGiven(null);
    setReviewSubmitted(false);
    setReviewText("");
    setShowReviewSheet(false);
    setYoutubeVideo(null);

    // Fetch a YouTube video about this movie (skip if movie IS a YouTube video)
    if (!isYouTube) {
      setYoutubeLoading(true);
      getYouTubeRecommendations("cinema-culture", `${title} film analyse critique`, 3)
        .then((videos) => {
          if (videos.length > 0) setYoutubeVideo(videos[0]);
        })
        .catch(() => {})
        .finally(() => setYoutubeLoading(false));
    }

    // Pre-generate embedding for this movie (fire & forget) — skip for YouTube
    if (!isYouTube) {
      ensureMovieEmbedding(
        movie.id,
        movie.title || movie.name || "",
        movie.overview || "",
        (movie.genres || []).map(g => g.name)
      );
    }

    // Load taste profile for match analysis (movies AND YouTube)
    Promise.all([
      getUserTasteProfile(),
      user ? computeUserTasteVector(user.id) : Promise.resolve(null),
      user ? getLikedMovies().catch(() => []) : Promise.resolve([]),
      user ? supabase.from("cinematic_profiles" as any).select("personality_title, narrative, taste_traits").eq("user_id", user.id).maybeSingle().then(r => r.data) : Promise.resolve(null),
    ]).then(([tasteProfile, userTasteVector, likedMovies, cinematicProfile]) => {
      const likedMovieTitles = (likedMovies || []).map((m: any) => m.title);
      supabase.functions.invoke("movie-match", {
        body: { movie, userCriteria, tasteProfile, userTasteVector: isYouTube ? null : userTasteVector, likedMovieTitles, searchTags, cinematicProfile },
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

  const [showRefineSheet, setShowRefineSheet] = useState(false);

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
              {/* Mini poster */}
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
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif mb-1.5 leading-[1.05]">
                  {title}
                </h1>

                {/* Meta: Year • Runtime • Rating / Views */}
                <div className="flex items-center gap-2 text-foreground/50 text-xs font-sans mb-1 flex-wrap">
                  {isYouTube && youtubeData?.channelTitle && (
                    <>
                      <span className="font-medium text-foreground/70">{youtubeData.channelTitle}</span>
                      <span className="text-foreground/20">•</span>
                    </>
                  )}
                  {!isYouTube && year && <span className="font-medium text-foreground/70">{year}</span>}
                  {!isYouTube && year && runtime > 0 && <span className="text-foreground/20">•</span>}
                  {runtime > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {runtime} min
                    </span>
                  )}
                  {isYouTube && youtubeData?.viewCount > 0 && (
                    <>
                      <span className="text-foreground/20">•</span>
                      <span className="text-foreground/60 font-medium">
                        {youtubeData.viewCount > 1_000_000
                          ? `${(youtubeData.viewCount / 1_000_000).toFixed(1)}M vues`
                          : youtubeData.viewCount > 1_000
                            ? `${(youtubeData.viewCount / 1_000).toFixed(0)}K vues`
                            : `${youtubeData.viewCount} vues`}
                      </span>
                    </>
                  )}
                  {!isYouTube && movie.vote_average > 0 && (
                    <>
                      <span className="text-foreground/20">•</span>
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Star className="w-3 h-3 fill-primary" />
                        {movie.vote_average.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                {/* Genres + Comfort zone badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  {genres && (
                    <p className="text-primary/60 text-[10px] md:text-xs tracking-[0.12em] uppercase font-sans font-medium">
                      {genres}
                    </p>
                  )}
                  {(movie as any)._surpriseComfortZone && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30"
                    >
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-amber-400 text-[10px] font-sans font-semibold">
                        Hors de ta zone
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Where to watch / YouTube CTA */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4"
            >
              {isYouTube && youtubeData?.url ? (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
                    Regarder
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => window.open(youtubeData.url, "_blank", "noopener")}
                    className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-red-600 text-white hover:bg-red-700 font-sans font-semibold text-sm transition-all active:scale-[0.98]"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Regarder sur YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </motion.button>
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
                    Où regarder
                  </p>

                  {streamingLinks.length === 0 ? (
                    /* No platform available */
                    <div className="rounded-xl bg-foreground/[0.04] border border-border/15 p-3.5">
                      <p className="text-foreground/40 text-[12px] font-sans mb-2.5">
                        Non disponible en streaming actuellement
                      </p>
                      {!bookmarked && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleToggleBookmark}
                          disabled={bookmarkLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/25 text-primary text-[12px] font-sans font-semibold hover:bg-primary/15 transition-all"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          Sauvegarder pour plus tard
                        </motion.button>
                      )}
                    </div>
                  ) : streamingLinks.length === 1 ? (
                    /* Single platform — full-width prominent button */
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        trackInteraction(movie.id, "watch_clicked", { platform: streamingLinks[0].name });
                        openStreamingLink(streamingLinks[0]);
                      }}
                      className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold text-sm neon-glow transition-all active:scale-[0.98]"
                    >
                      <img
                        src={`${IMG_BASE}/w92${streamingLinks[0].logo_path}`}
                        alt={streamingLinks[0].name}
                        className="w-6 h-6 rounded-md object-cover"
                      />
                      <span>Regarder sur {streamingLinks[0].name}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </motion.button>
                  ) : (
                    /* Multiple platforms — list with open buttons */
                    <div className="flex flex-col gap-2">
                      {streamingLinks.slice(0, 6).map((link) => (
                        <motion.button
                          key={link.providerId + link.name}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            trackInteraction(movie.id, "watch_clicked", { platform: link.name });
                            openStreamingLink(link);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-foreground/[0.05] border border-border/20 hover:border-primary/30 hover:bg-foreground/[0.08] transition-all active:scale-[0.98] group"
                        >
                          <img
                            src={`${IMG_BASE}/w92${link.logo_path}`}
                            alt={link.name}
                            className="w-8 h-8 rounded-lg object-cover shrink-0"
                          />
                          <span className="text-foreground/70 text-[13px] font-sans font-medium flex-1 text-left group-hover:text-foreground transition-colors">
                            {link.name}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-sans font-semibold group-hover:bg-primary/25 transition-colors">
                            Ouvrir
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* Synopsis — expandable */}
            <div className="mb-4">
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

            {/* Trailer — hide for YouTube */}
            {!isYouTube && trailerUrl && (
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

            {/* "Pourquoi ce film" — combined match score + explanation */}
            {<AnimatePresence>
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

              {/* Locked state — not enough data */}
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
                          {isYouTube ? "Pourquoi cette vidéo" : "Pourquoi ce film"}
                        </p>
                        <p className="text-muted-foreground text-[12px] sm:text-[13px] font-sans leading-snug">
                          Utilise Pick un peu plus pour débloquer l'analyse personnalisée de tes recommandations.
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground/60 font-sans">Confiance du profil</span>
                        <span className="text-[10px] text-muted-foreground/60 font-sans font-medium">{profileConfidence}%</span>
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

              {/* Unlocked "Pourquoi ce film" */}
              {matchData && !matchLoading && isWhyUnlocked && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mb-5 max-w-md"
                >
                  <div className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/30 backdrop-blur-sm">
                    {/* Match score hero + headline */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
                          <span className="text-primary text-lg font-serif font-bold leading-none">{matchData.matchScore}%</span>
                        </div>
                        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold mb-0.5">
                          {isYouTube ? "Pourquoi cette vidéo" : "Pourquoi ce film"}
                        </p>
                        <p className="text-foreground/70 text-[12px] sm:text-[13px] font-sans leading-snug">
                          {matchData.headline}
                        </p>
                      </div>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        onClick={(e) => { e.stopPropagation(); handleReadWhy(); }}
                        disabled={whyAudioLoading || whySpeaking}
                        className={`flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                          whySpeaking
                            ? "bg-primary/25 border-primary/50 text-primary"
                            : "bg-primary/20 border-primary/35 text-foreground/80 hover:text-primary hover:bg-primary/30"
                        }`}
                      >
                        {whyAudioLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className={`w-3.5 h-3.5 ${whySpeaking ? "text-primary animate-pulse" : ""}`} />
                        )}
                      </motion.button>
                    </div>

                    {/* Detailed explanation */}
                    {matchData.detailedExplanation && (
                      <div>
                        <p className={`text-foreground/55 text-[12px] font-sans leading-relaxed ${!whyExpanded ? "line-clamp-2" : ""}`}>
                          {matchData.detailedExplanation}
                        </p>
                        {matchData.detailedExplanation.length > 100 && !whyExpanded && (
                          <button
                            onClick={() => setWhyExpanded(true)}
                            className="text-primary/60 text-[11px] font-sans font-medium mt-1 flex items-center gap-0.5 hover:text-primary transition-colors"
                          >
                            Voir plus
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <AnimatePresence>
                      {whyExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 space-y-3">
                            {matchData.emotionalJourney && (
                              <div>
                                <p className="text-[10px] text-primary/50 font-sans font-medium mb-1">L'expérience</p>
                                <p className="text-foreground/50 text-[12px] font-sans leading-relaxed italic">
                                  {matchData.emotionalJourney}
                                </p>
                              </div>
                            )}
                            {matchData.perfectFor && (
                              <div className="flex items-start gap-2">
                                <Sparkles className="w-3 h-3 text-primary/50 mt-0.5 flex-shrink-0" />
                                <p className="text-foreground/50 text-[12px] font-sans leading-relaxed">
                                  {matchData.perfectFor}
                                </p>
                              </div>
                            )}
                            {matchData.similarLikedMovies && matchData.similarLikedMovies.length > 0 && (
                              <div>
                                <p className="text-[10px] text-primary/50 font-sans font-medium mb-1.5">Parce que tu as aimé</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {matchData.similarLikedMovies.map((t) => (
                                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-sans font-medium">
                                      <Heart className="w-2.5 h-2.5 fill-primary" />{t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {matchData.matchingReasons && matchData.matchingReasons.length > 0 && (
                              <div>
                                <p className="text-[10px] text-primary/50 font-sans font-medium mb-1.5">Ce qui correspond</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {matchData.matchingReasons.map((reason) => (
                                    <span key={reason} className="inline-flex items-center px-2.5 py-1 rounded-full bg-foreground/5 border border-border/30 text-foreground/60 text-[11px] font-sans font-medium">
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {matchData.funFact && (
                              <div className="flex items-start gap-2 pt-1 border-t border-primary/10">
                                <span className="text-sm mt-0.5 flex-shrink-0">🎬</span>
                                <div>
                                  <p className="text-[10px] text-primary/50 font-sans font-semibold tracking-wide uppercase mb-0.5">Fun fact</p>
                                  <p className="text-foreground/50 text-[12px] font-sans leading-relaxed">{matchData.funFact}</p>
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => setWhyExpanded(false)}
                              className="text-primary/60 text-[11px] font-sans font-medium mt-1 flex items-center gap-0.5 hover:text-primary transition-colors"
                            >
                              Réduire
                              <ChevronUp className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>}

            {/* Pour aller plus loin — YouTube video (hide when content IS YouTube) */}
            {!isYouTube && youtubeVideo && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="mb-5 max-w-md"
              >
                <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
                  Pour aller plus loin
                </p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.open(youtubeVideo.url, "_blank", "noopener")}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-foreground/[0.04] border border-border/15 hover:border-red-500/25 hover:bg-foreground/[0.06] transition-all group cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 aspect-video rounded-lg overflow-hidden shrink-0">
                    <img
                      src={youtubeVideo.thumbnail}
                      alt={youtubeVideo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                        <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] font-sans font-medium text-foreground/70 line-clamp-2 leading-snug mb-1 group-hover:text-foreground transition-colors">
                      {youtubeVideo.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-foreground/30 text-[10px] font-sans">
                      <span className="truncate max-w-[120px]">{youtubeVideo.channelTitle}</span>
                      {youtubeVideo.viewCount > 0 && <span>· {formatViews(youtubeVideo.viewCount)}</span>}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-foreground/20 group-hover:text-red-400 shrink-0 transition-colors" />
                </motion.button>
              </motion.div>
            )}

            {/* Primary Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              {/* Main CTA row */}
              <div className="flex items-center gap-2.5">
                {!isYouTube && onStartCompanion && (
                  <Button
                    size="lg"
                    className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold h-12 gap-2 text-[15px] neon-glow-strong transition-all active:scale-[0.97]"
                    onClick={onStartCompanion}
                  >
                    <Tv className="w-5 h-5" />
                    Lancer le compagnon 🍿
                  </Button>
                )}
              </div>

              {/* Compact secondary actions — icon row */}
              <div className="flex items-center gap-2">
                {/* Bookmark / Sauvegarder */}
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

                {/* Like */}
                <button
                  onClick={handleToggleLike}
                  disabled={likeLoading}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                    liked
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${liked ? "fill-primary" : ""}`} />
                </button>

                {/* Share */}
                <button
                  onClick={() => {
                    const shareText = `Pick me suggère "${title}" ce soir — tu veux qu'on le regarde ensemble ? 🍿`;
                    const shareUrl = window.location.origin;
                    if (navigator.share) {
                      navigator.share({ title: `Pick — ${title}`, text: shareText, url: shareUrl }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                        toast.success("Lien copié !");
                      }).catch(() => {});
                    }
                  }}
                  className="w-9 h-9 rounded-full border border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25 flex items-center justify-center transition-all active:scale-95"
                  title="Partager"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                {/* Spacer + Refine with Pick button */}
                <div className="flex-1" />
                {matchData && !refining && (
                  <button
                    onClick={() => setShowRefineSheet(true)}
                    className="flex items-center gap-1.5 px-3.5 h-9 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-sans font-medium hover:bg-primary/15 transition-all active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Affiner
                  </button>
                )}
              </div>

              {/* Search context tags */}
              {searchTags && searchTags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Check className="w-3 h-3 text-primary/60" />
                    <p className="text-[10px] uppercase tracking-widest text-primary/50 font-sans font-semibold">
                      Pick a compris
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchTags.map((tag, i) => (
                      <motion.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.9 + i * 0.08 }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary/80 text-[11px] font-sans font-medium group"
                      >
                        {tag}
                        {onRemoveTag && (
                          <button
                            onClick={() => onRemoveTag(tag)}
                            className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-primary/30 hover:text-primary hover:bg-primary/15 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Refining loading state */}
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

      {/* Bottom Sheet: Affiner avec Pick */}
      <AnimatePresence>
        {showRefineSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowRefineSheet(false)}
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PickCharacter mood="default" size="sm" animate={false} />
                    <p className="text-foreground/60 text-[13px] font-sans">Dis-moi ce que tu veux d'autre</p>
                  </div>
                  <button onClick={() => setShowRefineSheet(false)} className="text-foreground/30 hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem("refineInput") as HTMLInputElement;
                    const msg = input?.value?.trim();
                    if (msg) {
                      onRefineWithMessage?.(msg);
                      input.value = "";
                      setShowRefineSheet(false);
                    }
                  }}
                  className="flex items-center gap-2 mb-3"
                >
                  <input
                    name="refineInput"
                    type="text"
                    placeholder="Dis à Pick ce que tu veux…"
                    className="flex-1 px-4 py-2.5 rounded-full bg-foreground/[0.05] border border-border/30 text-foreground text-[13px] font-sans placeholder:text-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-foreground/[0.08] transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={voiceProcessing}
                    onClick={async () => {
                      if (voiceListening) {
                        voiceRecorderRef.current?.stop();
                        setVoiceListening(false);
                        return;
                      }
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
                        voiceChunksRef.current = [];
                        recorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
                        recorder.onstop = async () => {
                          stream.getTracks().forEach(t => t.stop());
                          setVoiceListening(false);
                          setVoiceProcessing(true);
                          try {
                            const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType });
                            const formData = new FormData();
                            formData.append("audio", blob, "audio.webm");
                            const sttResp = await fetch(
                              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-refine`,
                              {
                                method: "POST",
                                headers: {
                                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                                },
                                body: formData,
                              }
                            );
                            if (!sttResp.ok) throw new Error("STT failed");
                            const sttData = await sttResp.json();
                            const transcript = sttData.text?.trim();
                            if (transcript) {
                              onRefineWithMessage?.(transcript);
                              setShowRefineSheet(false);
                            } else {
                              toast.error("Je n'ai rien entendu, réessaie.");
                            }
                          } catch (err) {
                            console.error("Voice refine error:", err);
                            toast.error("Erreur de reconnaissance vocale");
                          } finally {
                            setVoiceProcessing(false);
                          }
                        };
                        voiceRecorderRef.current = recorder;
                        recorder.start();
                        setVoiceListening(true);
                      } catch {
                        toast.error("Impossible d'accéder au micro");
                      }
                    }}
                    className={`flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                      voiceListening
                        ? "bg-destructive/20 border-destructive/40 text-destructive animate-pulse"
                        : voiceProcessing
                          ? "bg-primary/10 border-primary/20 text-primary/50"
                          : "bg-primary/20 border-primary/30 text-primary hover:bg-primary/30"
                    }`}
                  >
                    {voiceProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : voiceListening ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="submit"
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/30 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Plus intense", message: "Je veux quelque chose de plus intense" },
                    { label: "Plus émouvant", message: "Je veux quelque chose de plus émouvant et touchant" },
                    { label: "Plus court", message: "Je préfère un film plus court" },
                    { label: "Plus drôle", message: "Je veux un truc plus drôle et léger" },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => { onRefineWithMessage?.(chip.message); setShowRefineSheet(false); }}
                      className="px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/25 text-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/5 text-[11px] font-sans transition-all active:scale-95"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                        const reaction = getRejectReaction(reason.value);
                        setRejectReaction(reaction);
                        // Show Pick's reaction briefly, then trigger next movie with rejection context
                        setTimeout(() => {
                          setRejectReaction(null);
                          onShowAnother(reason.value, movie);
                        }, 1800);
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

      {/* Pick's reject reaction overlay */}
      <AnimatePresence>
        {rejectReaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <PickCharacter mood="think" message={rejectReaction} size="lg" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sheet: Post-watch review */}
      <AnimatePresence>
        {showReviewSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowReviewSheet(false)}
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
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PickCharacter mood="default" size="sm" animate={false} />
                    <div>
                      <p className="text-sm font-sans font-semibold text-foreground">T'en as pensé quoi ?</p>
                      <p className="text-foreground/40 text-[11px] font-sans">Tes retours aident Pick à mieux te connaître</p>
                    </div>
                  </div>
                  <button onClick={() => setShowReviewSheet(false)} className="text-foreground/30 hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {reviewSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 py-4 justify-center"
                  >
                    <Check className="w-5 h-5 text-primary" />
                    <p className="text-foreground/60 text-sm font-sans">Merci ! Pick en prend note 🧠</p>
                  </motion.div>
                ) : (
                  <>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const text = reviewText.trim();
                        if (!text) return;
                        setReviewSubmitting(true);
                        try {
                          await trackInteraction(movie.id, "reviewed", {
                            mood: userCriteria?.mood,
                            context: userCriteria?.context,
                            time: userCriteria?.time,
                            review: text,
                          });
                          setReviewSubmitted(true);
                          toast.success("Avis enregistré !");
                        } catch {
                          toast.error("Erreur lors de l'envoi");
                        } finally {
                          setReviewSubmitting(false);
                        }
                      }}
                      className="space-y-3"
                    >
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Dis ce que tu as aimé ou pas, ce que tu as ressenti…"
                        className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-border/30 text-foreground text-[13px] font-sans placeholder:text-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-foreground/[0.08] transition-all resize-none min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        {/* Voice input */}
                        <button
                          type="button"
                          disabled={reviewVoiceProcessing}
                          onClick={async () => {
                            if (reviewVoiceListening) {
                              reviewRecorderRef.current?.stop();
                              setReviewVoiceListening(false);
                              return;
                            }
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                              const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
                              reviewChunksRef.current = [];
                              recorder.ondataavailable = (ev) => { if (ev.data.size > 0) reviewChunksRef.current.push(ev.data); };
                              recorder.onstop = async () => {
                                stream.getTracks().forEach(t => t.stop());
                                setReviewVoiceListening(false);
                                setReviewVoiceProcessing(true);
                                try {
                                  const blob = new Blob(reviewChunksRef.current, { type: recorder.mimeType });
                                  const formData = new FormData();
                                  formData.append("audio", blob, "audio.webm");
                                  const sttResp = await fetch(
                                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-refine`,
                                    {
                                      method: "POST",
                                      headers: {
                                        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                                        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                                      },
                                      body: formData,
                                    }
                                  );
                                  if (!sttResp.ok) throw new Error("STT failed");
                                  const sttData = await sttResp.json();
                                  const transcript = sttData.text?.trim();
                                  if (transcript) {
                                    setReviewText(prev => prev ? `${prev} ${transcript}` : transcript);
                                  } else {
                                    toast.error("Je n'ai rien entendu, réessaie.");
                                  }
                                } catch {
                                  toast.error("Erreur de reconnaissance vocale");
                                } finally {
                                  setReviewVoiceProcessing(false);
                                }
                              };
                              reviewRecorderRef.current = recorder;
                              recorder.start();
                              setReviewVoiceListening(true);
                            } catch {
                              toast.error("Impossible d'accéder au micro");
                            }
                          }}
                          className={`flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                            reviewVoiceListening
                              ? "bg-destructive/20 border-destructive/40 text-destructive animate-pulse"
                              : reviewVoiceProcessing
                                ? "bg-primary/10 border-primary/20 text-primary/50"
                                : "bg-primary/20 border-primary/30 text-primary hover:bg-primary/30"
                          }`}
                        >
                          {reviewVoiceProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : reviewVoiceListening ? (
                            <MicOff className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </button>
                        <span className="text-[11px] text-foreground/30 font-sans">ou dicte ton avis</span>
                        <div className="flex-1" />
                        <button
                          type="submit"
                          disabled={!reviewText.trim() || reviewSubmitting}
                          className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-primary text-primary-foreground text-sm font-sans font-medium disabled:opacity-50 transition-all active:scale-95"
                        >
                          {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Envoyer
                        </button>
                      </div>
                    </form>
                  </>
                )}
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
