import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Camera, Search, X, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getBackdropUrl, getPosterUrl, getDisplayTitle, getWatchProviders } from "@/lib/tmdb";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import type { RecommendationMatchData } from "@/lib/recommendation-batch";
import HazelnutScore from "@/components/pick/HazelnutScore";
import matchBackground from "@/assets/match-background.webp";
import MovieActionBar from "@/components/pick/MovieActionBar";
import FlipCardDetail from "@/components/pick/FlipCardDetail";

type MatchState = "idle" | "listening" | "identifying" | "result" | "error";

export default function MatchPage() {
  const { user } = useAuth();
  const [state, setState] = useState<MatchState>("idle");
  const [query, setQuery] = useState("");
  const [movie, setMovie] = useState<any>(null);
  const [matchData, setMatchData] = useState<RecommendationMatchData | null>(null);
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Identification via edge function ──
  const identify = useCallback(async (opts: { query?: string; imageBase64?: string; imageMimeType?: string }) => {
    setState("identifying");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("identify-film", {
        body: { ...opts, excludeTmdbIds: excludedIds },
      });
      if (error) throw error;
      if (!data?.found) {
        setErrorMsg("Je n'ai pas réussi à identifier ce film. Reformule ou essaie autrement.");
        setState("error");
        return;
      }

      const filmDetail = data.movie;
      setMovie(filmDetail);
      setExcludedIds((prev) => [...prev, data.tmdbId]);

      // Charger les plateformes
      const mediaType = filmDetail.first_air_date ? "tv" : "movie";
      getWatchProviders(filmDetail.id, mediaType).then(setProviders).catch(() => {});

      // Évaluer l'adhésion avec movie-match
      if (user) {
        try {
          const [tasteProfile, liked, multiProfile] = await Promise.all([
            getUserTasteProfile(),
            getLikedMovies(),
            computeMultiVectorProfile(user.id),
          ]);
          const { data: mmData } = await supabase.functions.invoke("movie-match", {
            body: {
              movie: filmDetail,
              tasteProfile,
              userTasteVector: multiProfile?.stableTasteVector ?? null,
              likedMovieTitles: liked.slice(0, 15).map((m: any) => m.title).filter(Boolean),
              minMatchScore: 0,
            },
          });
          if (mmData) setMatchData(mmData as RecommendationMatchData);
        } catch {
          // adhesion non bloquante
        }
      }

      setState("result");
    } catch (e) {
      setErrorMsg("Une erreur est survenue. Réessaie.");
      setState("error");
    }
  }, [excludedIds, user]);

  // ── Recherche texte / description ──
  const handleTextSearch = () => {
    if (!query.trim()) return;
    identify({ query: query.trim() });
  };

  // ── Voix (Web Speech API) ──
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("La reconnaissance vocale n'est pas disponible sur ce navigateur.");
      setState("error");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
      identify({ query: transcript });
    };
    rec.onerror = () => {
      setState("idle");
    };
    rec.onend = () => {
      if (state === "listening") setState("idle");
    };
    recognitionRef.current = rec;
    rec.start();
    setState("listening");
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setState("idle");
  };

  // ── Photo / scan affiche ──
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      identify({ imageBase64: base64, imageMimeType: file.type });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Reset ──
  const reset = () => {
    setState("idle");
    setMovie(null);
    setMatchData(null);
    setProviders([]);
    setErrorMsg("");
    setQuery("");
    setExcludedIds([]);
  };

  const retryExcluding = () => {
    setState("idle");
    setMovie(null);
    setMatchData(null);
    setProviders([]);
  };

  const adhesionScore = matchData?.matchScore ?? matchData?.score ?? null;
  const year = (movie?.release_date || movie?.first_air_date || "").substring(0, 4);
  const primaryGenre = movie?.genres?.[0]?.name;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-x-0 top-0 h-[90%] bg-cover bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${matchBackground})`, backgroundPosition: "50% 10%", maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", opacity: 0.6 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background)/0.3) 60%, hsl(var(--background)/0.9) 85%, hsl(var(--background)) 100%)" }}
      />

      <AnimatePresence mode="wait">

        {/* ── État résultat ── */}
        {state === "result" && movie && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${getBackdropUrl(movie.backdrop_path) || getPosterUrl(movie.poster_path, "w780")})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/40" />

            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
              <button
                onClick={reset}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <HazelnutScore score={adhesionScore} size={56} />
            </div>

            {/* Poster */}
            <div className="relative z-10 flex justify-center mt-4">
              {movie.poster_path && (
                <button onClick={() => setDetailOpen(true)} className="active:scale-[0.96] transition-transform">
                  <img
                    src={getPosterUrl(movie.poster_path, "w500") || ""}
                    alt={getDisplayTitle(movie)}
                    className="w-36 h-52 rounded-2xl object-cover shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10"
                  />
                </button>
              )}
            </div>

            {/* Info scrollable */}
            <div className="relative z-10 mt-auto px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] overflow-y-auto scrollbar-hide max-h-[70dvh]">
              {/* Chips */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {year && (
                  <span className="px-2.5 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold">
                    {year}
                  </span>
                )}
                {primaryGenre && (
                  <span className="px-2.5 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold">
                    {primaryGenre}
                  </span>
                )}
                {providers.slice(0, 3).map((p) => p.logo_path && (
                  <span key={p.name} className="p-1.5 bg-primary/25 backdrop-blur-xl border border-primary/40 rounded-lg flex items-center">
                    <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.name} className="h-5 w-auto rounded object-contain" />
                  </span>
                ))}
              </div>

              {/* Titre */}
              <button onClick={() => setDetailOpen(true)} className="text-left w-full mb-4 active:opacity-70 transition-opacity">
                <h2 className="font-serif text-foreground text-[38px] leading-tight tracking-tight">
                  {getDisplayTitle(movie)}
                </h2>
              </button>

              {/* Headline movie-match */}
              {matchData?.headline && (
                <button onClick={() => setDetailOpen(true)} className="w-full text-left flex items-start gap-3 mb-5 active:opacity-70 transition-opacity">
                  <div className="w-1 self-stretch min-h-[36px] bg-primary rounded-full shrink-0" />
                  <p className="text-foreground/80 text-[14px] italic font-sans leading-relaxed">
                    {matchData.headline}
                  </p>
                </button>
              )}

              {/* Why it matches */}
              {matchData?.whyItMatches && (
                <button onClick={() => setDetailOpen(true)} className="w-full text-left mb-5 active:opacity-70 transition-opacity">
                  <p className="text-foreground/60 text-[13px] font-sans leading-relaxed">
                    {matchData.whyItMatches}
                  </p>
                </button>
              )}

              {/* Actions */}
              <div className="mb-5 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/[0.06] p-1.5">
                <MovieActionBar movie={movie} />
              </div>

              {/* Pas ce film */}
              <button
                onClick={retryExcluding}
                className="w-full py-4 rounded-2xl border border-white/10 bg-white/5 text-foreground/60 text-sm font-sans flex items-center justify-center gap-2 mb-2"
              >
                <RefreshCw className="w-4 h-4" />
                Pas ce film, réessaie
              </button>
              <div className="h-6" />
            </div>
          </motion.div>
        )}

        {/* ── États idle / identifying / error ── */}
        {(state === "idle" || state === "identifying" || state === "listening" || state === "error") && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex-1 flex flex-col justify-start px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]"
          >
            <h1 className="text-3xl font-serif text-foreground mb-2">Match</h1>
            <p className="text-foreground/50 text-sm font-sans mb-10">
              Nomme-le, décris-le, parle ou montre son affiche ou une image du film
            </p>

            {/* Zone de texte */}
            <div className="relative mb-4">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextSearch(); }}}
                placeholder="Ex: le film avec DiCaprio dans l'espace... ou simplement « Interstellar »"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-[15px] font-sans placeholder:text-foreground/45 focus:outline-none focus:border-primary/50 resize-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute top-3 right-3 text-foreground/45 hover:text-foreground/60"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Bouton recherche texte */}
            <button
              onClick={handleTextSearch}
              disabled={!query.trim() || state === "identifying"}
              className="w-full py-4 bg-primary rounded-2xl text-white font-bold text-[13px] tracking-widest uppercase mb-6 flex items-center justify-center gap-2"
            >
              {state === "identifying" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Identification en cours…</>
              ) : (
                <><Search className="w-4 h-4" /> Rechercher</>
              )}
            </button>

            {/* Séparateur */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-foreground/45 text-xs font-sans">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Voix + Photo */}
            <div className="flex gap-4">
              <button
                onClick={state === "listening" ? stopListening : startListening}
                className={`flex-1 py-5 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  state === "listening"
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-white/5 border-white/10 text-foreground/70 hover:bg-white/10"
                }`}
              >
                {state === "listening" ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                <span className="text-xs font-sans">
                  {state === "listening" ? "Arrêter" : "Parler"}
                </span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={state === "identifying"}
                className="flex-1 py-5 rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center gap-2 text-foreground/70 hover:bg-white/10 disabled:opacity-40 transition-all"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs font-sans">Scanner</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>

            {/* Message d'erreur */}
            {state === "error" && errorMsg && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-center text-foreground/60 text-sm font-sans"
              >
                {errorMsg}
              </motion.p>
            )}

            {/* Tip pour le scan photo */}
            {state === "idle" && (
              <p className="mt-8 text-center text-foreground/45 text-xs font-sans leading-relaxed">
                Photo d'une affiche, d'une pochette DVD ou d'un écran de télé
              </p>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {movie && (
        <FlipCardDetail
          item={movie}
          type="movie"
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          recommendationTexts={matchData ? {
            confidence: matchData.matchScore ?? (matchData as any).score ?? null,
            headline: matchData.headline ?? null,
            whyItMatches: matchData.whyItMatches ?? null,
            detailedExplanation: matchData.detailedExplanation ?? null,
            emotionalJourney: matchData.emotionalJourney ?? null,
            perfectFor: matchData.perfectFor ?? null,
            funFact: matchData.funFact ?? null,
            matchingReasons: matchData.matchingReasons ?? null,
            pickNote: matchData.pickNote ?? null,
          } : null}
        />
      )}
    </div>
  );
}
