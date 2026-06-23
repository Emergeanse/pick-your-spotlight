import { useState, useEffect, useRef, useMemo, type MutableRefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Dices, Loader2, Info } from "lucide-react";
import { getBackdropUrl, getDisplayTitle, getPosterUrl, getMovieDetailsWithCredits, normalizePosterPath, type MovieDetail } from "@/lib/tmdb";
import {
  FALLBACK_POSTER_PATHS,
  buildWallColumns,
  extractPosterPaths,
  mergePosterPools,
  pickUnusedPosterPath,
} from "@/lib/tonight-poster-wall";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";

import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";

/** Défilement GPU (translate3d) — plus fluide que Framer Motion % sur des dizaines d'images */
const WALL_SCROLL_KEYFRAMES = `
@keyframes pick-wall-scroll-up {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(0, -50%, 0); }
}
@keyframes pick-wall-scroll-down {
  from { transform: translate3d(0, -50%, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
.pick-wall-col {
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.pick-wall-col-up   { animation-name: pick-wall-scroll-up; }
.pick-wall-col-down { animation-name: pick-wall-scroll-down; }
`;

const WALL_COLUMN_SECONDS = [28, 22, 32, 25] as const;
const WALL_POSTER_SIZE = "w185" as const;

// Cache module-level : chargé après authentification (proxy TMDB requiert une session)
const lambdaCache = { paths: [] as string[], loading: false };

// Chemins dont le chargement image a été confirmé (évite les cases grises)
// Persisté dans localStorage pour survivre entre sessions (max 100 entrées)
const CONFIRMED_CACHE_KEY = "pick_poster_confirmed_v1";
const MAX_CONFIRMED = 100;
function loadConfirmedCache(): Set<string> {
  try {
    const raw = localStorage.getItem(CONFIRMED_CACHE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}
function saveConfirmedCache(set: Set<string>) {
  try {
    const arr = [...set].slice(-MAX_CONFIRMED);
    localStorage.setItem(CONFIRMED_CACHE_KEY, JSON.stringify(arr));
  } catch {}
}
const confirmedPaths = loadConfirmedCache();
const rejectedPaths = new Set<string>();

// Chargement immédiat des 36 affiches de secours dans le cache navigateur.
// S'exécute dès l'import du module (avant auth, avant toute interaction)
// → les images sont prêtes avant que l'utilisateur ouvre l'overlay.
;(function eagerLoadFallbacks() {
  if (typeof window === "undefined") return;
  FALLBACK_POSTER_PATHS.forEach((path) => {
    if (confirmedPaths.has(path) || rejectedPaths.has(path)) return;
    const src = `https://image.tmdb.org/t/p/${WALL_POSTER_SIZE}${path}`;
    const img = new Image();
    img.onload = () => { confirmedPaths.add(path); saveConfirmedCache(confirmedPaths); };
    img.onerror = () => rejectedPaths.add(path);
    img.src = src;
  });
})();

/** Précharge le mur d'affiches (appeler depuis HomeScreen dès la connexion). */
export async function preloadPosterWallCache(): Promise<void> {
  await loadLambdaCache();
  // Charger les images TMDB dans le cache navigateur dès l'auth
  // → prêtes avant la première recherche
  if (lambdaCache.paths.length > 0) {
    preloadPosterImages(lambdaCache.paths.slice(0, 80), WALL_POSTER_SIZE);
  }
}

async function loadLambdaCache() {
  if (lambdaCache.loading) return;
  lambdaCache.loading = true;
  try {
    const endpoints = [
      fetchFromTMDB("/movie/popular", { page: "1" }),
      fetchFromTMDB("/movie/popular", { page: "2" }),
      fetchFromTMDB("/movie/popular", { page: "3" }),
      fetchFromTMDB("/movie/top_rated", { page: "1" }),
      fetchFromTMDB("/movie/top_rated", { page: "2" }),
      fetchFromTMDB("/trending/movie/week", { page: "1" }),
      fetchFromTMDB("/trending/movie/week", { page: "2" }),
    ];
    const pages = await Promise.all(
      endpoints.map((p) => p.then((d) => extractPosterPaths(d.results)).catch(() => [] as string[])),
    );
    const fromApi = pages.flat();
    const merged = mergePosterPools(FALLBACK_POSTER_PATHS, fromApi);
    if (merged.length >= 2) lambdaCache.paths = merged;
  } finally {
    lambdaCache.loading = false;
  }
}

function preloadPosterImages(paths: string[], size: string = WALL_POSTER_SIZE) {
  const unique = [...new Set(paths)];
  unique.forEach((path) => {
    if (confirmedPaths.has(path) || rejectedPaths.has(path)) return;
    const src = getPosterUrl(path, size);
    if (!src || src.endsWith("/placeholder.svg")) { rejectedPaths.add(path); return; }
    const img = new Image();
    img.decoding = "async";
    img.onload  = () => { confirmedPaths.add(path); saveConfirmedCache(confirmedPaths); };
    img.onerror = () => rejectedPaths.add(path);
    img.src = src;
  });
}

/** Filtre le pool en excluant les chemins connus comme invalides. */
function filterValidPaths(paths: string[]): string[] {
  // Si les confirmations sont trop peu nombreuses (pas encore chargé), retourner tout
  if (confirmedPaths.size < 10) return paths.filter((p) => !rejectedPaths.has(p));
  // Sinon : priorité aux confirmés, complète avec les non-encore-testés
  const confirmed = paths.filter((p) => confirmedPaths.has(p));
  const untested  = paths.filter((p) => !confirmedPaths.has(p) && !rejectedPaths.has(p));
  return confirmed.length >= 20 ? confirmed : [...confirmed, ...untested];
}

const WALL_POSTER_SIZES = [WALL_POSTER_SIZE, "w342", "w500"] as const;

function WallPosterCell({
  cellId,
  path,
  isSpot,
  spotFilter,
  cellPathsRef,
  pool,
}: {
  cellId: string;
  path: string;
  isSpot: boolean;
  spotFilter: string;
  cellPathsRef: MutableRefObject<Map<string, string>>;
  pool: string[];
}) {
  const seedPath = normalizePosterPath(path) ?? FALLBACK_POSTER_PATHS[0];
  const [sizeIndex, setSizeIndex] = useState(0);
  const [altPath, setAltPath] = useState<string | null>(null);
  const [errorAttempts, setErrorAttempts] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const activePath = altPath ?? seedPath;
  const src = getPosterUrl(activePath, WALL_POSTER_SIZES[sizeIndex]) || "";
  const cellStyle = {
    aspectRatio: "2/3" as const,
    minHeight: "5rem",
    transform: isSpot ? "scale(1.05) translateZ(0)" : "translateZ(0)",
    filter: isSpot ? spotFilter : undefined,
    transition: isSpot ? "filter 0.15s ease-out, transform 0.15s ease-out" : undefined,
    position: "relative" as const,
    zIndex: isSpot ? 2 : 0,
  };

  useEffect(() => {
    setSizeIndex(0);
    setAltPath(null);
    setErrorAttempts(0);
    setLoaded(false);
    setFailed(false);
  }, [seedPath]);

  useEffect(() => {
    cellPathsRef.current.set(cellId, activePath);
    return () => {
      cellPathsRef.current.delete(cellId);
    };
  }, [cellId, activePath, cellPathsRef]);

  if (failed || !src || src.includes("placeholder")) {
    return (
      <div
        className="w-full rounded-md flex-shrink-0 select-none bg-gradient-to-br from-primary/20 via-violet-950/30 to-black/50 border border-white/[0.04]"
        style={cellStyle}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="w-full rounded-md flex-shrink-0 select-none relative overflow-hidden bg-gradient-to-br from-primary/20 via-violet-950/30 to-black/50"
      style={cellStyle}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        draggable={false}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
        setLoaded(false);
        if (sizeIndex < WALL_POSTER_SIZES.length - 1) {
          setSizeIndex((i) => i + 1);
          return;
        }
        const fallbackPool = pool.length > FALLBACK_POSTER_PATHS.length ? pool : FALLBACK_POSTER_PATHS;
        if (errorAttempts < fallbackPool.length) {
          const next = pickUnusedPosterPath(
            seedPath,
            errorAttempts,
            cellPathsRef.current.values(),
            fallbackPool,
          );
          setErrorAttempts((n) => n + 1);
          setAltPath(next);
          setSizeIndex(0);
          return;
        }
        setFailed(true);
      }}
      className="absolute inset-0 w-full h-full object-cover select-none"
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease-in" }}
    />
    </div>
  );
}

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

  // Temps écoulé pendant le chargement — voile progressif (throttle pour limiter les repaints)
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (!tonightLoading) { setLoadingElapsed(0); return; }
    const start = Date.now();
    const tick = () => setLoadingElapsed((Date.now() - start) / 1000);
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [tonightLoading]);

  // Pool TMDB + fallbacks — jamais remplacé entièrement par l'API seule
  const [lambdaPaths, setLambdaPaths] = useState<string[]>(
    () => mergePosterPools(FALLBACK_POSTER_PATHS, lambdaCache.paths),
  );
  useEffect(() => {
    void loadLambdaCache();
    if (lambdaCache.paths.length > 0) {
      setLambdaPaths(mergePosterPools(FALLBACK_POSTER_PATHS, lambdaCache.paths));
      return;
    }
    const poll = setInterval(() => {
      if (lambdaCache.paths.length > 0) {
        setLambdaPaths(mergePosterPools(FALLBACK_POSTER_PATHS, lambdaCache.paths));
        clearInterval(poll);
      }
    }, 300);
    return () => clearInterval(poll);
  }, []);

  // Recharger dès l'ouverture de l'overlay (révélation / surprise)
  useEffect(() => {
    if (!open) return;
    void loadLambdaCache().then(() => {
      if (lambdaCache.paths.length > 0) {
        setLambdaPaths(mergePosterPools(FALLBACK_POSTER_PATHS, lambdaCache.paths));
      }
    });
  }, [open]);

  // Films adorés : persistés en localStorage au fil des interactions positives
  const LOVED_KEY = "pick_loved_posters";
  const [lovedPosters, setLovedPosters] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LOVED_KEY) || "[]")
        .map((p: unknown) => normalizePosterPath(typeof p === "string" ? p : null))
        .filter((p: string | null): p is string => !!p);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const path = normalizePosterPath(movie?.poster_path);
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

  const tonightPosterPaths = useMemo(
    () =>
      (tonightPool || [])
        .map((m) => normalizePosterPath(m.poster_path))
        .filter((p): p is string => !!p),
    [tonightPool],
  );

  // Mur de fond : fallbacks + TMDB + picks du soir + films adorés intercalés
  const posterWallPaths = useMemo(() => {
    const normalizedLoved = lovedPosters
      .map((p) => normalizePosterPath(p))
      .filter((p): p is string => !!p);
    const base = mergePosterPools(
      FALLBACK_POSTER_PATHS,
      lambdaPaths,
      tonightPosterPaths,
      normalizedLoved,
    );
    if (normalizedLoved.length === 0) return base;
    const result: string[] = [];
    let li = 0;
    for (let i = 0; i < base.length; i++) {
      result.push(base[i]);
      if ((i + 1) % 4 === 0 && li < normalizedLoved.length) result.push(normalizedLoved[li++]);
    }
    return mergePosterPools(result);
  }, [lambdaPaths, lovedPosters, tonightPosterPaths]);

  const cellPathsRef = useRef<Map<string, string>>(new Map());

  // Mélange stable pour la session d'overlay — attend brièvement le cache TMDB si besoin
  const [sessionWallPaths, setSessionWallPaths] = useState<string[]>([]);
  useEffect(() => {
    if (!open) {
      setSessionWallPaths([]);
      return;
    }
    const minPool = 24;
    if (sessionWallPaths.length >= minPool) return;
    if (posterWallPaths.length < 2) return;

    const buildShuffle = () => {
      const arr = [...posterWallPaths];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setSessionWallPaths(arr);
    };

    if (posterWallPaths.length >= minPool || !lambdaCache.loading) {
      buildShuffle();
      return;
    }

    const wait = setTimeout(buildShuffle, 500);
    return () => clearTimeout(wait);
  }, [open, posterWallPaths, sessionWallPaths.length]);

  const rawWallPaths    = sessionWallPaths.length >= 2 ? sessionWallPaths : posterWallPaths;
  const shuffledWallPaths = useMemo(() => filterValidPaths(rawWallPaths), [rawWallPaths, confirmedPaths.size, rejectedPaths.size]);

  // Précharge toutes les affiches uniques du mur et alimente confirmedPaths/rejectedPaths
  useEffect(() => {
    if (!open || rawWallPaths.length < 2) return;
    preloadPosterImages(rawWallPaths, WALL_POSTER_SIZE);
  }, [open, rawWallPaths]);

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
    const interval = setInterval(flash, 1100);
    return () => { clearInterval(interval); clearTimeout(clearFlash); };
  }, [tonightLoading]);

  // Genres flottants : apparaissent un par un pendant le chargement
  const [shownGenreCount, setShownGenreCount] = useState(0);
  useEffect(() => {
    if (!tonightLoading || userGenres.length === 0) { setShownGenreCount(0); return; }
    const id = setInterval(
      () => setShownGenreCount((n) => Math.min(n + 1, Math.min(3, userGenres.length))),
      650,
    );
    return () => clearInterval(id);
  }, [tonightLoading, userGenres.length]);

  // Layout fixe par genre (position, taille, style) — calculé une fois quand la liste change
  const genreLayouts = useMemo(() => {
    const r = () => Math.random();
    const randTop = () => {
      const band = r();
      if (band < 0.5) return 4 + r() * 14;
      return 78 + r() * 14;
    };
    const randSize = () => [11, 13, 16, 18][Math.floor(r() * 4)];
    const randSide = (size: number) => {
      const side = r() < 0.5 ? "left" : "right";
      const maxOff = size > 16 ? 28 : 38;
      return { side: side as "left" | "right", offset: Math.round(r() * maxOff + 6) };
    };
    const placed: { top: number }[] = [];
    const MIN_VGAP = 14;
    return userGenres.slice(0, 3).map(() => {
      const size = randSize();
      const { side, offset } = randSide(size);
      // Jusqu'à 12 essais pour trouver une position suffisamment éloignée
      let top = randTop();
      for (let attempt = 0; attempt < 12; attempt++) {
        const tooClose = placed.some((p) => Math.abs(p.top - top) < MIN_VGAP);
        if (!tooClose) break;
        top = randTop();
      }
      placed.push({ top });
      return {
        top,
        side,
        offset,
        size,
        weight: [200, 300, 400, 500, 600, 700][Math.floor(r() * 6)],
        italic: r() < 0.35,
        opacity: 0.18 + r() * 0.22,
      };
    });
  }, [userGenres.join(",")]);

  const wallColumns = useMemo(
    () => buildWallColumns(shuffledWallPaths),
    [shuffledWallPaths],
  );

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

  const instantCover = tonightLoading && !movie;
  const wallProgress = Math.min(loadingElapsed / 8, 1);
  const wallVeilOpacity = 0.62 - wallProgress * 0.34;
  const wallSaturation = 0.65 + wallProgress * 0.55;
  const wallBrightness = 0.58 + wallProgress * 0.48;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: instantCover ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: instantCover ? 0 : 0.4 }}
          className="fixed inset-0 z-[55] flex flex-col bg-black"
        >
          {/* Stage 1 : lumières violettes pulsantes pendant que surprise-personalized tourne */}
          <AnimatePresence>
            {!movie && (
              <motion.div
                key="stage1-loading"
                initial={{ opacity: instantCover ? 1 : 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: instantCover ? 0 : 0.8, ease: "easeOut" }}
                className="absolute inset-0 z-20 overflow-hidden"
              >
                <style>{WALL_SCROLL_KEYFRAMES}</style>
                {/* Mur d'affiches : 4 colonnes CSS GPU + voile progressif (1 filtre global, pas par image) */}
                {shuffledWallPaths.length >= 2 && (
                  <div
                    className="absolute inset-0 flex gap-1 overflow-hidden"
                    style={{
                      opacity: 0.42 + wallProgress * 0.46,
                      filter: `saturate(${wallSaturation}) brightness(${wallBrightness})`,
                      transition: "opacity 0.5s ease-out, filter 0.5s ease-out",
                    }}
                  >
                    {wallColumns.map((col, ci) => {
                      const dur = WALL_COLUMN_SECONDS[ci];
                      const goDown = ci % 2 === 1;
                      const phaseDelay = -(dur * ci * 0.22);
                      return (
                        <div
                          key={ci}
                          className={`pick-wall-col flex-1 flex flex-col gap-1 ${goDown ? "pick-wall-col-down" : "pick-wall-col-up"}`}
                          style={{
                            animationDuration: `${dur}s`,
                            animationDelay: `${phaseDelay}s`,
                          }}
                        >
                          {col.map((path, pi) => (
                            <WallPosterCell
                              key={`${ci}-${pi}-${path}`}
                              cellId={`${ci}-${pi}`}
                              path={path}
                              isSpot={path === highlightedPath}
                              spotFilter={spotFilterRef.current}
                              cellPathsRef={cellPathsRef}
                              pool={shuffledWallPaths}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Voile sombre — s'éclaircit progressivement (léger, pas de blur par affiche) */}
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                  style={{
                    background: posterWallPaths.length >= 2
                      ? `rgba(0,0,0,${wallVeilOpacity})`
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
              className="w-full py-[18px] bg-foreground text-background rounded-3xl font-sans font-bold text-[13px] tracking-[0.18em] uppercase mb-5 shadow-[0_18px_50px_-12px_rgba(255,255,255,0.25)]"
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
                <span className="text-foreground/45 text-[9px] font-sans tracking-[0.3em] uppercase">
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
