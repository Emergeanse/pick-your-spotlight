import { useState, useEffect, useRef, useMemo } from "react";
import type { GenrePreferencesHandle } from "@/components/pick/GenrePreferences";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  Check, ChevronDown, ChevronRight, LogOut, Loader2, Info, Camera, Pencil, Shield,
  ArrowLeft, Sparkles, Brain, Film, Tv, Trophy, Eye, Heart, Bookmark, TrendingUp, Users, RotateCcw,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import ProfilePreferences from "@/components/pick/ProfilePreferences";
import { ALL_PLATFORMS } from "@/lib/platforms";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import { getMyPreferences } from "@/lib/preferences";
import { resetProfileForOnboarding, onboardingErrorMessage } from "@/lib/onboarding-progress";
import CinemaDNA from "@/components/pick/CinemaDNA";
import TasteTrainer from "@/components/pick/TasteTrainer";
import GenrePreferences from "@/components/pick/GenrePreferences";
import CinemaAvatar from "@/components/pick/CinemaAvatar";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import profileBackground from "@/assets/profile-background.png";
import squirrelHappy from "@/assets/Happy.png";
import squirrelCritique from "@/assets/Critique.png";
import squirrelExigeant from "@/assets/Exigeant.png";

const DECADE_ORDER = [1900, 1970, 1980, 1990, 2000, 2010, 2020] as const;

const DECADE_SHORT: Record<number, string> = {
  1900: "avant 70",
  1970: "70",
  1980: "80",
  1990: "90",
  2000: "2000",
  2010: "2010",
  2020: "2020+",
};

function formatDecadesSummary(decades: number[]): string | null {
  if (!decades.length) return null;
  const sorted = DECADE_ORDER.filter((d) => decades.includes(d));
  if (!sorted.length) return null;
  if (sorted.length === 1) {
    const d = sorted[0];
    if (d === 1900) return "Avant 1970";
    if (d === 2020) return "Depuis 2020";
    if (d === 2000 || d === 2010) return `Années ${d}`;
    return `Années ${DECADE_SHORT[d]}`;
  }
  const indices = sorted.map((d) => DECADE_ORDER.indexOf(d));
  const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
  if (isContiguous) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first === 1900) return last === 1970 ? "Avant 1970" : `Avant années ${DECADE_SHORT[last]}`;
    if (last === 2020) return `Depuis années ${DECADE_SHORT[first]}`;
    const start = first === 2000 || first === 2010 ? String(first) : DECADE_SHORT[first];
    const end = last === 2000 || last === 2010 ? String(last) : DECADE_SHORT[last];
    return `Années ${start}–${end}`;
  }
  return `${sorted.length} époques`;
}

const TROPHY_CATEGORIES = [
  {
    key: "recos",
    label: "Recommandations reçues",
    milestones: [
      { count: 1,    label: "Premier pick",     icon: "🎬" },
      { count: 10,   label: "Habitué",           icon: "🎞️" },
      { count: 50,   label: "Explorateur",       icon: "🎟️" },
      { count: 100,  label: "Connaisseur",       icon: "📽️" },
      { count: 250,  label: "Cinéphile",         icon: "🎦" },
      { count: 500,  label: "Critique d'art",    icon: "🏆" },
      { count: 1000, label: "Maître absolu",     icon: "👑" },
    ],
  },
  {
    key: "liked",
    label: "Films & séries likés",
    milestones: [
      { count: 3,   label: "Coup de cœur",      icon: "🍿" },
      { count: 10,  label: "Passionné",          icon: "🎟️" },
      { count: 25,  label: "Critique",           icon: "🎭" },
      { count: 50,  label: "Collectionneur",     icon: "📽️" },
      { count: 100, label: "Oracle du goût",     icon: "🌟" },
      { count: 200, label: "Légende",            icon: "🏆" },
      { count: 500, label: "Panthéon",           icon: "👑" },
    ],
  },
  {
    key: "people",
    label: "Acteurs & réalisateurs",
    milestones: [
      { count: 1,   label: "Premier favori",    icon: "🎭" },
      { count: 5,   label: "Fan",               icon: "🎬" },
      { count: 15,  label: "Fin connaisseur",   icon: "🎥" },
      { count: 30,  label: "Expert casting",    icon: "🎞️" },
      { count: 50,  label: "Talent scouter",    icon: "🌟" },
      { count: 100, label: "Maître des talents", icon: "🏆" },
      { count: 200, label: "Légende du 7e art", icon: "👑" },
    ],
  },
  {
    key: "seen",
    label: "Films lancés via Pick",
    milestones: [
      { count: 1,   label: "1er visionnage",    icon: "📺" },
      { count: 5,   label: "Soirée ciné",       icon: "🎞️" },
      { count: 15,  label: "Ciné-club",         icon: "🍿" },
      { count: 30,  label: "Cinémathèque",      icon: "🎦" },
      { count: 75,  label: "Vidéothèque",       icon: "📼" },
      { count: 150, label: "Archives Pick",     icon: "🏛️" },
      { count: 300, label: "Grand écran",       icon: "👑" },
    ],
  },
];

type TrophyMilestoneMeta = {
  count: number;
  label: string;
  icon: string;
  categoryKey: string;
  categoryLabel: string;
};

const TROPHY_TIER_LEVELS = [
  { minUnlocked: 0, title: "Curieux", subtitle: "Chaque trophée raconte une histoire" },
  { minUnlocked: 5, title: "Explorateur", subtitle: "Pick découvre ton profil" },
  { minUnlocked: 10, title: "Passionné", subtitle: "Ta collection prend forme" },
  { minUnlocked: 15, title: "Habitué", subtitle: "Tu maîtrises les codes du 7e art" },
  { minUnlocked: 20, title: "Écureuil cinéphile", subtitle: "Un écureuil qui sait ce qu'il aime" },
  { minUnlocked: 24, title: "Connaisseur", subtitle: "Plus que quelques trophées" },
  { minUnlocked: 28, title: "Légende Pick", subtitle: "Collection complète — bravo !" },
] as const;

function flattenTrophyMilestones(): TrophyMilestoneMeta[] {
  return TROPHY_CATEGORIES.flatMap((cat) =>
    cat.milestones.map((m) => ({
      ...m,
      categoryKey: cat.key,
      categoryLabel: cat.label,
    }))
  );
}

function getTrophyTier(unlocked: number): { title: string; subtitle: string } {
  let tier: (typeof TROPHY_TIER_LEVELS)[number] = TROPHY_TIER_LEVELS[0];
  for (const t of TROPHY_TIER_LEVELS) {
    if (unlocked >= t.minUnlocked) tier = t;
  }
  return { title: tier.title, subtitle: tier.subtitle };
}

function getNextTrophyHint(values: Record<string, number>): { milestone: TrophyMilestoneMeta; remaining: number } | null {
  let best: { milestone: TrophyMilestoneMeta; remaining: number } | null = null;
  for (const cat of TROPHY_CATEGORIES) {
    const value = values[cat.key] ?? 0;
    const next = cat.milestones.find((m) => value < m.count);
    if (!next) continue;
    const remaining = next.count - value;
    const milestone: TrophyMilestoneMeta = {
      ...next,
      categoryKey: cat.key,
      categoryLabel: cat.label,
    };
    if (!best || remaining < best.remaining) best = { milestone, remaining };
  }
  return best;
}

function computeDetailedConfidence(data: {
  totalRecos: number; acceptedRecos: number; likedCount: number;
  watchlistCount: number; streakCount: number; peopleEvaluated: number; genresSelected: number;
}) {
  const { totalRecos, acceptedRecos, likedCount, watchlistCount, streakCount, peopleEvaluated, genresSelected } = data;
  const totalSignals = totalRecos + likedCount + watchlistCount;
  // volumeScore : sature à ~500 signaux (sqrt(500)*1.12 ≈ 25)
  const volumeScore = Math.min(Math.sqrt(totalSignals) * 1.12, 25);
  const acceptRate = totalRecos > 0 ? acceptedRecos / totalRecos : 0;
  // acceptScore : pondéré par le volume — il faut 30 recos validées pour le score plein
  const acceptScore = Math.min(acceptRate * Math.min(totalRecos / 30, 1) * 25, 25);
  const streakScore = Math.min(streakCount * 2, 10);
  // trainingScore : sature à 80 likes (80 * 0.1875 = 15)
  const trainingScore = Math.min(likedCount * 0.1875, 15);
  // peopleScore : sature à ~56 personnes (sqrt(56)*2 ≈ 15)
  const peopleScore = Math.min(Math.sqrt(peopleEvaluated) * 2, 15);
  const genresScore = Math.min(genresSelected, 10);
  const total = Math.round(volumeScore + acceptScore + streakScore + trainingScore + peopleScore + genresScore);
  return {
    total: Math.min(total, 100),
    breakdown: [
      { label: "Données collectées",      score: Math.round(volumeScore),  max: 25, detail: `${totalSignals} interactions` },
      { label: "Taux de satisfaction",    score: Math.round(acceptScore),  max: 25, detail: totalRecos > 0 ? `${Math.round(acceptRate * 100)}% de recos validées` : "Pas encore de données" },
      { label: "Régularité",              score: Math.round(streakScore),  max: 10, detail: streakCount > 0 ? `Série de ${streakCount}` : "Commence une série" },
      { label: "Films & séries évalués",  score: Math.round(trainingScore),max: 15, detail: `${likedCount} titres évalués` },
      { label: "Acteurs & Réalisateurs",  score: Math.round(peopleScore),  max: 15, detail: peopleEvaluated > 0 ? `${peopleEvaluated} personnes évaluées` : "Entraîne tes préférences" },
      { label: "Genres favoris",          score: genresScore,              max: 10, detail: genresSelected > 0 ? `${genresSelected}/10 genres sélectionnés` : "Sélectionne tes genres" },
    ],
  };
}

const Profile = () => {
  const { user, isReady, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAdmin();

  // ── Admin seed ──
  const SEED_GENRES: { id: number | null; label: string }[] = [
    { id: null, label: "Tous les genres" },
    { id: 28, label: "Action" }, { id: 12, label: "Aventure" }, { id: 16, label: "Animation" },
    { id: 35, label: "Comédie" }, { id: 80, label: "Crime" }, { id: 99, label: "Documentaire" },
    { id: 18, label: "Drame" }, { id: 10751, label: "Famille" }, { id: 14, label: "Fantastique" },
    { id: 36, label: "Histoire" }, { id: 27, label: "Horreur" }, { id: 10402, label: "Musique" },
    { id: 9648, label: "Mystère" }, { id: 10749, label: "Romance" }, { id: 878, label: "SF" },
    { id: 53, label: "Thriller" }, { id: 10752, label: "Guerre" }, { id: 37, label: "Western" },
  ];
  const SEED_LANGUAGES = [
    { code: "fr", label: "🇫🇷 Français" }, { code: "en", label: "🇺🇸 Anglais" },
    { code: "ko", label: "🇰🇷 Coréen" }, { code: "ja", label: "🇯🇵 Japonais" },
    { code: "es", label: "🇪🇸 Espagnol" }, { code: "it", label: "🇮🇹 Italien" },
    { code: "de", label: "🇩🇪 Allemand" }, { code: "", label: "Toutes langues" },
  ];
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [seedLang, setSeedLang] = useState("fr");
  const [seedGenreId, setSeedGenreId] = useState<number | null>(null);
  const [seedPageStart, setSeedPageStart] = useState(1);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resettingProfile, setResettingProfile] = useState(false);

  const handleResetOnboarding = async () => {
    setResettingProfile(true);
    try {
      await resetProfileForOnboarding();
      setResetDialogOpen(false);
      toast({
        title: "Profil réinitialisé",
        description: "Tu vas repasser par le parcours initiatique.",
      });
      navigate("/onboarding", { replace: true });
    } catch (e) {
      console.error(e);
      toast({
        title: "Réinitialisation impossible",
        description: onboardingErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setResettingProfile(false);
    }
  };

  const fetchDbCount = async () => {
    const { count } = await supabase.from("movie_embeddings").select("*", { count: "exact", head: true });
    setDbCount(count ?? null);
  };

  const runSeed = async () => {
    setSeedRunning(true);
    setSeedLog([]);
    await fetchDbCount();
    const genresToRun = seedGenreId !== null
      ? [{ id: seedGenreId, label: SEED_GENRES.find(g => g.id === seedGenreId)?.label ?? String(seedGenreId) }]
      : SEED_GENRES.filter(g => g.id !== null) as { id: number; label: string }[];
    let totalAdded = 0;
    for (const genre of genresToRun) {
      // 3 appels de 2 pages chacun à partir de seedPageStart
      for (const offset of [0, 2, 4]) {
        const startPage = seedPageStart + offset;
        try {
          const { data } = await supabase.functions.invoke("seed-embeddings", {
            body: {
              source: "discover",
              ...(seedLang ? { originalLanguage: seedLang } : {}),
              genreId: genre.id,
              noStreamingFilter: true,
              pages: 2,
              startPage,
              batchSize: 8,
              minVoteCount: 20,
              minRating: 5,
            },
          });
          const s = data?.stats;
          const added = s?.processed ?? 0;
          const alreadyInDb = s?.already_in_db ?? 0;
          const fetched = s?.fetched ?? 0;
          const errors = s?.errors ?? 0;
          const errorSamples: Record<string, string> = s?.errorSamples ?? {};
          const errorTypes = Object.keys(errorSamples);
          totalAdded += added;
          let label: string;
          if (fetched === 0) {
            label = `${genre.label} p${startPage}: aucun film TMDB`;
          } else if (errors > 0 && added === 0) {
            const errInfo = errorTypes.length > 0
              ? `[${errorTypes[0]}] ${errorSamples[errorTypes[0]].slice(0, 60)}`
              : "erreur inconnue";
            label = `${genre.label} p${startPage}: ❌ ${errors} erreurs — ${errInfo}`;
          } else {
            label = `${genre.label} p${startPage}: +${added} nouveaux / ${alreadyInDb} déjà${errors > 0 ? ` / ${errors} err` : ""} (${fetched} TMDB)`;
          }
          setSeedLog(prev => [...prev, label]);
        } catch {
          setSeedLog(prev => [...prev, `${genre.label} p${startPage}: erreur`]);
        }
      }
    }
    await fetchDbCount();
    setSeedLog(prev => [...prev, `✅ Terminé — ${totalAdded} films ajoutés`]);
    setSeedRunning(false);
  };

  // ── Préférences ──
  const [profile, setProfile] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [excludedDecades, setExcludedDecades] = useState<number[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [matchThreshold, setMatchThreshold] = useState<number>(80);
  const [defaultMediaType, setDefaultMediaType] = useState<"both" | "movie" | "tv">("both");
  const [defaultMaxDuration, setDefaultMaxDuration] = useState<number | null>(null);
  const [recommendationCount, setRecommendationCount] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(() => searchParams.get("openPlatforms") === "1");
  const platformSectionRef = useRef<HTMLElement>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Mon Cinéma ──
  const [cinemaLoading, setCinemaLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [showDNA, setShowDNA] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);
  const [likedMovies, setLikedMovies] = useState<any[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [dnaTitle, setDnaTitle] = useState<string | null>(null);
  const [dnaLevel, setDnaLevel] = useState<string | null>(null);
  const [dnaArchetype, setDnaArchetype] = useState<string | null>(null);
  const [genreStats, setGenreStats] = useState<{ genre: string; count: number }[]>([]);
  const [movieVsSeries, setMovieVsSeries] = useState({ movies: 0, series: 0 });
  const [showConfidenceDetail, setShowConfidenceDetail] = useState(false);
  const [peopleEvaluated, setPeopleEvaluated] = useState(0);
  const [genresSelected, setGenresSelected] = useState(0);
  const [genresExcluded, setGenresExcluded] = useState(0);
  const [showGenresSheet, setShowGenresSheet] = useState(false);
  const [genresSheetTab, setGenresSheetTab] = useState<"liked" | "excluded">("liked");
  const [genresSheetSession, setGenresSheetSession] = useState(0);
  const [genresDirty, setGenresDirty] = useState(false);
  const [genresPreviewKey, setGenresPreviewKey] = useState(0);
  const genrePrefsRef = useRef<GenrePreferencesHandle>(null);
  const [showStats, setShowStats] = useState(false);
  const [showTrophies, setShowTrophies] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadProfile();
    loadCinema();
  }, [user, isReady]);

  useEffect(() => {
    if (showGenresSheet) setGenresSheetSession((s) => s + 1);
  }, [showGenresSheet]);

  useEffect(() => {
    if (searchParams.get("openPlatforms") === "1" && platformSectionRef.current) {
      setTimeout(() => platformSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleReset = () => { setShowTrainer(false); setShowDNA(false); };
    window.addEventListener("cinema-reset", handleReset);
    return () => window.removeEventListener("cinema-reset", handleReset);
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setSelectedPlatforms(data?.preferred_platforms || []);
      setSelectedDecades((data as any)?.preferred_decades || []);
      setExcludedDecades((data as any)?.excluded_decades || []);
      setMinRating((data as any)?.min_rating || 5);
      setMatchThreshold((data as any)?.match_threshold ?? 80);
      setDefaultMediaType(((data as any)?.default_media_type as any) || "both");
      setDefaultMaxDuration((data as any)?.default_max_duration ?? null);
      setDisplayName(data?.display_name || user.email?.split("@")[0] || "");
      setAvatarUrl((data as any)?.avatar_url || null);
      setRecommendationCount(Math.min((data as any)?.default_recommendation_count ?? 3, 3));
    } catch (e) { console.error(e); }
    finally { setProfileLoading(false); }
  };

  const loadCinema = async () => {
    if (!user) return;
    setCinemaLoading(true);
    try {
      const [engData, likedData, dnaData, { count: wlCount }, { count: peopleCount }, myPrefs, { count: seenCnt }] = await Promise.all([
        getEngagementData(user.id),
        getLikedMovies().catch(() => []),
        supabase.from("cinematic_profiles" as any).select("personality_title, dna_archetype, global_level").eq("user_id", user.id).maybeSingle(),
        supabase.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_people_preferences" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
        getMyPreferences().catch(() => []),
        supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feedback_type", "seen"),
      ]);
      setEngagement(engData);
      setLikedMovies(likedData);
      setWatchlistCount(wlCount || 0);
      setPeopleEvaluated(peopleCount || 0);
      setSeenCount(seenCnt || 0);
      setGenresSelected(myPrefs.filter((p) => p.tag.category === "genre" && p.weight > 0).length);
      setGenresExcluded(myPrefs.filter((p) => p.tag.category === "genre" && p.weight < 0).length);
      if (dnaData.data) {
        const d = dnaData.data as any;
        setDnaTitle(d.personality_title || null);
        setDnaLevel(d.global_level || null);
        setDnaArchetype(d.dna_archetype || null);
      }
      const genreCounts: Record<string, number> = {};
      let movies = 0, series = 0;
      likedData.forEach((m: any) => {
        (m.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (m.media_type === "tv" || m.first_air_date) series++; else movies++;
      });
      setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })));
      setMovieVsSeries({ movies, series });
    } catch (e) { console.error(e); }
    finally { setCinemaLoading(false); }
  };

  const radarData = useMemo(() => {
    if (genreStats.length === 0) return [];
    const top = genreStats.slice(0, 8);
    const max = top[0]?.count || 1;
    return top.map(gs => ({
      genre: gs.genre.length > 10 ? gs.genre.slice(0, 9) + "…" : gs.genre,
      fullGenre: gs.genre,
      value: Math.round((gs.count / max) * 100),
      count: gs.count,
    }));
  }, [genreStats]);

  const confidence = useMemo(() => {
    if (!engagement) return null;
    return computeDetailedConfidence({
      totalRecos: engagement.totalRecommendations,
      acceptedRecos: engagement.acceptedRecommendations,
      likedCount: likedMovies.length,
      watchlistCount,
      streakCount: engagement.streakCount,
      peopleEvaluated,
      genresSelected,
    });
  }, [engagement, likedMovies.length, watchlistCount, peopleEvaluated, genresSelected]);

  const profileSummaryParts = useMemo(() => {
    const parts: string[] = [];
    if (confidence) {
      const total = confidence.total;
      const label =
        total < 20 ? "Apprentissage"
        : total < 45 ? "En progression"
        : total < 70 ? "Bien calibré"
        : total < 90 ? "Très précis"
        : "Expert";
      parts.push(label);
    }
    const decadesLabel = formatDecadesSummary(selectedDecades);
    if (decadesLabel) parts.push(decadesLabel);
    if (selectedPlatforms.length > 0) {
      parts.push(`${selectedPlatforms.length} plateforme${selectedPlatforms.length > 1 ? "s" : ""}`);
    }
    return parts;
  }, [confidence, selectedDecades, selectedPlatforms.length]);

  const togglePlatform = (id: number) => setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() } as any).eq("id", user.id);
    if (!error) { setProfile((prev: any) => ({ ...prev, display_name: displayName.trim() })); setEditingName(false); toast({ title: "Pseudo mis à jour" }); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Image trop lourde", description: "Maximum 5 Mo", variant: "destructive" }); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("id", user.id);
      setAvatarUrl(publicUrl); setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast({ title: "Photo de profil mise à jour" });
    } catch (err) { console.error(err); toast({ title: "Erreur lors de l'upload", variant: "destructive" }); }
    finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        preferred_platforms: selectedPlatforms,
        excluded_platforms: [],
        preferred_decades: selectedDecades,
        excluded_decades: excludedDecades,
        min_rating: minRating,
        match_threshold: matchThreshold,
        default_media_type: defaultMediaType,
        default_max_duration: defaultMaxDuration,
        default_recommendation_count: recommendationCount,
      } as any).eq("id", user.id);
      if (error) throw error;
      try {
        const { setLikedPlatforms, setSinglePreference } = await import("@/lib/preferences");
        const ratingKey = minRating >= 8 ? "excellent" : minRating >= 7 ? "great" : minRating >= 6 ? "good" : "any";
        const durationKey = defaultMaxDuration == null ? "any" : defaultMaxDuration <= 90 ? "short" : defaultMaxDuration <= 120 ? "medium" : "long";
        await Promise.all([
          setLikedPlatforms(selectedPlatforms, "explicit"),
          setSinglePreference("media_type", defaultMediaType || "both", "explicit"),
          setSinglePreference("rating_threshold", ratingKey, "explicit"),
          setSinglePreference("duration", durationKey, "explicit"),
        ]);
      } catch (e) { console.warn("preferences mirror failed", e); }
      await genrePrefsRef.current?.save();
      setProfile((prev: any) => ({
        ...prev,
        preferred_platforms: [...selectedPlatforms],
        preferred_decades: [...selectedDecades],
        excluded_decades: [...excludedDecades],
        min_rating: minRating,
        match_threshold: matchThreshold,
        default_media_type: defaultMediaType,
        default_max_duration: defaultMaxDuration,
        default_recommendation_count: recommendationCount,
      }));
      setGenresDirty(false);
      setGenresPreviewKey((k) => k + 1);
      toast({ title: "Préférences enregistrées" });
    } catch (e) { console.error(e); toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const hasProfileFieldChanges = profile && (
    JSON.stringify([...selectedPlatforms].sort()) !== JSON.stringify([...(profile.preferred_platforms || [])].sort()) ||
    JSON.stringify([...selectedDecades].sort((a, b) => a - b)) !== JSON.stringify([...((profile as any)?.preferred_decades || [])].sort((a: number, b: number) => a - b)) ||
    JSON.stringify([...excludedDecades].sort((a, b) => a - b)) !== JSON.stringify([...((profile as any)?.excluded_decades || [])].sort((a: number, b: number) => a - b)) ||
    minRating !== ((profile as any)?.min_rating || 0) ||
    matchThreshold !== ((profile as any)?.match_threshold ?? 80) ||
    defaultMediaType !== ((profile as any)?.default_media_type || "both") ||
    defaultMaxDuration !== ((profile as any)?.default_max_duration ?? null) ||
    recommendationCount !== ((profile as any)?.default_recommendation_count ?? 3)
  );
  const hasChanges = Boolean(hasProfileFieldChanges || genresDirty);

  if (!isReady || profileLoading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
  if (!user) return null;

  const nameDisplay = displayName || user.email?.split("@")[0] || "Cinéphile";
  const initials = nameDisplay.slice(0, 2).toUpperCase();

  const totalRecos = engagement?.totalRecommendations || 0;
  const trophyValues: Record<string, number> = {
    recos: totalRecos,
    liked: likedMovies.length,
    people: peopleEvaluated,
    seen: seenCount,
  };
  const confidenceTotal = confidence?.total || 0;
  const confidenceLabel = confidenceTotal < 20 ? "Apprentissage" : confidenceTotal < 45 ? "En progression" : confidenceTotal < 70 ? "Bien calibré" : confidenceTotal < 90 ? "Très précis" : "Expert";
  const confidenceColor = confidenceTotal < 20 ? "text-foreground/40" : confidenceTotal < 45 ? "text-yellow-500/70" : confidenceTotal < 70 ? "text-primary/70" : "text-primary";

  // ── Overlays plein écran ──
  if (showDNA) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto scrollbar-dark z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowDNA(false)} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="font-serif text-lg">Profil</span>
          </button>
        </div>
        <CinemaDNA userId={user.id} />
      </div>
    );
  }

  if (showTrainer) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto scrollbar-dark z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowTrainer(false)} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="font-serif text-lg">Profil</span>
          </button>
        </div>
        <div className="p-5"><TasteTrainer onClose={() => { setShowTrainer(false); loadCinema(); }} /></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto scrollbar-dark">
      <div
        className="fixed inset-x-0 top-0 h-[80%] bg-cover bg-top bg-no-repeat pointer-events-none scale-[1.02] blur-[3px]"
        style={{
          backgroundImage: `url(${profileBackground})`,
          maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          opacity: 0.5,
        }}
      />
      <div
        className="fixed inset-x-0 top-0 h-[72%] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, hsl(22 35% 6% / 0.72) 0%, hsl(18 30% 8% / 0.45) 45%, transparent 100%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background)/0.35) 55%, hsl(var(--background)/0.92) 85%, hsl(var(--background)) 100%)",
        }}
      />
      <div className="max-w-lg mx-auto px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-32 space-y-10">

        {/* ════════════════════════════════
            1. IDENTITÉ
        ════════════════════════════════ */}
        <section>
          {/* Avatar + nom */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-5">
            <label className="relative cursor-pointer group shrink-0">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt={nameDisplay} className="w-full h-full object-cover" />
                  : <span className="text-lg font-serif font-bold text-primary">{initials}</span>}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-card border border-border/30 flex items-center justify-center">
                {uploadingAvatar ? <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" /> : <Camera className="w-2.5 h-2.5 text-foreground/40" />}
              </div>
            </label>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="h-9 text-base font-serif bg-card border-border/20" placeholder="Ton pseudo" maxLength={30} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }} />
                  <Button size="sm" onClick={handleSaveName} className="h-9 px-3"><Check className="w-4 h-4" /></Button>
                </div>
              ) : (
                <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-serif text-white font-bold">{nameDisplay}</h1>
                  <Pencil className="w-3 h-3 text-foreground/40 group-hover:text-foreground/50 transition-colors" />
                </button>
              )}
              {profileSummaryParts.length > 0 && (
                <p className="text-foreground/65 text-[12px] font-sans mt-0.5 leading-snug">
                  {profileSummaryParts.join(" · ")}
                </p>
              )}
              <p className="text-foreground/40 text-[11px] font-sans mt-0.5">{user.email}</p>
            </div>
          </motion.div>

          {/* Carte ADN Cinéma → nouvelle page dédiée */}
          <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            onClick={() => navigate("/app/adn")}
            className="w-full text-left rounded-2xl p-4 border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.03] hover:border-primary/30 transition-all group relative overflow-hidden active:scale-[0.98]">
            {/* Halo arrière */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.2), transparent 70%)", filter: "blur(20px)" }} />
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary/40 font-sans font-semibold mb-1.5">Mon ADN Cinéma</p>
                {dnaTitle ? (
                  <>
                    <h2 className="text-lg font-serif mb-0.5 group-hover:text-primary/90 transition-colors leading-tight">{dnaTitle}</h2>
                    {dnaArchetype && dnaArchetype !== dnaTitle && <p className="text-primary/50 text-xs font-sans mb-1">{dnaArchetype}</p>}
                    {dnaLevel && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/60 font-sans">{dnaLevel}</span>}
                  </>
                ) : (
                  <h2 className="text-sm font-serif text-foreground/50">Découvre ton profil cinématographique</h2>
                )}
                <div className="flex items-center gap-1 mt-2 text-primary/30 group-hover:text-primary/50 transition-colors">
                  <span className="text-[11px] font-sans">Voir mon profil complet</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
              {dnaTitle && (
                <div className="shrink-0 rounded-full overflow-hidden shadow-[0_0_20px_rgba(139,92,246,0.3)] ring-1 ring-white/10">
                  <CinemaAvatar personalityTitle={dnaTitle} dnaArchetype={dnaArchetype} globalLevel={dnaLevel ?? ""} size={56} />
                </div>
              )}
            </div>
          </motion.button>
        </section>

        {/* ════════════════════════════════
            2. MON PROFIL CINÉPHILE
        ════════════════════════════════ */}
        <section className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-3.5 h-3.5 text-primary/30" />
            <h2 className="text-xs font-sans font-semibold text-foreground uppercase tracking-widest">Mon profil cinéphile</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "Je suis ouvert",    img: squirrelHappy,    value: 5 },
              { label: "Je suis sélectif",  img: squirrelCritique, value: 6 },
              { label: "Je suis intraitable",  img: squirrelExigeant, value: 7 },
            ] as const).map(opt => {
              const active = opt.value === 5 ? minRating <= 5 : opt.value === 7 ? minRating >= 7 : minRating === 6;
              return (
                <button
                  key={opt.value}
                  onClick={() => setMinRating(opt.value)}
                  className={`relative overflow-hidden rounded-xl border transition-all aspect-square ${
                    active
                      ? "border-primary/60 ring-2 ring-primary/30 opacity-100"
                      : "border-border/20 opacity-40 hover:opacity-60"
                  }`}
                >
                  <img src={opt.img} alt={opt.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className={`absolute bottom-1.5 inset-x-1 font-sans text-[11px] font-semibold leading-tight text-center ${active ? "text-white" : "text-white/70"}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ════════════════════════════════
            3. MON CINÉMA
        ════════════════════════════════ */}
        <section>
          <h2 className="text-sm font-sans font-semibold text-foreground uppercase tracking-widest mb-4">Mon Cinéma</h2>

          {cinemaLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary/30 animate-spin" /></div>
          ) : (
            <div className="space-y-5">

              {/* Niveau de personnalisation */}
              {confidence && (
                <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-primary/30" />
                    <span className="text-xs font-sans font-semibold text-foreground uppercase tracking-widest">Niveau de personnalisation</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-foreground/15 hover:text-foreground/45 transition-colors"><Info className="w-3 h-3" /></button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                          <p>Ce score reflète à quel point Pick te connaît. Plus tu interagis (recos, likes, watchlist, training), plus les suggestions sont personnalisées.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className={`text-3xl font-serif font-bold tabular-nums ${confidenceColor}`}>{confidenceTotal}</span>
                      <span className="text-foreground/40 text-sm font-sans">/100</span>
                    </div>
                    <span className={`text-xs font-sans font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
                  </div>
                  <div className="h-2 rounded-full bg-foreground/[0.04] overflow-hidden mb-4">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${confidenceTotal}%` }}
                      transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-primary/30 via-primary/60 to-primary" />
                  </div>
                  <button onClick={() => setShowConfidenceDetail(!showConfidenceDetail)}
                    className="text-[11px] font-sans text-primary/40 hover:text-primary/60 transition-colors mb-1">
                    {showConfidenceDetail ? "Masquer le détail" : "Comment c'est calculé ?"}
                  </button>
                  {showConfidenceDetail && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden mt-3 space-y-2.5">
                      {confidence.breakdown.map((item, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-sans text-foreground/40">{item.label}</span>
                            <span className="text-[11px] font-sans text-foreground/45 tabular-nums">{item.score}/{item.max}</span>
                          </div>
                          <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(item.score / item.max) * 100}%` }}
                              transition={{ delay: 0.4 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full bg-primary/40" />
                          </div>
                          <p className="text-[9px] font-sans text-foreground/40 mt-0.5">{item.detail}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                  <button onClick={() => setShowTrainer(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-4 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors active:scale-[0.98]">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary text-[12px] font-sans font-semibold">Entraîner mes goûts</span>
                  </button>
                </div>
              )}

              {/* Radar genres */}
              {radarData.length >= 3 && (
                <div>
                  <p className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest mb-2">Empreinte cinématographique</p>
                  <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-2 pt-4">
                    <ResponsiveContainer width="100%" height={230}>
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                        <PolarGrid stroke="hsl(var(--foreground) / 0.06)" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="genre"
                          tick={{ fill: "hsl(var(--foreground) / 0.4)", fontSize: 10, fontFamily: "var(--font-sans)" }}
                          tickLine={false} />
                        <Radar name="Genres" dataKey="value"
                          stroke="hsl(var(--primary) / 0.7)" fill="hsl(var(--primary) / 0.15)"
                          strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          )}
        </section>

        {/* ════════════════════════════════
            3. MES PRÉFÉRENCES
        ════════════════════════════════ */}
        <section className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary/30" />
            <h2 className="text-xs font-sans font-semibold text-foreground uppercase tracking-widest">Mes préférences</h2>
          </div>

          {/* Genres & Styles */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest">Genres & styles</span>
              <button
                type="button"
                onClick={() => setShowGenresSheet(true)}
                className="text-[11px] font-sans font-medium text-primary/70 hover:text-primary transition-colors"
              >
                Tout gérer
              </button>
            </div>
            <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 px-4 py-3 space-y-2.5">
              <p className="text-[11px] font-sans text-foreground/50">
                {genresSelected > 0 && (
                  <span className="text-primary/70">{genresSelected} aimé{genresSelected > 1 ? "s" : ""}</span>
                )}
                {genresSelected > 0 && genresExcluded > 0 && " · "}
                {genresExcluded > 0 && (
                  <span className="text-destructive/70">{genresExcluded} exclu{genresExcluded > 1 ? "s" : ""}</span>
                )}
                {genresSelected === 0 && genresExcluded === 0 && "Aucun genre configuré"}
              </p>
              <GenrePreferences
                key={`preview-${genresPreviewKey}-${genresSelected}-${genresExcluded}`}
                mode="preview"
                previewLimit={4}
                readOnly
                onCountChange={setGenresSelected}
                onRejectedCountChange={setGenresExcluded}
              />
            </div>
          </div>

          {/* Époques */}
          <div className="mb-5">
            <span className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest mb-2 block">
              Époques
            </span>
            <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 px-4 py-3">
              <p className="text-[11px] font-sans text-foreground/50 mb-3">
                1 clic = préférée ✓ &nbsp;·&nbsp; 2 clics = exclue ✕ &nbsp;·&nbsp; 3 clics = neutre
              </p>
              <div className="flex flex-wrap gap-2">
                {([
                  { label: "Avant 1970", value: 1900 },
                  { label: "Années 70", value: 1970 },
                  { label: "Années 80", value: 1980 },
                  { label: "Années 90", value: 1990 },
                  { label: "Années 2000", value: 2000 },
                  { label: "Années 2010", value: 2010 },
                  { label: "Depuis 2020", value: 2020 },
                ] as const).map((d) => {
                  const preferred = selectedDecades.includes(d.value);
                  const excluded = excludedDecades.includes(d.value);
                  const state = preferred ? "preferred" : excluded ? "excluded" : "neutral";
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        if (state === "neutral") {
                          setSelectedDecades((p) => [...p, d.value]);
                        } else if (state === "preferred") {
                          setSelectedDecades((p) => p.filter((x) => x !== d.value));
                          setExcludedDecades((p) => [...p, d.value]);
                        } else {
                          setExcludedDecades((p) => p.filter((x) => x !== d.value));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all active:scale-[0.97] ${
                        state === "preferred"
                          ? "bg-primary/15 border-primary/50 text-primary"
                          : state === "excluded"
                          ? "bg-red-500/10 border-red-500/40 text-red-400"
                          : "bg-card/50 border-border/20 text-foreground/50 hover:border-primary/30 hover:text-foreground/70"
                      }`}
                    >
                      {state === "preferred" ? "✓ " : state === "excluded" ? "✕ " : ""}
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ProfilePreferences (seuil, type média, durée) */}
          <ProfilePreferences
            matchThreshold={matchThreshold}
            onMatchThresholdChange={setMatchThreshold}
            mediaType={defaultMediaType}
            onMediaTypeChange={setDefaultMediaType}
            maxDuration={defaultMaxDuration}
            onMaxDurationChange={setDefaultMaxDuration}
          />

          {/* Nombre de recommandations */}
          <div className="bg-card rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans text-sm font-medium">{recommendationCount} proposition{recommendationCount > 1 ? "s" : ""}</span>
              <span className="text-[10px] text-foreground/50">1 à 3</span>
            </div>
            <Slider value={[recommendationCount]} onValueChange={([value]) => setRecommendationCount(value)} min={1} max={3} step={1} className="w-full" />
            <p className="text-[11px] text-foreground/50 mt-3">Combien de recommandations Pick te propose par défaut.</p>
          </div>

          {/* Plateformes */}
          <motion.section ref={platformSectionRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <button onClick={() => setShowPlatforms((v) => !v)} className="w-full flex items-center justify-between mb-3 group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest">Plateformes</span>
                {selectedPlatforms.length > 0 && (
                  <span className="text-[9px] font-sans px-1.5 py-0.5 rounded-full bg-primary/15 text-primary/70 border border-primary/20">
                    {selectedPlatforms.length} sélectionnée{selectedPlatforms.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-foreground/45 transition-transform duration-200 ${showPlatforms ? "rotate-180" : ""}`} />
            </button>
            {!showPlatforms && (
              <div className="flex flex-wrap gap-1.5">
                {selectedPlatforms.length === 0
                  ? <span className="text-foreground/40 text-[10px] font-sans">Toutes les plateformes</span>
                  : ALL_PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((p) => (
                      <img key={p.id} src={p.logo} alt={p.label} className="w-7 h-7 rounded-lg object-cover opacity-80" />
                    ))}
              </div>
            )}
            <AnimatePresence initial={false}>
              {showPlatforms && (
                <motion.div key="platforms-grid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {ALL_PLATFORMS.map((p) => {
                      const on = selectedPlatforms.includes(p.id);
                      return (
                        <button key={p.id} onClick={() => togglePlatform(p.id)}
                          className={`relative bg-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all active:scale-[0.96] border ${on ? "border-primary/50 bg-primary/5" : "border-transparent hover:border-border/30"}`}>
                          {on && <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center"><Check className="w-2 h-2 text-primary-foreground" /></div>}
                          <img src={p.logo} alt={p.label} className="w-7 h-7 rounded-lg object-cover" />
                          <span className="font-sans text-[9px] text-foreground/60 leading-tight text-center">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-foreground/40 text-[10px] font-sans mt-2">Aucune sélection = toutes les plateformes</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

        </section>

        {/* ════════════════════════════════
            4. STATISTIQUES & TROPHÉES
        ════════════════════════════════ */}
        {!cinemaLoading && (
          <section className="space-y-5">

            {/* Statistiques */}
            <div>
              <button onClick={() => setShowStats((v) => !v)} className="w-full flex items-center justify-between mb-3 group">
                <span className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest">Statistiques</span>
                <ChevronDown className={`w-3.5 h-3.5 text-foreground/45 transition-transform duration-200 ${showStats ? "rotate-180" : ""}`} />
              </button>
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 overflow-hidden divide-y divide-border/5">
                {[
                  { icon: <Eye className="w-3.5 h-3.5 text-primary/40" />,        label: "Recommandations reçues",   value: totalRecos },
                  { icon: <Heart className="w-3.5 h-3.5 text-destructive/40" />,  label: "Films évalués / likés",    value: likedMovies.length },
                  { icon: <Bookmark className="w-3.5 h-3.5 text-primary/40" />,   label: "En watchlist",             value: watchlistCount },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">{row.icon}<span className="text-sm font-sans text-foreground/60">{row.label}</span></div>
                    <span className="text-sm font-sans font-semibold text-foreground tabular-nums">{row.value}</span>
                  </div>
                ))}
                <AnimatePresence initial={false}>
                  {showStats && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden divide-y divide-border/5">
                      {[
                        { icon: <Film className="w-3.5 h-3.5 text-primary/40" />,      label: "Films",                          value: movieVsSeries.movies },
                        { icon: <Tv className="w-3.5 h-3.5 text-primary/40" />,         label: "Séries",                         value: movieVsSeries.series },
                        { icon: <Users className="w-3.5 h-3.5 text-primary/40" />,      label: "Acteurs & réalisateurs évalués", value: peopleEvaluated },
                        { icon: <TrendingUp className="w-3.5 h-3.5 text-primary/40" />, label: "Meilleure série",                value: `${engagement?.bestStreak || 0} d'affilée` },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2.5">{row.icon}<span className="text-sm font-sans text-foreground/60">{row.label}</span></div>
                          <span className="text-sm font-sans font-semibold text-foreground tabular-nums">{row.value}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Trophées */}
            {(() => {
              const allMilestones = flattenTrophyMilestones();
              const totalUnlocked = allMilestones.filter(
                (m) => (trophyValues[m.categoryKey] ?? 0) >= m.count
              ).length;
              const totalMilestones = allMilestones.length;
              const progressPct = totalMilestones > 0 ? (totalUnlocked / totalMilestones) * 100 : 0;
              const tier = getTrophyTier(totalUnlocked);
              const nextHint = getNextTrophyHint(trophyValues);
              return (
                <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/15 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                        <span className="text-[10px] font-sans font-semibold text-foreground uppercase tracking-widest">Trophées</span>
                      </div>
                      <h3 className="text-base font-serif text-foreground leading-tight">{tier.title}</h3>
                      <p className="text-[11px] font-sans text-foreground/50 mt-0.5 leading-snug">{tier.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0 pt-0.5">
                      <span className="text-2xl font-serif font-bold text-primary tabular-nums">{totalUnlocked}</span>
                      <span className="text-[11px] font-sans text-foreground/40 tabular-nums">/{totalMilestones}</span>
                    </div>
                  </div>

                  <div className="h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden mb-4">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500/40 via-primary/60 to-primary"
                    />
                  </div>

                  <TooltipProvider delayDuration={200}>
                    <div className="grid grid-cols-7 gap-1.5 mb-3">
                      {allMilestones.map((m) => {
                        const reached = (trophyValues[m.categoryKey] ?? 0) >= m.count;
                        return (
                          <Tooltip key={`${m.categoryKey}-${m.count}`}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={`aspect-square flex items-center justify-center rounded-lg border text-base leading-none transition-all active:scale-95 ${
                                  reached
                                    ? "bg-primary/10 border-primary/25 shadow-[0_0_10px_rgba(139,92,246,0.12)]"
                                    : "bg-card/40 border-border/10 opacity-35 grayscale"
                                }`}
                              >
                                {m.icon}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-center">
                              <p className="font-semibold">{reached ? m.label : "À débloquer"}</p>
                              <p className="text-[10px] opacity-80 mt-0.5">{m.categoryLabel}</p>
                              {!reached && (
                                <p className="text-[10px] opacity-70 mt-0.5 tabular-nums">
                                  {m.count - (trophyValues[m.categoryKey] ?? 0)} restant{m.count - (trophyValues[m.categoryKey] ?? 0) > 1 ? "s" : ""}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>

                  {nextHint && (
                    <p className="text-[11px] font-sans text-foreground/50 text-center leading-snug px-1">
                      Prochain trophée :{" "}
                      <span className="text-foreground/70">{nextHint.milestone.icon} {nextHint.milestone.label}</span>
                      {" "}— encore{" "}
                      <span className="text-primary/70 font-medium tabular-nums">{nextHint.remaining}</span>
                      {" "}({nextHint.milestone.categoryLabel.toLowerCase()})
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowTrophies((v) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-border/10 text-[11px] font-sans text-primary/50 hover:text-primary/70 transition-colors"
                  >
                    {showTrophies ? "Masquer le détail" : "Voir par catégorie"}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showTrophies ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {showTrophies && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-5 pt-4">
                          {TROPHY_CATEGORIES.map((cat) => {
                            const value = trophyValues[cat.key] ?? 0;
                            const nextM = cat.milestones.find((m) => value < m.count);
                            const unlockedCount = cat.milestones.filter((m) => value >= m.count).length;
                            const catProgress = cat.milestones.length > 0 ? (unlockedCount / cat.milestones.length) * 100 : 0;
                            return (
                              <div key={cat.key}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-sans font-semibold text-foreground/50 uppercase tracking-widest">{cat.label}</p>
                                  <span className="text-[10px] font-sans text-primary/50 tabular-nums">{unlockedCount}/{cat.milestones.length}</span>
                                </div>
                                <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden mb-2.5">
                                  <div className="h-full rounded-full bg-primary/35 transition-all" style={{ width: `${catProgress}%` }} />
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {cat.milestones.map((m) => {
                                    const reached = value >= m.count;
                                    return (
                                      <div
                                        key={m.count}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                                          reached
                                            ? "bg-primary/[0.06] border-primary/20 shadow-[0_0_12px_rgba(139,92,246,0.08)]"
                                            : "bg-card/50 border-border/15 opacity-60"
                                        }`}
                                      >
                                        <span className={`text-xl leading-none ${reached ? "" : "grayscale opacity-40"}`}>{m.icon}</span>
                                        <span className={`text-[8px] font-sans text-center leading-tight mt-0.5 ${reached ? "text-foreground/60" : "text-foreground/25"}`}>
                                          {reached ? m.label : m.label}
                                        </span>
                                        <span className={`text-[7px] font-sans tabular-nums ${reached ? "text-primary/50" : "text-foreground/20"}`}>{m.count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {nextM && (
                                  <p className="text-foreground/45 text-[10px] font-sans mt-2 text-center">
                                    Plus que <span className="text-primary/60 font-medium tabular-nums">{nextM.count - value}</span> pour « {nextM.label} »
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}

          </section>
        )}

        {/* ════════════════════════════════
            5. COMPTE
        ════════════════════════════════ */}
        <section>
          <h2 className="text-sm font-sans font-semibold text-foreground uppercase tracking-widest mb-3">Compte</h2>
          <div className="flex flex-col gap-1 border-t border-border/5 pt-3">
            {isAdmin && (
              <Accordion type="single" collapsible className="mb-2">
                <AccordionItem value="advanced" className="border-border/10">
                  <AccordionTrigger className="py-3 text-xs font-sans font-semibold text-foreground/50 uppercase tracking-widest hover:no-underline hover:text-foreground/70">
                    Avancé
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" onClick={() => navigate("/admin")} className="justify-start text-primary/50 hover:text-primary text-xs font-sans gap-2 h-10 px-0">
                        <Shield className="w-3.5 h-3.5" /> Administration
                      </Button>
                      <div className="p-3 rounded-xl border border-border/20 bg-foreground/[0.02] flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-sans font-semibold text-foreground/60">Base de films</span>
                          <button onClick={fetchDbCount} className="text-xs text-primary/60 hover:text-primary font-sans">
                            {dbCount !== null ? `${dbCount.toLocaleString("fr-FR")} films` : "Charger le compteur"}
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-sans text-foreground/40 uppercase tracking-wide">Langue d&apos;origine</span>
                          <select
                            value={seedLang}
                            onChange={e => setSeedLang(e.target.value)}
                            disabled={seedRunning}
                            className="w-full text-xs font-sans bg-background border border-border/30 rounded-md px-2 py-1 text-foreground/80 disabled:opacity-50"
                          >
                            {SEED_LANGUAGES.map(l => (
                              <option key={l.code} value={l.code}>{l.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-sans text-foreground/40 uppercase tracking-wide">Genre</span>
                          <select
                            value={seedGenreId === null ? "" : String(seedGenreId)}
                            onChange={e => setSeedGenreId(e.target.value === "" ? null : Number(e.target.value))}
                            disabled={seedRunning}
                            className="w-full text-xs font-sans bg-background border border-border/30 rounded-md px-2 py-1 text-foreground/80 disabled:opacity-50"
                          >
                            {SEED_GENRES.map(g => (
                              <option key={g.id ?? "all"} value={g.id === null ? "" : String(g.id)}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-sans text-foreground/40 uppercase tracking-wide">Pages TMDB (départ)</span>
                          <select
                            value={seedPageStart}
                            onChange={e => setSeedPageStart(Number(e.target.value))}
                            disabled={seedRunning}
                            className="w-full text-xs font-sans bg-background border border-border/30 rounded-md px-2 py-1 text-foreground/80 disabled:opacity-50"
                          >
                            <option value={1}>Pages 1–6 (les plus populaires)</option>
                            <option value={7}>Pages 7–12</option>
                            <option value={13}>Pages 13–18</option>
                            <option value={19}>Pages 19–24</option>
                            <option value={25}>Pages 25–30</option>
                            <option value={31}>Pages 31–36</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={seedRunning}
                            onClick={async () => {
                              setSeedRunning(true);
                              setSeedLog(["🔍 Test de la clé Gemini en cours…"]);
                              try {
                                const { data } = await supabase.functions.invoke("seed-embeddings", { body: { mode: "testGemini" } });
                                if (data?.availableModels) {
                                  setSeedLog([`✅ Clé OK — modèles : ${(data.availableModels as string[]).join(", ")}`]);
                                } else if (data?.success === false || data?.geminiStatus) {
                                  setSeedLog([`❌ Gemini inaccessible — ${data?.geminiStatus} : ${data?.geminiError}`]);
                                } else {
                                  setSeedLog([`⚠️ Edge function non mise à jour — réponse reçue : ${JSON.stringify(data).slice(0, 120)}`]);
                                }
                              } catch (e) {
                                setSeedLog([`❌ Timeout ou erreur réseau : ${String(e).slice(0, 80)}`]);
                              } finally {
                                setSeedRunning(false);
                              }
                            }}
                            className="flex-1 text-xs font-sans gap-1 h-8"
                          >
                            {seedRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : "🔍 Tester Gemini"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={seedRunning}
                            onClick={runSeed}
                            className="flex-1 text-xs font-sans gap-2 h-8"
                          >
                            {seedRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> En cours…</> : "▶ Seed"}
                          </Button>
                        </div>
                        {seedLog.length > 0 && (
                          <div className="mt-1 max-h-40 overflow-y-auto flex flex-col gap-0.5">
                            {seedLog.map((line, i) => (
                              <p key={i} className="text-[10px] font-mono text-foreground/50">{line}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <Button
              variant="ghost"
              onClick={() => setResetDialogOpen(true)}
              className="justify-start text-foreground/45 hover:text-destructive text-xs font-sans gap-2 h-10"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser mon parcours initiatique
            </Button>
            <Button variant="ghost" onClick={async () => { await signOut(); navigate("/"); }} className="justify-start text-foreground/45 hover:text-foreground text-xs font-sans gap-2 h-10">
              <LogOut className="w-3.5 h-3.5" /> Déconnexion
            </Button>
          </div>
        </section>

      </div>

      <Sheet open={showGenresSheet} onOpenChange={setShowGenresSheet}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="font-serif text-xl">Genres & styles</SheetTitle>
            <SheetDescription className="text-xs">
              1 clic = tu aimes · 2 clics = tu n&apos;aimes pas · 3 clics = neutre
            </SheetDescription>
          </SheetHeader>
          <Tabs value={genresSheetTab} onValueChange={(v) => setGenresSheetTab(v as "liked" | "excluded")}>
            <TabsList className="w-full grid grid-cols-2 h-9 bg-foreground/5 mb-4">
              <TabsTrigger value="liked" className="text-xs font-sans data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                Aimés{genresSelected > 0 ? ` (${genresSelected})` : ""}
              </TabsTrigger>
              <TabsTrigger value="excluded" className="text-xs font-sans data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive">
                Exclus{genresExcluded > 0 ? ` (${genresExcluded})` : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <GenrePreferences
            ref={genrePrefsRef}
            deferSave
            filter={genresSheetTab}
            orderKey={showGenresSheet ? `${genresSheetSession}-${genresSheetTab}` : undefined}
            onCountChange={setGenresSelected}
            onRejectedCountChange={setGenresExcluded}
            onDirtyChange={setGenresDirty}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le parcours initiatique ?</AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <span className="block">
                Tes genres, plateformes et acteurs/réalisateurs choisis à l&apos;initiation seront effacés.
                Tu repasseras par tout le parcours (films, Solo/Duo, Soirées).
              </span>
              <span className="block text-foreground/70">
                Tes films likés, ta watchlist et ton historique ne sont pas supprimés.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingProfile}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={resettingProfile}
              onClick={(e) => {
                e.preventDefault();
                void handleResetOnboarding();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resettingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Réinitialisation…
                </>
              ) : (
                "Réinitialiser"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save bar */}
      {hasChanges && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-14 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/10 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto flex justify-end">
            <Button variant="hero" size="lg" onClick={handleSave} disabled={saving} className="rounded-full px-8">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer mes préférences"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Profile;
