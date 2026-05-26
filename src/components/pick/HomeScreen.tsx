import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Mic, Flame, Eye, Coffee, Heart, Shuffle } from "lucide-react";

import { ALL_PLATFORMS } from "@/lib/platforms";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import { getTrendingMovies, getBackdropUrl, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  enrichRecommendationBatchWithTexts,
  getRecommendationScore,
  RECOMMENDATION_BATCH_SIZE,
  type RecommendationMovieDetail,
} from "@/lib/recommendation-batch";
import { getEngagementData, getProgressionMessage, type EngagementData } from "@/lib/engagement";
import { listFeedbackByType } from "@/lib/feedback";
import { getMyPreferences } from "@/lib/preferences";

import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";
import QuickFilters, { type QuickFilterState, type ProfileDefaults } from "./QuickFilters";
import TasteTrainer from "./TasteTrainer";
import DiscoverySection from "./DiscoverySection";
import HomeScreenChoiceModal from "./HomeScreenChoiceModal";
import TonightPickOverlay from "./TonightPickOverlay";
import FlipCardDetail from "./FlipCardDetail";
import HomeAmbianceSection, { type AmbianceMood } from "./HomeAmbianceSection";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onSurprise: (movies: MovieDetail[], startIndex?: number, seenMovieIds?: Set<number>) => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
  openTrainerOnMount?: boolean;
  forceCloseTrainer?: boolean;
  onTrainerOpened?: () => void;
  chatSuggestedMovies?: MovieDetail[] | null;
  chatSuggestedStartIndex?: number;
  chatSuggestedSeenMovieIds?: Set<number>;
  onChatSuggestedConsumed?: () => void;
  activationTrainerMode?: boolean;
  onActivationTrainingComplete?: () => void;
}

type RecommendationMatch = {
  confidence: number;
  reason: string;
};

type RejectionContext = {
  reason: string;
  rejectedGenres: string[];
  rejectedTitle: string;
};

const AMBIANCES: { id: AmbianceMood; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "intense", label: "Intense", Icon: Flame },
  { id: "mysterious", label: "Mystérieux", Icon: Eye },
  { id: "comfort", label: "Réconfortant", Icon: Coffee },
  { id: "couple", label: "À deux", Icon: Heart },
  { id: "surprise", label: "Surprends-moi", Icon: Shuffle },
];

const extractTmdbIdsFromFeedbackRows = (rows: any[]): number[] =>
  rows.map((row) => row?.catalog_items?.tmdb_id).filter((id): id is number => typeof id === "number" && id > 0);

const loadUnifiedUserFeedbackState = async () => {
  const [likedRows, lovedRows, seenRows, watchlistRows, notForMeRows, dislikeRows, skipRows, unknownRows] =
    await Promise.all([
      listFeedbackByType("like"),
      listFeedbackByType("love"),
      listFeedbackByType("seen"),
      listFeedbackByType("watchlist"),
      listFeedbackByType("not_for_me"),
      listFeedbackByType("dislike"),
      listFeedbackByType("skip"),
      listFeedbackByType("unknown"),
    ]);

  const excludeIds = [
    ...extractTmdbIdsFromFeedbackRows(likedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(lovedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(seenRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(watchlistRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(notForMeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(dislikeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(skipRows as any[]),
  ];

  const evaluatedIds = [
    ...extractTmdbIdsFromFeedbackRows(likedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(lovedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(seenRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(notForMeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(dislikeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(skipRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(unknownRows as any[]),
  ];

  return {
    excludeIds: [...new Set(excludeIds)],
    evaluatedCount: [...new Set(evaluatedIds)].length,
  };
};

const LOADING_MESSAGES = [
  "Je cherche la perle rare…",
  "Voyons voir ce que j'ai pour toi…",
  "Attends, j'ai peut-être la perle parfaite.",
  "Je parcours mes favoris…",
  "Laisse-moi réfléchir deux secondes…",
  "Je fouille dans ma cinémathèque…",
  "Un instant, je fais chauffer mes neurones.",
  "C'est presque prêt, promis !",
  "Je compare quelques options pour toi…",
  "Hmm, difficile de choisir, t'as bon goût !",
  "J'affine ma sélection…",
  "Encore un petit moment, ça va valoir le coup.",
  "Je suis en train de te concocter un truc sympa.",
  "Ça cogite sévère de mon côté !",
];

const HomeScreen = ({
  onOpenChat,
  onSurprise,
  onMovieSelect,
  loading,
  openTrainerOnMount,
  forceCloseTrainer,
  onTrainerOpened,
  chatSuggestedMovies,
  chatSuggestedStartIndex = 0,
  chatSuggestedSeenMovieIds,
  onChatSuggestedConsumed,
  activationTrainerMode = false,
  onActivationTrainingComplete,
}: HomeScreenProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [tonightProviders, setTonightProviders] = useState<{ name: string; logo_path: string }[]>([]);

  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const [userExcludedPlatformIds, setUserExcludedPlatformIds] = useState<number[]>([]);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [userExcludedGenres, setUserExcludedGenres] = useState<string[]>([]);
  const [userMinRating, setUserMinRating] = useState<number>(0);


  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [lastSql100Ids, setLastSql50Ids] = useState<number[]>([]);
  const [, setEngagement] = useState<EngagementData | null>(null);
  const [, setProgressionMsg] = useState<string | null>(null);
  const [historyExcludeIds, setHistoryExcludeIds] = useState<number[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);
  const [showFindChoice, setShowFindChoice] = useState(false);
  const [explorationLevel] = useState<number>(5);
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [activeAmbiance, setActiveAmbiance] = useState<AmbianceMood | null>(null);

  const [chatMoviesPool, setChatMoviesPool] = useState<MovieDetail[] | null>(null);
  const [movieMatchData, setMovieMatchData] = useState<Record<number, RecommendationMatch>>({});
  const [tonightPickIndex, setTonightPickIndex] = useState(0);
  const [tonightSeenMovieIds, setTonightSeenMovieIds] = useState<Set<number>>(new Set());

  const [flipDetailMovie, setFlipDetailMovie] = useState<MovieDetail | null>(null);
  const [noResultsInfo, setNoResultsInfo] = useState<{
    message: string;
    suggestThreshold?: number;
    suggestRating?: boolean;
  } | null>(null);

  const [quickFilters, setQuickFilters] = useState<QuickFilterState>({
    mediaType: "both",
    maxDuration: null,
    matchThreshold: 80,
    minRating: 0,
    recommendationCount: 3,
  });
  const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults>({
    mediaType: "both",
    maxDuration: null,
    matchThreshold: 80,
    minRating: 0,
    recommendationCount: 3,
  });

  const isMountedRef = useRef(true);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyExcludeIdsRef = useRef<number[]>([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (msgIntervalRef.current !== null) clearInterval(msgIntervalRef.current);
    };
  }, []);

  const tonightPool = useMemo(() => chatMoviesPool || [], [chatMoviesPool]);
  const canGoPrev = tonightPickIndex > 0;
  const canGoNext = tonightPickIndex < tonightPool.length - 1;
  const tonightAllVisited = tonightSeenMovieIds.size >= tonightPool.length && tonightPool.length > 0;

  const loadProviders = async (movie: MovieDetail) => {
    const cached = (movie as any).watchProviders as { name: string; logo_path: string; provider_id?: number }[] | undefined;
    if (cached && Array.isArray(cached)) {
      setTonightProviders(cached);
      return;
    }
    const mediaType = movie.first_air_date ? "tv" : "movie";
    try {
      const providers = await getWatchProviders(movie.id, mediaType);
      setTonightProviders(providers);
    } catch {
      setTonightProviders([]);
    }
  };

  const setCurrentTonightMovie = async (movie: MovieDetail, index: number, seenIds?: Set<number>) => {
    setTonightPick(movie);
    setTonightPickIndex(index);
    setTonightProviders([]);
    if (seenIds) setTonightSeenMovieIds(seenIds);
    await loadProviders(movie);
  };

  useEffect(() => {
    if (!chatSuggestedMovies?.length) return;

    const startIdx = Math.min(chatSuggestedStartIndex, chatSuggestedMovies.length - 1);
    const targetMovie = chatSuggestedMovies[startIdx];
    const seenIds =
      chatSuggestedSeenMovieIds && chatSuggestedSeenMovieIds.size > 0
        ? new Set(chatSuggestedSeenMovieIds)
        : new Set(targetMovie?.id ? [targetMovie.id] : []);

    const effectiveCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;
    const poolChat = chatSuggestedMovies.slice(0, effectiveCount);
    setChatMoviesPool(poolChat);
    void setCurrentTonightMovie(poolChat[startIdx] ?? poolChat[0], startIdx < poolChat.length ? startIdx : 0, seenIds);
    onChatSuggestedConsumed?.();
  }, [chatSuggestedMovies, chatSuggestedSeenMovieIds, chatSuggestedStartIndex, onChatSuggestedConsumed]);

  useEffect(() => {
    if (openTrainerOnMount) {
      setShowTrainer(true);
      onTrainerOpened?.();
    }
  }, [openTrainerOnMount, onTrainerOpened]);

  useEffect(() => {
    if (forceCloseTrainer) setShowTrainer(false);
  }, [forceCloseTrainer]);

  useEffect(() => {
    if (!user) return;

    getEngagementData(user.id).then((data) => {
      if (!data) return;
      setEngagement(data);
      setProgressionMsg(getProgressionMessage(data));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select(
        "preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, default_media_type, default_max_duration, match_threshold, default_recommendation_count",
      )
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_platforms) setUserPlatformIds(data.preferred_platforms);
        if ((data as any)?.excluded_platforms) {
          setUserExcludedPlatformIds((data as any).excluded_platforms);
        }
        if (data?.favorite_genres) setUserGenres(data.favorite_genres);
        if ((data as any)?.excluded_genres) {
          setUserExcludedGenres((data as any).excluded_genres);
        }

        // Merge rejected genres from the preferences system (weight < 0)
        getMyPreferences().then((prefs) => {
          const rejectedLabels = prefs
            .filter((p) => p.tag.category === "genre" && p.weight < 0)
            .map((p) => p.tag.label);
          if (rejectedLabels.length > 0) {
            setUserExcludedGenres((prev) => [...new Set([...prev, ...rejectedLabels])]);
          }
        }).catch(() => {});
        if ((data as any)?.min_rating) {
          setUserMinRating((data as any).min_rating);
        }

        const defaults: ProfileDefaults = {
          mediaType: ((data as any)?.default_media_type as "both" | "movie" | "tv") || "both",
          maxDuration: (data as any)?.default_max_duration ?? null,
          matchThreshold: (data as any)?.match_threshold ?? 80,
          minRating: (data as any)?.min_rating ?? 0,
          recommendationCount: Math.min((data as any)?.default_recommendation_count ?? 3, 3),
        };

        setProfileDefaults(defaults);
        setQuickFilters(defaults);
      });

    loadUnifiedUserFeedbackState().then(({ excludeIds, evaluatedCount }) => {
      setHistoryExcludeIds(excludeIds);
      historyExcludeIdsRef.current = excludeIds;
      setTotalEvaluated(evaluatedCount);
      console.log("[PICK-DEBUG] ✅ Exclusions chargées au démarrage:", excludeIds.length, "IDs", excludeIds.slice(0, 30));
    });
  }, [user]);

  // Refresh exclusion list whenever the user interacts with any movie so that
  // fresh likes / dislikes / not-for-me ratings are excluded from the next batch.
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      loadUnifiedUserFeedbackState().then(({ excludeIds }) => {
        setHistoryExcludeIds(excludeIds);
        historyExcludeIdsRef.current = excludeIds;
        console.log("[PICK-DEBUG] 🔄 Exclusions mises à jour après interaction:", excludeIds.length, "IDs", excludeIds.slice(0, 30));
      });
    };
    window.addEventListener("pick-feedback-changed", refresh);
    window.addEventListener("pick-watchlist-added", refresh);
    return () => {
      window.removeEventListener("pick-feedback-changed", refresh);
      window.removeEventListener("pick-watchlist-added", refresh);
    };
  }, [user]);

  useEffect(() => {
    getTrendingMovies(20)
      .then((movies: Movie[]) => {
        const bgs = movies
          .filter((m) => m.backdrop_path)
          .map((m) => getBackdropUrl(m.backdrop_path))
          .filter(Boolean) as string[];
        setBgImages(bgs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (bgImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBgIndex((i) => (i + 1) % bgImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [bgImages]);

  const invokeSurprisePersonalized = async (body: unknown, retries = 2): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });

    if (error) {
      const errMsg = typeof error === "object" && error?.message ? error.message : String(error);

      if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
        return invokeSurprisePersonalized(body, retries - 1);
      }

      throw error;
    }

    return data;
  };

  const generateTonightPick = async (excludeList: number[] = rejectedIds, rejectionContext?: RejectionContext) => {
    const poolIds = (chatMoviesPool || []).map((m) => m.id).filter(Number.isFinite);
    const allExcludeIds = [...new Set([...excludeList, ...poolIds, ...historyExcludeIdsRef.current])];

    console.log("[PICK-DEBUG] ═══ generateTonightPick ═══");
    console.log("[PICK-DEBUG] historyExcludeIds (depuis feedback):", historyExcludeIdsRef.current.length, "IDs", historyExcludeIdsRef.current.slice(0, 20));
    console.log("[PICK-DEBUG] rejectedIds (session):", excludeList.length, "IDs", excludeList);
    console.log("[PICK-DEBUG] poolIds (chat pool):", poolIds.length, "IDs");
    console.log("[PICK-DEBUG] TOTAL allExcludeIds envoyés à l'edge function:", allExcludeIds.length);

    setTonightLoading(true);
    setTonightProviders([]);

    let msgIndex = 0;
    setTonightLoadingMsg(LOADING_MESSAGES[0]);

    const msgInterval = setInterval(() => {
      if (!isMountedRef.current) return;
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setTonightLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2000);
    msgIntervalRef.current = msgInterval;

    try {
      let movies: MovieDetail[] = [];
      let engineMetaResult: any = null;

      if (user) {
        const liked = await getLikedMovies();

        if (liked.length >= 2) {
          const [multiProfile, tasteProfile] = await Promise.all([
            computeMultiVectorProfile(user.id),
            getUserTasteProfile(),
          ]);

          const userTasteVector = multiProfile?.stableTasteVector || null;

          console.group("[PICK-DEBUG] 📤 Paramètres envoyés à surprise-personalized");
          console.log("userTasteVector :", userTasteVector ? `✅ ${userTasteVector.length} dims` : "❌ NULL — SQL sera sauté");
          console.log("mediaType       :", quickFilters.mediaType);
          console.log("platformIds     :", userPlatformIds?.length ? userPlatformIds : "aucune");
          console.log("topGenres       :", tasteProfile?.topGenres?.slice(0, 8) ?? []);
          console.log("excludedGenres  :", userExcludedGenres?.length ? userExcludedGenres : "aucun");
          console.log("maxDuration     :", quickFilters.maxDuration ?? "illimitée");
          console.log("minMatchScore   :", quickFilters.matchThreshold, "%");
          console.log("count demandé   :", quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE);
          console.log("excludeIds      :", allExcludeIds.length, "IDs");
          console.groupEnd();

          const data = await invokeSurprisePersonalized({
            likedMovies: liked,
            userTasteVector,
            tasteProfile,
            recentTasteVector: multiProfile?.recentTasteVector || null,
            avoidanceVector: multiProfile?.avoidanceVector || null,
            platformIds: userPlatformIds,
            excludedPlatformIds: userExcludedPlatformIds,
            excludedGenres: userExcludedGenres,
            minRating: userMinRating,
            excludeIds: allExcludeIds,
            rejectionContext,
            explorationLevel,
            mediaType: quickFilters.mediaType !== "both" ? quickFilters.mediaType : "both",
            maxDuration: quickFilters.maxDuration,
            count: (quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE) * 3,
            minMatchScore: quickFilters.matchThreshold,
          });
          engineMetaResult = data?.engineMeta ?? null;
          const dbg = data?.debugData;

          // Mémoriser les 50 candidats SQL évalués pour les exclure au prochain appel
          if (dbg?.sql50?.length) {
            const sql50Ids = (dbg.sql50 as any[]).map((c) => Number(c.id)).filter(Number.isFinite);
            setLastSql50Ids(sql50Ids);
          }

          console.group("[PICK-DEBUG] ═══ Pipeline de recommandation ═══");

          // ── Étape 1 : SQL ──
          if (dbg?.sql50?.length) {
            const f = dbg.filters;
            console.group(`[PICK-DEBUG] 1️⃣ SQL — ${dbg.sql50.length} candidats (${f?.excludeCount ?? 0} exclus — déjà vus)`);
            console.log(`   Paramètres SQL :`);
            console.log(`     note min      : ${f?.minRating ?? 0}`);
            console.log(`     durée max     : ${f?.maxDuration ? `${f.maxDuration}min` : "illimitée"}`);
            console.log(`     genres aimés  : [${(f?.likedGenres || []).join(", ") || "—"}]`);
            console.log(`     genres exclus : [${(f?.effectiveExcludedGenres || []).join(", ") || "—"}]`);
            console.table(dbg.sql50.map((c: any, i: number) => ({
              "#": i + 1,
              "Titre": c.title,
              "Année": c.year,
              "Note /10": c.note ?? "–",
              "Sim%": c.sim ?? "–",
              "Composite": c.composite ?? "–",
              "Genres": (c.genres || []).join(", "),
              "Type": c.type,
            })));
            console.groupEnd();
          }

          // ── Profil LLM ──
          if (dbg?.llmProfile) {
            const p = dbg.llmProfile;
            console.log(`[PICK-DEBUG] 🧠 Profil utilisateur → LLM`);
            console.log(`   Paramètres LLM :`);
            console.log(`     genres préférés  : [${(p.genresPrefers || []).join(", ") || "—"}]`);
            console.log(`     genres exclus    : [${(p.genresExclus || []).join(", ") || "—"}]`);
            console.log(`     origines aimées  : [${(p.originesAimees || []).join(", ") || "—"}]`);
            console.log(`     origines exclues : [${(p.originesExclues || []).join(", ") || "—"}]`);
            console.log(`     genres fatigue   : [${(p.genresFatigue || []).join(", ") || "—"}]`);
            console.log(`     clusters favoris : [${(p.clusters || []).join(", ") || "—"}]`);
            console.log(`     clusters rejetés : [${(p.clustersRejetes || []).join(", ") || "—"}]`);
            console.log(`     films aimés      : [${(p.filmsAimes || []).join(", ") || "—"}]`);
            console.log(`     confiance profil : ${p.confianceProfil}/100`);
            console.log(`     type média       : ${p.mediaType}`);
            console.log(`     exploration      : ${p.explorationLevel}/10`);
            console.log(`     score min        : ${p.minMatchScore}%`);
            if (dbg.systemPrompt) {
              console.group(`[PICK-DEBUG] 📄 Prompt système complet envoyé au LLM`);
              console.log(dbg.systemPrompt);
              console.groupEnd();
            }
          }

          // ── Étape 2 : Top 20 triés par score composé ──
          if (dbg?.top20?.length) {
            console.group(`[PICK-DEBUG] 2️⃣ Top ${dbg.top20.length} envoyés au LLM — triés par score composé (sim×100 + note)`);
            console.table(dbg.top20.map((c: any, i: number) => ({
              "#": i + 1,
              "Titre": c.title,
              "Note /10": c.note ?? "–",
              "Sim%": c.sim ?? "–",
              "Composite (sim×100+note)": c.composite ?? "–",
              "Genres": (c.genres || []).join(", "),
              "Type": c.type,
            })));
            console.groupEnd();
          }

          // ── Étape 3 : Sélections LLM ──
          if (dbg?.llmSelections?.length) {
            console.group(`[PICK-DEBUG] 3️⃣ Sélections LLM (${dbg.llmSelections.length} films → movie-match va scorer)`);
            console.table(dbg.llmSelections.map((s: any, i: number) => ({
              "#": i + 1,
              "Titre": s.title,
              "Score LLM": `${s.matchScore}%`,
              "Raison": s.reason,
            })));
            console.groupEnd();
          }

          // ── Étape 3.5b : Fallback trace (mode discover-fallback) ──
          if (dbg?.fallbackTrace?.length) {
            console.group(`[PICK-DEBUG] 🔀 Films ajoutés en mode fallback — ${dbg.fallbackTrace.length} film(s) (aucun candidat SQL/LLM disponible)`);
            console.table(dbg.fallbackTrace.map((t: any, i: number) => ({
              "#": i + 1,
              "Titre": t.title,
              "ID TMDB": t.id,
              "Type": t.type,
              "Source": t.stage,
            })));
            console.groupEnd();
          }

          // ── Étape 3.5 : Enrichissement TMDB ──
          if (dbg?.tmdbEnrichment?.length) {
            const failed = dbg.tmdbEnrichment.filter((t: any) => !t.ok);
            const ok = dbg.tmdbEnrichment.filter((t: any) => t.ok);
            console.group(`[PICK-DEBUG] 3️⃣.5 TMDB enrichissement — ✅ ${ok.length} OK / ❌ ${failed.length} échoués`);
            console.table(dbg.tmdbEnrichment.map((t: any, i: number) => ({
              "#": i + 1,
              "Titre": t.title,
              "ID TMDB": t.id,
              "Type": t.type,
              "Statut": t.ok ? "✅ OK" : `❌ ${t.reason || "échec"}`,
            })));
            if (failed.length > 0) {
              console.warn(`[PICK-DEBUG] ⚠️ ${failed.length} film(s) LLM perdus au TMDB lookup → fallback trending activé`);
            }
            console.groupEnd();
          }

          console.log("[PICK-DEBUG] engineMeta:", data?.engineMeta);
          console.groupEnd();
          const extracted = extractRecommendationMovies(data);
          const desiredCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;

          // Fallback AI confidence scores — shown immediately while movie-match scores load
          const matchMap: Record<number, RecommendationMatch> = {};
          (data?.movies || []).forEach((m: any) => {
            if (!m.movie?.id) return;
            matchMap[m.movie.id] = {
              confidence: m.confidence || 75,
              reason: m.reason || "",
            };
          });
          setMovieMatchData((prev) => ({ ...prev, ...matchMap }));

          // Single call: fills to desiredCount, scores, filters by threshold
          movies = await ensureRecommendationBatch(extracted, {
            excludeIds: allExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            mediaType: quickFilters.mediaType,
            size: desiredCount,
            preloadMatchTexts: true,
            preloadProviders: true,
            minMatchScore: quickFilters.matchThreshold,
          });

          console.group("[PICK-DEBUG] 4️⃣ Résultat final après movie-match");
          console.table(movies.map((m: any, i: number) => ({
            "#": i + 1,
            "Titre": m.title,
            "Score movie-match": `${getRecommendationScore(m.recommendationTexts) ?? "–"}%`,
            "Rich texts": m.recommendationTexts?.headline ? "oui" : "non",
          })));
          console.groupEnd();

          // Safety net: if batch processing filtered everything but edge function returned results,
          // display them directly — UNIQUEMENT si aucune plateforme sélectionnée (sinon on risque
          // de montrer des films absents des plateformes de l'utilisateur).
          if (movies.length === 0 && extracted.length > 0 && !userPlatformIds?.length) {
            console.log("[PICK-DEBUG] ⚠️ Safety net activé — films filtrés, fallback sur extracted brut");
            movies = extracted.slice(0, desiredCount) as MovieDetail[];
          }

          // Override with actual movie-match scores now that they're available
          const actualScoreMap: Record<number, RecommendationMatch> = {};
          (movies as any[]).forEach((m: any) => {
            const texts = m.recommendationTexts;
            const score = getRecommendationScore(texts);
            if (m.id && score != null) {
              actualScoreMap[m.id] = {
                confidence: score,
                reason: texts?.reason ?? texts?.whyItMatches ?? texts?.summary ?? matchMap[m.id]?.reason ?? "",
              };
            }
          });
          if (Object.keys(actualScoreMap).length > 0) {
            setMovieMatchData((prev) => ({ ...prev, ...actualScoreMap }));
          }
        } else {
          movies = await ensureRecommendationBatch([], {
            excludeIds: allExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            mediaType: quickFilters.mediaType,
            size: quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE,
            preloadMatchTexts: true,
            preloadProviders: true,
            minMatchScore: quickFilters.matchThreshold,
          });
          const scoreMapB: Record<number, RecommendationMatch> = {};
          (movies as any[]).forEach((m: any) => {
            const texts = m.recommendationTexts;
            const score = getRecommendationScore(texts);
            if (m.id && score != null) {
              scoreMapB[m.id] = {
                confidence: score,
                reason: texts?.reason ?? texts?.whyItMatches ?? texts?.summary ?? "",
              };
            }
          });
          if (Object.keys(scoreMapB).length > 0) {
            setMovieMatchData((prev) => ({ ...prev, ...scoreMapB }));
          }
        }
      } else {
        movies = await ensureRecommendationBatch([], {
          excludeIds: allExcludeIds,
          platformIds: userPlatformIds,
          minRating: userMinRating,
          excludedGenres: userExcludedGenres,
          mediaType: quickFilters.mediaType,
          size: quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE,
          preloadMatchTexts: true,
          preloadProviders: true,
          minMatchScore: quickFilters.matchThreshold,
        });
        const scoreMapC: Record<number, RecommendationMatch> = {};
        (movies as any[]).forEach((m: any) => {
          const texts = m.recommendationTexts;
          const score = getRecommendationScore(texts);
          if (m.id && score != null) {
            scoreMapC[m.id] = {
              confidence: score,
              reason: texts?.reason ?? texts?.whyItMatches ?? texts?.summary ?? "",
            };
          }
        });
        if (Object.keys(scoreMapC).length > 0) {
          setMovieMatchData((prev) => ({ ...prev, ...scoreMapC }));
        }
      }

      // ── Diagnostic : filtres trop stricts ──────────────────────────────
      if (isMountedRef.current) {
        const engineMeta = engineMetaResult;
        const threshold = quickFilters.matchThreshold;
        const rating = userMinRating;

        if (movies.length === 0) {
          // Aucun film trouvé malgré tous les fallbacks — message explicite
          let message = "Impossible de trouver des films pour le moment.";
          let suggestThreshold: number | undefined;
          let suggestRating: boolean | undefined;
          if (threshold > 70 && rating > 6) {
            message = `Seuil à ${threshold}% et note min ${rating}/10 combinés — aucun film ne correspond. Essaie de baisser l'un des deux.`;
            suggestThreshold = 60;
            suggestRating = true;
          } else if (threshold > 70) {
            message = `Aucun film trouvé à ${threshold}% de correspondance. Essaie de baisser le seuil.`;
            suggestThreshold = 60;
          } else if (rating > 6) {
            message = `Aucun film trouvé avec une note min de ${rating}/10. Essaie d'enlever ou de baisser ce filtre.`;
            suggestRating = true;
          }
          setNoResultsInfo({ message, suggestThreshold, suggestRating });
          return;
        }

        // Films trouvés via fallback nucléaire (tous les filtres levés)
        if (engineMeta?.filtersRelaxed && engineMeta?.mode === "discover-fallback") {
          toast.info(
            "Aucun film trouvé avec tes filtres — voici des suggestions populaires à la place.",
            { duration: 6000 }
          );
        } else if (engineMeta?.filtersRelaxed && threshold > 65) {
          toast.info(
            `Seuil de ${threshold}% trop strict — les suggestions proposées sont les plus proches trouvées`,
            { duration: 5000 }
          );
        }
      }

      if (isMountedRef.current && movies.length > 0) {
        setNoResultsInfo(null);
        const displayCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;
        // Ne pas re-filtrer par watchProviders : l'edge function a déjà filtré par plateforme.
        // Le TMDB provider check client-side peut manquer des résultats (cache miss / race),
        // ce qui réduirait le pool à 1 film alors que tous sont bien sur la plateforme de l'utilisateur.
        const poolMovies = movies.slice(0, displayCount);
        setChatMoviesPool(poolMovies);
        await setCurrentTonightMovie(poolMovies[0], 0, new Set(poolMovies[0] ? [poolMovies[0].id] : []));

        // Background enrichment: call movie-match to get rich personalized teasers.
        // Runs after display so the overlay appears immediately, text updates when ready.
        const moviesToEnrich = movies as RecommendationMovieDetail[];
        const enrichmentThreshold = quickFilters.matchThreshold;
        void (async () => {
          try {
            const enriched = await enrichRecommendationBatchWithTexts(moviesToEnrich, {
              minMatchScore: enrichmentThreshold || undefined,
            });
            if (!isMountedRef.current) return;

            // Soft floor: only reduce pool if we retain the full requested count.
            const scoreFloor = enrichmentThreshold ?? 60;
            const aboveFloor = enriched.filter((m: RecommendationMovieDetail) => {
              const score = getRecommendationScore(m.recommendationTexts);
              return score === null || score >= scoreFloor;
            });
            const rawFinalPool = aboveFloor.length >= moviesToEnrich.length ? aboveFloor : enriched;
            // Pas de filtre watchProviders ici non plus — l'edge function est autoritaire sur la plateforme.
            const finalPool = rawFinalPool.slice(0, displayCount);
            setChatMoviesPool(finalPool);

            // Update movieMatchData with richer text for the overlay's matchInfo fallback
            const richMap: Record<number, RecommendationMatch> = {};
            (aboveFloor.length >= moviesToEnrich.length ? aboveFloor : enriched).forEach((m: any) => {
              const t = m.recommendationTexts;
              const score = getRecommendationScore(t);
              if (m.id && score != null) {
                richMap[m.id] = {
                  confidence: score,
                  reason: t?.summary ?? t?.whyItMatches ?? t?.detailedExplanation ?? t?.reason ?? "",
                };
              }
            });
            if (Object.keys(richMap).length > 0) {
              setMovieMatchData((prev) => ({ ...prev, ...richMap }));
            }
          } catch {
            // Silent fail — keep original text
          }
        })();
      }
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(msgInterval);
      msgIntervalRef.current = null;
      if (isMountedRef.current) {
        setTonightLoading(false);
        setTonightLoadingMsg("");
      }
    }
  };

  const handleAutoPick = () => {
    setShowFindChoice(false);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setNoResultsInfo(null);
    void generateTonightPick(rejectedIds);
  };

  const handleCloseTonightPick = () => setTonightPick(null);

  const handleNavigateTonightPick = async (direction: "prev" | "next") => {
    const newIndex =
      direction === "next" ? Math.min(tonightPickIndex + 1, tonightPool.length - 1) : Math.max(tonightPickIndex - 1, 0);

    if (newIndex === tonightPickIndex) return;

    const nextSeen = new Set(tonightSeenMovieIds);
    const movieId = tonightPool[newIndex]?.id;
    if (movieId) nextSeen.add(movieId);

    await setCurrentTonightMovie(tonightPool[newIndex], newIndex, nextSeen);
  };

  const handleOpenMovieDetail = () => {
    if (!tonightPick) return;
    setFlipDetailMovie(tonightPick);
  };

  const handleWatchNow = () => {
    if (!tonightPick) return;
    const moviesToPass = chatMoviesPool && chatMoviesPool.length > 0 ? chatMoviesPool : [tonightPick];
    onSurprise(moviesToPass, tonightPickIndex, tonightSeenMovieIds);
  };

  const handleRejectAndRefresh = async (movie: MovieDetail, reason: RejectionContext["reason"]) => {
    const nextRejected = [...rejectedIds, movie.id];
    const rejContext: RejectionContext = {
      reason,
      rejectedGenres: (movie.genres || []).map((g) => g.name),
      rejectedTitle: movie.title || movie.name || "",
    };

    setRejectedIds(nextRejected);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setTonightSeenMovieIds(new Set());
    setNoResultsInfo(null);

    await generateTonightPick(nextRejected, rejContext);
  };

  const handleMovieAction = async (type: "already_seen" | "dislike" | string) => {
    if (!tonightPick) return;
    if (type === "already_seen") return;
    if (type !== "dislike") return;

    const nextRejected = [...rejectedIds, tonightPick.id];
    setRejectedIds(nextRejected);

    // Mark as seen so "X autres suggestions" unlocks when all films are disliked
    const nextSeen = new Set(tonightSeenMovieIds);
    nextSeen.add(tonightPick.id);

    // Navigate within the existing pool — no auto-search, user must press "X autres suggestions"
    if (tonightPool.length > 1 && tonightPickIndex < tonightPool.length - 1) {
      const nextSeen2 = new Set(nextSeen);
      nextSeen2.add(tonightPool[tonightPickIndex + 1]?.id);
      await setCurrentTonightMovie(tonightPool[tonightPickIndex + 1], tonightPickIndex + 1, nextSeen2);
      return;
    }

    if (tonightPickIndex > 0) {
      const nextSeen2 = new Set(nextSeen);
      nextSeen2.add(tonightPool[tonightPickIndex - 1]?.id);
      await setCurrentTonightMovie(tonightPool[tonightPickIndex - 1], tonightPickIndex - 1, nextSeen2);
      return;
    }

    // Last film in pool — update seen so the button unlocks
    setTonightSeenMovieIds(nextSeen);
  };

  const handleMoreSuggestions = async () => {
    if (!tonightPick) return;

    trackInteraction(tonightPick.id, "skipped", {
      reason: "not_my_style",
      genres: (tonightPick.genres || []).map((g) => g.name),
    });

    // Exclure les 50 candidats SQL du dernier appel + le pool courant
    // pour garantir que SQL retourne des films entièrement nouveaux.
    const currentPoolIds = (chatMoviesPool || []).map((m) => m.id).filter(Number.isFinite);
    const nextRejected = [...new Set([...rejectedIds, ...currentPoolIds, ...lastSql100Ids])];
    setRejectedIds(nextRejected);

    const rejContext: RejectionContext = {
      reason: "not_my_style",
      rejectedGenres: (tonightPick.genres || []).map((g) => g.name),
      rejectedTitle: tonightPick.title || tonightPick.name || "",
    };
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setTonightSeenMovieIds(new Set());
    setNoResultsInfo(null);

    await generateTonightPick(nextRejected, rejContext);
  };

  return (
    <div className="relative w-full h-full overflow-x-hidden">
      <BrandHeader
        extraActions={
          <QuickFilters filters={quickFilters} onFiltersChange={setQuickFilters} profileDefaults={profileDefaults} />
        }
      />

      {bgImages.map((bg, i) => (
        <motion.div
          key={bg}
          initial={{ opacity: 0 }}
          animate={{ opacity: i === currentBgIndex ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg})` }}
        />
      ))}

      {/* Midnight Curator: cinematic fade — backdrop kept atmospheric, never noisy */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      <div className="absolute inset-0 bg-background/40" />

      <div className="relative z-10 h-full overflow-y-auto overscroll-y-contain touch-pan-y">
        {/* ─── Cinematic Hero ─── */}
        <section className="relative pt-20 pb-4 px-5 md:px-8">
          {/* Mascot floating on the right with violet halo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, x: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute right-0 top-12 w-[55%] max-w-[280px] flex justify-end pr-1"
          >
            <div className="relative">
              <div
                className="absolute inset-0 -z-10 blur-3xl opacity-70"
                style={{
                  background:
                    "radial-gradient(ellipse at center, hsl(var(--primary) / 0.32), transparent 70%)",
                }}
              />
              <PickCharacter mood="wave" size="lg" animate />
            </div>
          </motion.div>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative flex items-center gap-1.5 mb-3"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10.5px] font-sans font-semibold tracking-[0.18em] uppercase text-primary">
              Pick comprend tes envies
            </span>
          </motion.div>

          {/* Hero serif headline */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="relative font-serif text-foreground text-[42px] sm:text-[50px] leading-[1] tracking-tight max-w-[64%]"
            translate="no"
          >
            Ce soir,
            <br />
            quelque chose
            <br />
            d
            <span className="italic bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent">
              ’intense
            </span>
            <span className="text-foreground">.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.5 }}
            className="relative mt-5 text-foreground/65 text-[13.5px] leading-relaxed font-sans max-w-[62%]"
          >
            Pick comprend tes envies. J’ai préparé une sélection brute et visuelle.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="relative mt-7"
          >
            <motion.button
              data-tour="pick-ce-soir"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowFindChoice(true)}
              disabled={loading}
              className="fab-pulse inline-flex items-center justify-center gap-2.5 w-full max-w-[320px] py-[18px] px-7 rounded-full bg-gradient-to-b from-primary to-accent text-primary-foreground font-sans font-semibold text-[15px] tracking-wide shadow-[0_18px_50px_-12px_hsl(var(--primary)/0.6)] hover:shadow-[0_22px_60px_-10px_hsl(var(--primary)/0.75)] transition-shadow disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Trouve-moi 1 film
            </motion.button>
          </motion.div>

          {/* Voice card — same premium surface family as cards below */}
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.55 }}
            whileTap={{ scale: 0.985 }}
            onClick={onOpenChat}
            className="relative mt-6 w-full flex items-center gap-4 p-3.5 pr-5 rounded-[26px] border border-white/[0.05] bg-[linear-gradient(180deg,hsl(240_14%_9%/0.85),hsl(240_18%_5%/0.7))] backdrop-blur-2xl text-left hover:border-white/[0.09] transition-all shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <span className="relative flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-subtle-pulse" />
              <span className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary/12 border border-primary/40">
                <Mic className="w-[18px] h-[18px] text-primary" />
              </span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-serif text-foreground text-[17px] leading-tight">
                Parle-moi…
              </span>
              <span className="block text-foreground/45 text-[12px] font-sans mt-1">
                Dis ce que tu as envie de voir
              </span>
            </span>
            <span className="flex items-end gap-[2.5px] h-5" aria-hidden="true">
              {[6, 14, 9, 18, 12, 20, 8, 15, 7].map((h, i) => (
                <motion.span
                  key={i}
                  className="w-[2.5px] rounded-full bg-primary/70"
                  animate={{ height: [`${h * 0.4}px`, `${h}px`, `${h * 0.5}px`] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </span>
          </motion.button>

          {/* Ambiance chips — compact single row, directly under "Parle-moi" */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-4"
          >
            <div className="flex items-baseline justify-between mb-2 px-0.5">
              <h3 className="font-serif text-foreground text-[14px] leading-tight">
                Choisis ton ambiance
              </h3>
              <span className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">
                Filtre rapide
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 w-full">
              {AMBIANCES.map(({ id, label, Icon }, i) => {
                const active = activeAmbiance === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85 + i * 0.04, duration: 0.35 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      setActiveAmbiance(id);
                      if (id === "surprise") {
                        handleAutoPick();
                      } else {
                        setShowFindChoice(true);
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-1 h-7 px-1 rounded-full font-sans text-[10px] font-medium transition-all duration-300 min-w-0 ${
                      active
                        ? "bg-[linear-gradient(180deg,hsl(var(--primary)/0.22),hsl(var(--primary)/0.08))] text-primary border border-primary/55 shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_6px_18px_-6px_hsl(var(--primary)/0.5)]"
                        : "bg-white/[0.03] text-foreground/70 border border-white/[0.06] hover:bg-white/[0.06] hover:text-foreground/90"
                    }`}
                  >
                    <Icon
                      className={`w-3 h-3 flex-shrink-0 transition-colors ${
                        active ? "text-primary" : "text-foreground/45"
                      }`}
                      strokeWidth={2}
                    />
                    <span className="truncate">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

        </section>

        <div className="mt-10">
          <HomeAmbianceSection
            activeAmbiance={activeAmbiance}
            onPickAmbiance={(mood) => {
              setActiveAmbiance(mood);
              if (mood === "surprise") {
                handleAutoPick();
              } else {
                setShowFindChoice(true);
              }
            }}
          />
        </div>

        <div className="px-5 md:px-12 pb-32 pt-8">
          <DiscoverySection
            onMovieSelect={onMovieSelect}
            platformIds={userPlatformIds}
            favoriteGenres={userGenres}
            minRating={userMinRating}
            excludedGenres={userExcludedGenres}
          />
        </div>
      </div>

      <HomeScreenChoiceModal
        open={showFindChoice}
        mediaType={quickFilters.mediaType}
        onClose={() => setShowFindChoice(false)}
        onAutoPick={handleAutoPick}
        onOpenChat={() => {
          setShowFindChoice(false);
          onOpenChat();
        }}
      />

      <AnimatePresence>
        {tonightLoading && !tonightPick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
            <div className="relative z-10 flex flex-col items-center">
              <PickCharacter mood="think" message={tonightLoadingMsg} size="md" animate />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau "aucun résultat" — filtres trop stricts */}
      <AnimatePresence>
        {noResultsInfo && !tonightPick && !tonightLoading && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40"
          >
            <div className="bg-background/96 backdrop-blur-xl border border-border/20 rounded-2xl p-5 shadow-2xl">
              <p className="text-foreground/80 text-[13px] font-sans leading-relaxed mb-4">
                {noResultsInfo.message}
              </p>
              <div className="flex flex-wrap gap-2">
                {noResultsInfo.suggestThreshold && (
                  <button
                    onClick={() => {
                      setQuickFilters((f) => ({ ...f, matchThreshold: noResultsInfo.suggestThreshold! }));
                      setNoResultsInfo(null);
                      void generateTonightPick(rejectedIds);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-[12px] font-sans font-medium hover:bg-primary/25 transition-colors"
                  >
                    Baisser le seuil à {noResultsInfo.suggestThreshold}%
                  </button>
                )}
                {noResultsInfo.suggestRating && (
                  <button
                    onClick={() => {
                      setUserMinRating(0);
                      setNoResultsInfo(null);
                      void generateTonightPick(rejectedIds);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-foreground/8 border border-border/20 text-foreground/60 text-[12px] font-sans font-medium hover:bg-foreground/12 transition-colors"
                  >
                    Enlever la note min
                  </button>
                )}
                <button
                  onClick={() => {
                    setNoResultsInfo(null);
                    void generateTonightPick(rejectedIds);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-foreground/8 border border-border/20 text-foreground/40 text-[12px] font-sans font-medium hover:bg-foreground/12 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TonightPickOverlay
        open={!!tonightPick && !flipDetailMovie}
        movie={tonightPick}
        tonightPool={tonightPool}
        tonightPickIndex={tonightPickIndex}
        tonightSeenMovieIds={tonightSeenMovieIds}
        tonightProviders={tonightProviders}
        movieMatchData={movieMatchData}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        tonightAllVisited={tonightAllVisited}
        tonightLoading={tonightLoading}
        onClose={handleCloseTonightPick}
        onPrev={() => void handleNavigateTonightPick("prev")}
        onNext={() => void handleNavigateTonightPick("next")}
        onOpenDetail={handleOpenMovieDetail}
        onConfirm={handleWatchNow}
        onInteraction={(type) => void handleMovieAction(type)}
        onMoreSuggestions={() => void handleMoreSuggestions()}
        expectedCount={quickFilters.recommendationCount}
      />

      <FlipCardDetail
        item={flipDetailMovie}
        type="movie"
        isOpen={!!flipDetailMovie}
        onClose={() => setFlipDetailMovie(null)}
        recommendationTextsByMovieId={
          Object.fromEntries(
            (chatMoviesPool ?? [])
              .filter((m): m is RecommendationMovieDetail => !!(m as RecommendationMovieDetail).recommendationTexts)
              .map((m) => [m.id, (m as RecommendationMovieDetail).recommendationTexts])
          )
        }
      />

      <AnimatePresence>
        {showTrainer && (
          <TasteTrainer
            isActivation={activationTrainerMode}
            onActivationComplete={onActivationTrainingComplete}
            onClose={() => {
              setShowTrainer(false);

              if (!user) return;

              loadUnifiedUserFeedbackState().then(({ evaluatedCount, excludeIds }) => {
                setTotalEvaluated(evaluatedCount);
                setHistoryExcludeIds(excludeIds);
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
