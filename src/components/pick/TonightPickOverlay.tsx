import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Dices, Loader2, Info } from "lucide-react";
import { getBackdropUrl, getDisplayTitle, getPosterUrl, type MovieDetail } from "@/lib/tmdb";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";

// Cache module-level : chargé une fois dès l'import du fichier (avant le 1er clic utilisateur)
const lambdaCache = { paths: [] as string[] };
const _fetchLambda = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.results || []).map((m: { poster_path?: string }) => m.poster_path).filter(Boolean) as string[])
    .catch(() => [] as string[]);

// Lancé immédiatement — popular + top_rated mélangés pour un mur riche dès la 1ère session
Promise.all([
  _fetchLambda("https://api.themoviedb.org/3/movie/popular?api_key=2dca580c2a14b55200e784d157207b4d&language=fr-FR&page=1"),
  _fetchLambda("https://api.themoviedb.org/3/movie/top_rated?api_key=2dca580c2a14b55200e784d157207b4d&language=fr-FR&page=1"),
]).then(([popular, topRated]) => {
  // Interleave pour mélanger films actuels et classiques
  const merged: string[] = [];
  const max = Math.max(popular.length, topRated.length);
  for (let i = 0; i < max; i++) {
    if (popular[i]) merged.push(popular[i]);
    if (topRated[i]) merged.push(topRated[i]);
  }
  lambdaCache.paths = merged;
});

interface TonightPickOverlayProps {
  open: boolean;
  movie: MovieDetail | null;
  tonightPool: MovieDetail[];
  tonightPickIndex: number;
  tonightSeenMovieIds: Set<number>;
  tonightProviders: { name: string; logo_path: string }[];
  movieMatchData: Record<number, { confidence: number; reason: string }>;
  canGoPrev: boolean;
  canGoNext: boolean;
  tonightAllVisited: boolean;
  tonightLoading: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenDetail: () => void;
  onConfirm: () => void;
  onInteraction: (type: string) => void;
  onMoreSuggestions: () => void;
  expectedCount?: number;
  userName?: string;
  loadingLog?: string[];
  userGenres?: string[];
}

const TonightPickOverlay = ({
  open,
  movie,
  tonightPool,
  tonightPickIndex,
  tonightSeenMovieIds,
  tonightProviders,
  movieMatchData,
  canGoPrev,
  canGoNext,
  tonightAllVisited,
  tonightLoading,
  onClose,
  onPrev,
  onNext,
  onOpenDetail,
  onConfirm,
  onInteraction,
  onMoreSuggestions,
  expectedCount,
  userName,
  loadingLog,
  userGenres = [],
}: TonightPickOverlayProps) => {
  const interaction = useMovieInteraction(movie?.id);
  const displayCount = expectedCount ?? tonightPool.length;
  // Délai minimum avant révélation : le fond se révèle d'abord (~1.7s), puis la vignette peut se dévoiler
  const [localReady, setLocalReady] = useState(false);
  useEffect(() => {
    setLocalReady(false);
    if (!movie?.id) return;
    const t = setTimeout(() => setLocalReady(true), 2200);
    return () => clearTimeout(t);
  }, [movie?.id]);

  // Calculs null-safe — movie peut être null pendant la phase de chargement (stage 1)
  const matchInfo = movie ? movieMatchData[movie.id] : undefined;
  const recFromPool = movie
    ? (tonightPool || []).find((m) => m?.id === movie.id && (m as any).recommendationTexts)
    : null;
  const recFromMovie: any = movie ? (movie as any).recommendationTexts || null : null;
  const rec: any =
    (recFromPool ? (recFromPool as any).recommendationTexts : null) || recFromMovie || null;
  const rawAdhesionScore = rec?.matchScore ?? rec?.score ?? rec?.confidence ?? matchInfo?.confidence ?? null;
  // Floor : ne pas afficher un score inférieur à l'estimation initiale de SP (matchInfo.confidence)
  // Évite les cas où movie-match renvoie un score très bas pour un film recommandé (ex: 7%)
  const adhesionScore =
    rawAdhesionScore != null && matchInfo?.confidence != null
      ? Math.max(rawAdhesionScore, matchInfo.confidence)
      : rawAdhesionScore;
  const asStr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  const recReason = asStr(rec?.reason);
  const matchReason = asStr(matchInfo?.reason);
  const rawReason = movie
    ? ((recReason && recReason.length > 40 ? recReason : null) ||
       (matchReason && matchReason.length > 40 ? matchReason : null) ||
       `Pick pense que ${movie.first_air_date ? "cette série est faite" : "ce film est fait"} pour toi.`)
    : "";
  const stripped = rawReason.replace(/^[^\s,]+,\s*/, "");
  const shortReason = stripped.length > 10
    ? stripped.charAt(0).toUpperCase() + stripped.slice(1)
    : rawReason;
  const teaser = shortReason;
  const isTextsReady = !!(rec?.whyItMatches);
  // canReveal = les textes sont prêts ET au moins 2.2s se sont écoulées depuis l'apparition du film
  const canReveal = isTextsReady && localReady;

  // Temps écoulé pendant le chargement — pour l'effet crescendo sur le mur d'affiches
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (!tonightLoading) { setLoadingElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setLoadingElapsed((Date.now() - start) / 1000), 150);
    return () => clearInterval(id);
  }, [tonightLoading]);

  // Lambda TMDB : liste fixe popular+top_rated, toujours affichée (cohérence visuelle entre sessions)
  const [lambdaPaths, setLambdaPaths] = useState<string[]>(lambdaCache.paths);
  useEffect(() => {
    if (lambdaCache.paths.length > 0) { setLambdaPaths(lambdaCache.paths); return; }
    const poll = setInterval(() => {
      if (lambdaCache.paths.length > 0) { setLambdaPaths(lambdaCache.paths); clearInterval(poll); }
    }, 300);
    return () => clearInterval(poll);
  }, []);

  // Films adorés : persistés en localStorage au fil des interactions positives
  const LOVED_KEY = "pick_loved_posters";
  const [lovedPosters, setLovedPosters] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOVED_KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => {
    const path = movie?.poster_path;
    if (!path) return;
    const positive = ["like", "love", "watchlist"];
    if (!positive.includes(interaction.primaryStatus ?? "")) return;
    setLovedPosters((prev) => {
      if (prev.includes(path)) return prev;
      const updated = [path, ...prev].slice(0, 50);
      try { localStorage.setItem(LOVED_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [movie?.poster_path, interaction.primaryStatus]);

  // Mur de fond : lambda fixe + films adorés intercalés (1 perso toutes les 4 lambdas)
  const posterWallPaths = (() => {
    const base = lambdaPaths.length >= 2 ? lambdaPaths : [];
    if (base.length === 0) return [];
    if (lovedPosters.length === 0) return base;
    const result: string[] = [];
    let li = 0;
    for (let i = 0; i < base.length; i++) {
      result.push(base[i]);
      if ((i + 1) % 4 === 0 && li < lovedPosters.length) result.push(lovedPosters[li++]);
    }
    return result;
  })();

  // Mélange aléatoire stable (recalculé uniquement si le pool change)
  const shuffledWallPaths = useMemo(() => {
    if (posterWallPaths.length === 0) return [];
    const arr = [...posterWallPaths];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [posterWallPaths.length]);

  // Effet "scan" : un poster aléatoire s'illumine brièvement, comme s'il était identifié
  // Ref toujours à jour sur shuffledWallPaths — évite la closure stale dans setInterval
  const wallPathsRef = useRef<string[]>([]);
  wallPathsRef.current = shuffledWallPaths;
  const lastHighlightRef = useRef<string | null>(null);
  // Filtre aléatoire généré à chaque flash — contraste/netteté/opacité variables
  const spotFilterRef = useRef<string>("");

  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  useEffect(() => {
    if (!tonightLoading) { setHighlightedPath(null); return; }
    let clearFlash: ReturnType<typeof setTimeout>;
    const flash = () => {
      const paths = wallPathsRef.current;
      if (paths.length === 0) return;
      let path: string;
      let tries = 0;
      do {
        path = paths[Math.floor(Math.random() * paths.length)];
        tries++;
      } while (path === lastHighlightRef.current && paths.length > 1 && tries < 8);
      lastHighlightRef.current = path;
      // Valeurs aléatoires à chaque flash : luminosité modérée, contraste et netteté forts
      const bright   = (1.15 + Math.random() * 0.35).toFixed(2); // 1.15–1.50
      const contrast = (1.90 + Math.random() * 0.60).toFixed(2); // 1.90–2.50
      const sat      = (2.80 + Math.random() * 1.20).toFixed(2); // 2.80–4.00
      const glow     = Math.round(10 + Math.random() * 10);       // 10–20px
      const glowAlpha = (0.7 + Math.random() * 0.3).toFixed(2);  // 0.70–1.00
      spotFilterRef.current = `grayscale(0%) blur(0px) brightness(${bright}) contrast(${contrast}) saturate(${sat}) drop-shadow(0 0 ${glow}px rgba(255,255,255,${glowAlpha})) drop-shadow(0 0 4px rgba(167,139,250,0.9))`;
      setHighlightedPath(path);
      clearFlash = setTimeout(() => setHighlightedPath(null), 420);
    };
    flash();
    const interval = setInterval(flash, 800);
    return () => { clearInterval(interval); clearTimeout(clearFlash); };
  }, [tonightLoading]);

  // Genres flottants : apparaissent un par un pendant le chargement
  const [shownGenreCount, setShownGenreCount] = useState(0);
  useEffect(() => {
    if (!tonightLoading || userGenres.length === 0) { setShownGenreCount(0); return; }
    const id = setInterval(() => setShownGenreCount((n) => Math.min(n + 1, userGenres.length)), 650);
    return () => clearInterval(id);
  }, [tonightLoading, userGenres.length]);

  // Layout fixe par genre (position, taille, style) — calculé une fois quand la liste change
  const genreLayouts = useMemo(() => {
    const r = () => Math.random();
    // top aléatoire en évitant la zone centrale (40–62%) où se trouve l'animation
    const randTop = () => {
      const t = r() * 80 + 6; // 6–86%
      return t > 38 && t < 62 ? t < 50 ? t - 16 : t + 16 : t;
    };
    // Taille parmi des valeurs variées
    const randSize = () => [11, 13, 16, 20, 24, 28, 32][Math.floor(r() * 7)];
    // Ancre aléatoire : left ou right, avec marge sécurisée selon la taille
    const randSide = (size: number) => {
      const side = r() < 0.5 ? "left" : "right";
      // offset max plus petit pour les grands textes (évite débordement)
      const maxOff = size > 22 ? 30 : size > 16 ? 40 : 50;
      return { side: side as "left" | "right", offset: Math.round(r() * maxOff + 4) };
    };
    return userGenres.map(() => {
      const size = randSize();
      const { side, offset } = randSide(size);
      return {
        top: randTop(),
        side,
        offset,
        size,
        weight: [200, 300, 400, 500, 600, 700][Math.floor(r() * 6)],
        italic: r() < 0.35,
        opacity: 0.25 + r() * 0.45,
      };
    });
  }, [userGenres.join(",")]);

  // Offsets initiaux aléatoires par colonne (stable, calculé une fois)
  const colInitialOffsets = useMemo(
    () => [0, 1, 2, 3].map(() => `${-(Math.random() * 50).toFixed(1)}%`),
    [],
  );

  const year = movie
    ? ((movie.release_date || (movie as any).first_air_date) as string | undefined)?.substring(0, 4)
    : undefined;
  const primaryGenre = movie?.genres?.[0]?.name;

  // Crystal ball match indicator
  const crystalStyle = (() => {
    const s = adhesionScore ?? 0;
    const scale = 0.55 + (s / 100) * 1.05; // 0.55 → 1.6

    if (s >= 90) return {
      filter: "drop-shadow(0 0 14px rgba(139,92,246,1)) drop-shadow(0 0 5px rgba(192,132,252,0.9)) saturate(1.5) brightness(1.25)",
      opacity: 1, scale, textColor: "text-white", rings: 3,
    };
    if (s >= 80) return {
      filter: "drop-shadow(0 0 9px rgba(139,92,246,0.8)) drop-shadow(0 0 3px rgba(167,139,250,0.7)) saturate(1.25) brightness(1.12)",
      opacity: 0.97, scale, textColor: "text-white", rings: 2,
    };
    if (s >= 70) return {
      filter: "drop-shadow(0 0 5px rgba(139,92,246,0.45)) saturate(1.1) brightness(1.0)",
      opacity: 0.85, scale, textColor: "text-white", rings: 0,
    };
    if (s >= 55) return {
      filter: "grayscale(45%) brightness(0.8) saturate(0.7)",
      opacity: 0.55, scale, textColor: "text-white/80", rings: 0,
    };
    const pct = Math.max(0, s) / 55;
    return {
      filter: `grayscale(${Math.round(88 - pct * 35)}%) brightness(${0.38 + pct * 0.42})`,
      opacity: 0.15 + pct * 0.3, scale, textColor: "text-white/50", rings: 0,
    };
  })();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          {/* Stage 1 : lumières violettes pulsantes pendant que surprise-personalized tourne */}
          <AnimatePresence>
            {!movie && (
              <motion.div
                key="stage1-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 z-20 overflow-hidden"
              >
                {/* Mur d'affiches : 4 colonnes défilantes à vitesses décalées */}
                {shuffledWallPaths.length >= 2 && (() => {
                  // Filtre progressif : sombre+gris au départ → lumineux+coloré au fil du temps
                  const p = Math.min(loadingElapsed / 8, 1); // 0→1 sur 8 secondes
                  const wallOpacity   = 0.28 + p * 0.42;
                  const wallGrayscale = Math.round(55 - p * 50);
                  const wallBlur      = (1.5 - p * 1.5).toFixed(1);
                  const wallBright    = (0.65 + p * 0.55).toFixed(2);
                  const wallContrast  = (0.80 + p * 0.40).toFixed(2);
                  // Filtre normal appliqué sur chaque image (pas sur le conteneur)
                  const normalFilter  = `grayscale(${wallGrayscale}%) blur(${wallBlur}px) brightness(${wallBright}) contrast(${wallContrast})`;
                  // Filtre "identifié" : pleine couleur + lumineux + halo violet
                  const spotFilter    = spotFilterRef.current;
                  return (
                    <div
                      className="absolute inset-0 flex gap-1 overflow-hidden"
                      style={{ opacity: wallOpacity, transition: "opacity 0.4s" }}
                    >
                      {[0, 1, 2, 3].map((ci) => {
                        const perCol = Math.max(8, Math.ceil(shuffledWallPaths.length / 4));
                        const items = Array.from({ length: perCol }, (_, i) =>
                          shuffledWallPaths[(ci + i * 4) % shuffledWallPaths.length]
                        );
                        const col = [...items, ...items];
                        const dur = [7, 5, 8.5, 6][ci];
                        const goDown = ci % 2 === 1;
                        const phaseDelay = -(dur * ci * 0.25);
                        return (
                          <motion.div
                            key={ci}
                            className="flex-1 flex flex-col gap-1"
                            style={{ willChange: "transform" }}
                            initial={{ y: goDown ? "-50%" : "0%" }}
                            animate={{ y: goDown ? "0%" : "-50%" }}
                            transition={{ duration: dur, repeat: Infinity, repeatType: "loop", ease: "linear", delay: phaseDelay }}
                          >
                            {col.map((path, pi) => {
                              const isSpot = path === highlightedPath;
                              return (
                                <img
                                  key={pi}
                                  src={getPosterUrl(path, "w185") || ""}
                                  alt=""
                                  draggable={false}
                                  className="w-full rounded-md object-cover flex-shrink-0 select-none"
                                  style={{
                                    aspectRatio: "2/3",
                                    filter: isSpot ? spotFilter : normalFilter,
                                    transform: isSpot ? "scale(1.06)" : "scale(1)",
                                    transition: "filter 0.12s ease-out, transform 0.12s ease-out",
                                    position: "relative",
                                    zIndex: isSpot ? 2 : 0,
                                  }}
                                />
                              );
                            })}
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Voile sombre par-dessus les posters (ou fond opaque si pas de posters) */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: posterWallPaths.length >= 2
                      ? "rgba(0,0,0,0.62)"
                      : "hsl(var(--background))",
                  }}
                />

                {/* Lumière principale — monte en puissance depuis le bas */}
                <motion.div
                  className="absolute"
                  style={{
                    width: "160%", height: "65%",
                    bottom: "-15%", left: "-30%",
                    background: "radial-gradient(ellipse at 50% 80%, rgba(139,92,246,0.55) 0%, rgba(109,40,217,0.18) 45%, transparent 70%)",
                  }}
                  animate={{ opacity: [0.3, 1, 0.55, 1, 0.3], scale: [0.88, 1.06, 0.96, 1.1, 0.88] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Halo secondaire — légèrement décalé à gauche, rythme différent */}
                <motion.div
                  className="absolute"
                  style={{
                    width: "100%", height: "55%",
                    bottom: "0%", left: "-20%",
                    background: "radial-gradient(ellipse at 40% 90%, rgba(168,85,247,0.35) 0%, transparent 65%)",
                  }}
                  animate={{ opacity: [0.1, 0.7, 0.25, 0.65, 0.1], y: [0, -18, 6, -12, 0] }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                />
                {/* Accent chaud — côté droit, très léger */}
                <motion.div
                  className="absolute"
                  style={{
                    width: "80%", height: "45%",
                    bottom: "5%", right: "-20%",
                    background: "radial-gradient(ellipse at 60% 85%, rgba(192,132,252,0.28) 0%, transparent 65%)",
                  }}
                  animate={{ opacity: [0.05, 0.55, 0.15, 0.5, 0.05], scale: [1, 1.15, 0.92, 1.08, 1] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
                />
                {/* Genres de l'utilisateur — flottants, tailles et styles variés */}
                <AnimatePresence>
                  {userGenres.slice(0, shownGenreCount).map((genre, i) => {
                    const lay = genreLayouts[i];
                    if (!lay) return null;
                    return (
                      <motion.span
                        key={genre}
                        initial={{ opacity: 0, scale: 0.75, y: 6 }}
                        animate={{ opacity: lay.opacity, scale: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                        className="absolute select-none pointer-events-none text-white"
                        style={{
                          top: `${lay.top}%`,
                          [lay.side]: `${lay.offset}%`,
                          fontSize: lay.size,
                          fontWeight: lay.weight,
                          fontStyle: lay.italic ? "italic" : "normal",
                          letterSpacing: lay.size > 20 ? "0.06em" : "0.02em",
                          textShadow: "0 2px 12px rgba(0,0,0,0.9)",
                          whiteSpace: "nowrap",
                          zIndex: 10,
                        }}
                      >
                        {genre}
                      </motion.span>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 2-3 : backdrop flou → net (1-2s de flou avant révélation) */}
          {movie && (
            <motion.div
              key={`backdrop-${movie.id}`}
              initial={{ scale: 1.08, opacity: 0, filter: "blur(18px)" }}
              animate={{ scale: 1.02, opacity: 1, filter: "blur(0px)" }}
              transition={{
                opacity: { duration: 0.9, ease: "easeOut" },
                scale: { duration: 2.5, ease: [0.22, 1, 0.36, 1] },
                filter: { duration: 0.9, delay: 0.8, ease: "easeOut" },
              }}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${getBackdropUrl(movie.backdrop_path) || getPosterUrl(movie.poster_path, "w780")})`,
              }}
            />
          )}
          {/* Cinematic gradient — bottom-heavy for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent h-32" />

          {/* Top bar: back + match ring */}
          <div className="relative z-10 flex justify-between items-center px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              onClick={onClose}
              aria-label="Retour"
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {movie && adhesionScore != null && (
              <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>

                {/* Expanding violet glow rings at ≥80% */}
                {crystalStyle.rings >= 1 && (
                  <motion.div
                    animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)" }}
                  />
                )}
                {crystalStyle.rings >= 2 && (
                  <motion.div
                    animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                    transition={{ duration: 1.9, repeat: Infinity, delay: 0.65, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(167,139,250,0.55) 0%, transparent 70%)" }}
                  />
                )}
                {crystalStyle.rings >= 3 && (
                  <motion.div
                    animate={{ scale: [1, 3.0], opacity: [0.4, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: 1.2, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(192,132,252,0.4) 0%, transparent 70%)" }}
                  />
                )}

                {/* Crystal ball */}
                <motion.span
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: crystalStyle.opacity, scale: crystalStyle.scale }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute text-[46px] select-none leading-none"
                  style={{ filter: crystalStyle.filter }}
                >
                  🔮
                </motion.span>

                {/* Score text */}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className={`relative z-10 text-[13px] font-black font-sans select-none tracking-tight ${crystalStyle.textColor}`}
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.75)" }}
                  aria-label={`Adhésion ${adhesionScore}%`}
                >
                  {adhesionScore}%
                </motion.span>
              </div>
            )}
          </div>

          {/* Stage 2-3 : wrapper apparition — flou + scale pendant que movie-match tourne */}
          {movie && <motion.div
            key={`overlay-${movie.id}`}
            initial={{ filter: "blur(8px)", scale: 0.97, opacity: 0.6 }}
            animate={{
              filter: canReveal ? "blur(0px)" : "blur(8px)",
              scale: canReveal ? 1 : 0.97,
              opacity: canReveal ? 1 : 0.6,
            }}
            transition={{
              filter: { duration: 1.1, ease: "easeOut" },
              scale: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.9, ease: "easeOut" },
            }}
            className="flex-1 flex flex-col min-h-0"
          >

          {/* Poster + flèches de navigation de chaque côté */}
          <div className="relative z-10 flex items-center justify-center gap-4 mt-4">
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              aria-label="Proposition précédente"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground transition-all disabled:opacity-20 hover:bg-black/60"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {movie.poster_path && (
              <button
                onClick={onOpenDetail}
                className="relative group active:scale-[0.97] transition-transform"
                aria-label="Voir les détails"
              >
                <motion.img
                  key={`poster-${movie.id}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  src={getPosterUrl(movie.poster_path, "w500") || ""}
                  alt={getDisplayTitle(movie)}
                  className="w-40 h-60 rounded-2xl object-cover shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10"
                />
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info className="w-3.5 h-3.5 text-foreground/70" />
                </div>
                {interaction.hasInteraction && (
                  <div className="absolute top-2 left-2">
                    <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} size="sm" />
                  </div>
                )}
              </button>
            )}

            <button
              onClick={onNext}
              disabled={!canGoNext}
              aria-label="Proposition suivante"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-foreground transition-all disabled:opacity-20 hover:bg-black/60"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom-anchored info block */}
          <div className="relative z-10 mt-auto px-7 pb-[calc(5rem+env(safe-area-inset-bottom))] overflow-y-auto scrollbar-hide max-h-[65vh]">
            {/* Chips: year, genre, first streaming platform */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {year && (
                <span className="px-2.5 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold font-sans">
                  {year}
                </span>
              )}
              {primaryGenre && (
                <span className="px-2.5 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg text-[9px] text-foreground uppercase tracking-widest font-bold font-sans">
                  {primaryGenre}
                </span>
              )}
              {tonightProviders.filter(p => p.logo_path).slice(0, 4).map((p) => (
                <img
                  key={p.name}
                  src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                  alt={p.name}
                  title={p.name}
                  className="h-9 w-9 rounded-xl object-cover"
                />
              ))}
            </div>

            {/* Hero serif title */}
            <motion.h2
              key={`title-${movie.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="font-serif text-foreground text-[42px] leading-[0.95] tracking-tight mb-5 cursor-pointer"
              onClick={onOpenDetail}
            >
              {getDisplayTitle(movie)}
            </motion.h2>

            {/* Vertical accent bar + italic teaser from Pick */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.32 }}
              className="flex items-start gap-3 mb-7 cursor-pointer"
              onClick={onOpenDetail}
            >
              <div className="w-1 self-stretch min-h-[40px] bg-primary rounded-full shrink-0" />
              <p className="text-foreground/80 text-[14px] italic font-sans leading-relaxed pt-0.5">
                {teaser.length > 300 ? `${teaser.substring(0, 300).trimEnd()}…` : teaser}
              </p>
            </motion.div>

            {/* Glass action bar (Save / Like / Seen via MovieActionBar) */}
            <div className="mb-5 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/[0.06] p-1.5">
              <MovieActionBar key={movie.id} movie={movie} onInteraction={onInteraction} />
            </div>

            {/* Primary CTA: white pill — premium contrast */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              className="w-full py-[18px] bg-foreground text-background rounded-[28px] font-sans font-bold text-[13px] tracking-[0.18em] uppercase mb-5 shadow-[0_18px_50px_-12px_rgba(255,255,255,0.25)]"
            >
              On regarde ?
            </motion.button>

            {/* Progress segments — uniquement si plusieurs propositions */}
            {tonightPool.length > 1 && (
              <div className="flex flex-col items-center gap-2.5 mb-1">
                <div className="flex gap-1.5">
                  {tonightPool.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (i < tonightPickIndex) onPrev();
                        else if (i > tonightPickIndex) onNext();
                      }}
                      disabled={(i < tonightPickIndex && !canGoPrev) || (i > tonightPickIndex && !canGoNext)}
                      aria-label={`Suggestion ${i + 1}`}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        i === tonightPickIndex ? "w-10 bg-foreground" : "w-2 bg-foreground/20 hover:bg-foreground/40"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-foreground/30 text-[9px] font-sans tracking-[0.3em] uppercase">
                  Suggestion {tonightPickIndex + 1} / {tonightPool.length}
                </span>
              </div>
            )}

            {/* Bouton "nouvelles suggestions" :
                - proposition unique → actif immédiatement (on l'a forcément vue)
                - plusieurs propositions → actif seulement quand toutes visitées */}
            {(tonightPool.length <= 1 || tonightAllVisited || tonightLoading) && (
              <button
                onClick={onMoreSuggestions}
                disabled={tonightLoading}
                className="mt-1 text-xs font-sans transition-all flex items-center gap-1.5 text-foreground/55 hover:text-foreground/80 disabled:opacity-50"
              >
                {tonightLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Dices className="w-3.5 h-3.5" />
                )}
                {displayCount} autre{displayCount > 1 ? "s" : ""} suggestion{displayCount > 1 ? "s" : ""}
              </button>
            )}
            <div className="h-8" />
          </div>

          </motion.div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TonightPickOverlay;
