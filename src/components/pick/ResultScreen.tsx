import { useState, useEffect, forwardRef, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Send, Loader2, Sparkles, Check, Play, Star, Clock, Heart, Bookmark, Tv, ChevronDown, ChevronUp, MoreHorizontal, RefreshCw, ThumbsUp, ThumbsDown, MessageCircle, Volume2, Eye } from "lucide-react";
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
  refining?: boolean;
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

const ResultScreen = forwardRef<HTMLDivElement, ResultScreenProps>(({ movie, onShowAnother, onRestart, onRefineWithVoice, onRefineWithMessage, onStartCompanion, hasMore, userCriteria, alternativeMovies, onSelectAlternative, searchTags, onRemoveTag, refining }, ref) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
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
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

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
      const audio = new Audio(url);
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
    setMarkedSeen(false);
    setFeedbackGiven(null);

    // Pre-generate embedding for this movie (fire & forget)
    ensureMovieEmbedding(
      movie.id,
      movie.title || movie.name || "",
      movie.overview || "",
      (movie.genres || []).map(g => g.name)
    );

    // Load taste profile + user taste vector + liked movies + cinematic profile and pass to match function
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

            {/* Genres + Match badge inline */}
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              {genres && (
                <p className="text-primary/60 text-[10px] md:text-xs tracking-[0.12em] uppercase font-sans font-medium">
                  {genres}
                </p>
              )}
              {matchData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25"
                >
                  <Sparkles className="w-2.5 h-2.5 text-primary" />
                  <span className="text-primary text-[10px] font-sans font-semibold">
                    Match {matchData.matchScore}%
                  </span>
                </motion.div>
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
                  {/* Purple card — Pourquoi ce film + Pick + Écouter */}
                  <div className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/30 backdrop-blur-sm">
                    {/* Top row: Pick mascot + text + listen button */}
                    <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
                      <div className="flex-shrink-0">
                        <PickCharacter mood="default" size="sm" animate={false} />
                      </div>
                      <p className="flex-1 min-w-0 text-foreground/60 text-[11px] sm:text-[12px] font-sans leading-relaxed">
                        Je peux te présenter ce film si tu veux
                      </p>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        onClick={(e) => { e.stopPropagation(); handleReadWhy(); }}
                        disabled={whyAudioLoading || whySpeaking}
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border transition-all active:scale-95 text-[11px] sm:text-[12px] font-sans font-medium shadow-sm ${
                          whySpeaking
                            ? "bg-primary/25 border-primary/50 text-primary"
                            : "bg-primary/20 backdrop-blur-sm border-primary/35 text-foreground/80 hover:text-primary hover:bg-primary/30"
                        }`}
                        title="Écouter Pick"
                      >
                        {whyAudioLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className={`w-3.5 h-3.5 ${whySpeaking ? "text-primary animate-pulse" : ""}`} />
                        )}
                        <span className="hidden xs:inline">{whySpeaking ? "Pick parle…" : "Écouter"}</span>
                      </motion.button>
                    </div>

                    {/* Separator */}
                    <div className="border-t border-primary/15 mb-3" />

                    {/* Pourquoi ce film — expandable */}
                    <button
                      onClick={() => setWhyExpanded(prev => !prev)}
                      className="w-full text-left group p-2 -m-2 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <p className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold mb-1.5 flex items-center gap-1.5">
                        Pourquoi ce film ?
                        <motion.span
                          animate={{ rotate: whyExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-3 h-3 text-primary/40" />
                        </motion.span>
                        {!whyExpanded && (
                          <span className="text-[9px] normal-case tracking-normal text-primary/40 font-normal ml-auto">Tap pour voir</span>
                        )}
                      </p>
                      <p className="text-foreground/70 text-[12px] sm:text-[13px] font-sans leading-relaxed">
                        {matchData.headline}
                      </p>
                    </button>

                    {/* Expanded detailed explanation */}
                    <AnimatePresence>
                      {whyExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 space-y-3">
                            {matchData.detailedExplanation && (
                              <p className="text-foreground/55 text-[12px] font-sans leading-relaxed">
                                {matchData.detailedExplanation}
                              </p>
                            )}
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
                            {matchData.matchingReasons && matchData.matchingReasons.length > 0 && (
                              <div>
                                <p className="text-[10px] text-primary/50 font-sans font-medium mb-1.5">Ce qui correspond</p>
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
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fun fact — standalone subtle block */}
            <AnimatePresence>
              {matchData && matchData.funFact && !matchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="mb-4 max-w-md flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-foreground/[0.04] border border-border/15"
                >
                  <span className="text-base mt-0.5 flex-shrink-0">🎬</span>
                  <div>
                    <p className="text-[10px] text-primary/60 font-sans font-semibold tracking-wide uppercase mb-0.5">Fun fact</p>
                    <p className="text-foreground/55 text-[12px] font-sans leading-relaxed">
                      {matchData.funFact}
                    </p>
                  </div>
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
                    Regarder avec Pick
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
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  onClick={() => {
                    if (feedbackGiven === "good") return;
                    setFeedbackGiven("good");
                    trackInteraction(movie.id, "liked", { mood: userCriteria?.mood, context: userCriteria?.context, time: userCriteria?.time, feedback: "good_reco" });
                    if (!liked && user) { likeMovie(movie).then(() => setLiked(true)).catch(() => {}); }
                    toast.success("Merci pour ton retour !");
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 h-8 sm:h-9 rounded-full border text-[11px] sm:text-xs font-sans font-medium transition-all active:scale-95 ${
                    feedbackGiven === "good"
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <ThumbsUp className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${feedbackGiven === "good" ? "fill-primary" : ""}`} />
                  Bonne reco
                </button>

                <button
                  onClick={() => {
                    setShowRejectReasons(true);
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 h-8 sm:h-9 rounded-full border text-[11px] sm:text-xs font-sans font-medium transition-all active:scale-95 ${
                    feedbackGiven === "bad"
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "border-border/25 text-foreground/40 hover:text-foreground/60 hover:border-border/40"
                  }`}
                >
                  <ThumbsDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${feedbackGiven === "bad" ? "fill-destructive" : ""}`} />
                  Autre suggestion
                </button>

                <button
                  onClick={() => {
                    if (markedSeen) return;
                    setMarkedSeen(true);
                    trackInteraction(movie.id, "already_seen", { mood: userCriteria?.mood, context: userCriteria?.context, time: userCriteria?.time });
                    toast.success("Noté ! Pick évitera ce film.");
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 h-8 sm:h-9 rounded-full border text-[11px] sm:text-xs font-sans font-medium transition-all active:scale-95 ${
                    markedSeen
                      ? "bg-muted border-border/40 text-foreground/60"
                      : "border-border/25 text-foreground/40 hover:text-foreground/60 hover:border-border/40"
                  }`}
                >
                  <Eye className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${markedSeen ? "text-foreground/60" : ""}`} />
                  Déjà vu
                </button>

                <button
                  onClick={handleToggleBookmark}
                  disabled={bookmarkLoading}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 h-8 sm:h-9 rounded-full border text-[11px] sm:text-xs font-sans font-medium transition-all active:scale-95 ${
                    bookmarked
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
                  }`}
                >
                  <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${bookmarked ? "fill-primary" : ""}`} />
                  <span className="hidden sm:inline">Sauvegarder</span>
                  <span className="sm:hidden">Sauver</span>
                </button>
              </div>

              {/* Pick understood your mood — search context tags */}
              {searchTags && searchTags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  className="pt-0.5"
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

              {/* Conversational follow-up with Pick */}
              {matchData && !refining && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.4 }}
                  className="pt-3"
                >
                  <PickCharacter mood="default" message="Alors, ça te tente ? Sinon dis-moi ce que tu veux." size="sm" animate={false} />

                  {/* Free-text + voice input to chat with Pick */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("refineInput") as HTMLInputElement;
                      const msg = input?.value?.trim();
                      if (msg) {
                        onRefineWithMessage?.(msg);
                        input.value = "";
                      }
                    }}
                    className="mt-3 ml-1 flex items-center gap-2 max-w-md"
                  >
                    <input
                      name="refineInput"
                      type="text"
                      placeholder="Dis à Pick ce que tu veux…"
                      className="flex-1 px-4 py-2.5 rounded-full bg-foreground/[0.05] border border-border/30 text-foreground text-[13px] font-sans placeholder:text-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-foreground/[0.08] transition-all"
                    />
                    {/* Voice input button */}
                    <button
                      type="button"
                      disabled={voiceProcessing}
                      onClick={async () => {
                        if (voiceListening) {
                          // Stop recording
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
                              // Send to edge function for server-side STT
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
                              } else {
                                toast.error("Je n'ai rien entendu, réessaie.");
                              }
                            } catch (e) {
                              console.error("Voice refine error:", e);
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

                  <div className="flex flex-wrap gap-1.5 mt-2.5 ml-1">
                    {[
                      { label: "Plus intense", message: "Je veux quelque chose de plus intense" },
                      { label: "Plus émouvant", message: "Je veux quelque chose de plus émouvant et touchant" },
                      { label: "Plus court", message: "Je préfère un film plus court" },
                      { label: "Plus drôle", message: "Je veux un truc plus drôle et léger" },
                    ].map((chip, i) => (
                      <motion.button
                        key={chip.label}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.4 + i * 0.06 }}
                        onClick={() => onRefineWithMessage?.(chip.message)}
                        className="px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/25 text-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/5 text-[11px] font-sans transition-all active:scale-95"
                      >
                        {chip.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Refining loading state with Pick */}
              {refining && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-3"
                >
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
                        // Show Pick's reaction briefly, then trigger next movie
                        setTimeout(() => {
                          setRejectReaction(null);
                          onShowAnother();
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
    </div>
  );
});


ResultScreen.displayName = "ResultScreen";

export default ResultScreen;
