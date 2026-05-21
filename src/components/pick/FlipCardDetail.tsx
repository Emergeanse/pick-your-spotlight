import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Film, User, Clapperboard, ChevronLeft, Sparkles } from "lucide-react";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { getPersonPhotoUrl, fetchPersonDetail } from "@/lib/people-preferences";
import type { Movie } from "@/lib/tmdb";
import FeedbackBadge from "@/components/pick/FeedbackBadge";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";

type MatchData = {
  matchScore?: number;
  score?: number;
  confidence?: number;
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
};

interface FlipCardDetailProps {
  item: Movie | any;
  type: "movie" | "person";
  isOpen: boolean;
  onClose: () => void;
  recommendationTexts?: MatchData | null;
  recommendationTextsByMovieId?: Record<number, MatchData | undefined>;
}

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

type NavEntry = {
  item: any;
  type: "movie" | "person";
};

const FlipCardDetail = ({
  item,
  type,
  isOpen,
  onClose,
  recommendationTexts,
  recommendationTextsByMovieId,
}: FlipCardDetailProps) => {
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [currentType, setCurrentType] = useState<"movie" | "person">(type);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setCurrentItem(item);
      setCurrentType(type);
      setNavStack([]);
      setDetail(null);
    }

    if (!isOpen) {
      setCurrentItem(null);
      setNavStack([]);
    }
  }, [isOpen, item?.id, type]);

  useEffect(() => {
    if (!isOpen || !currentItem) return;

    setLoading(true);
    setDetail(null);

    if (currentType === "movie") {
      const isTV = !!currentItem.first_air_date;
      const endpoint = isTV
        ? `https://api.themoviedb.org/3/tv/${currentItem.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`
        : `https://api.themoviedb.org/3/movie/${currentItem.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`;
      fetch(endpoint)
        .then((r) => r.json())
        .then((d) => setDetail(d))
        .finally(() => setLoading(false));
    } else {
      fetchPersonDetail(currentItem.id)
        .then((d) => setDetail(d))
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentItem?.id, currentType]);

  const navigateTo = useCallback(
    (newItem: any, newType: "movie" | "person") => {
      setNavStack((prev) => [...prev, { item: currentItem, type: currentType }]);
      setCurrentItem(newItem);
      setCurrentType(newType);
    },
    [currentItem, currentType],
  );

  const navigateBack = useCallback(() => {
    if (navStack.length === 0) {
      onClose();
      return;
    }

    const prev = navStack[navStack.length - 1];
    setNavStack((s) => s.slice(0, -1));
    setCurrentItem(prev.item);
    setCurrentType(prev.type);
  }, [navStack, onClose]);

  const currentRecommendationText = useMemo(() => {
    if (currentType !== "movie" || !currentItem?.id) return null;
    return recommendationTextsByMovieId?.[currentItem.id] ?? recommendationTexts ?? null;
  }, [currentType, currentItem?.id, recommendationTexts, recommendationTextsByMovieId]);

  if (!isOpen || !currentItem) return null;

  const isTV = !!currentItem.first_air_date;
  const director = isTV
    ? (detail?.created_by?.[0] ?? detail?.credits?.crew?.find((c: any) => c.job === "Executive Producer"))
    : detail?.credits?.crew?.find((c: any) => c.job === "Director");
  const cast = detail?.credits?.cast?.slice(0, 6) || [];
  const filmography =
    detail?.movie_credits?.cast?.slice(0, 12) ||
    detail?.movie_credits?.crew?.filter((c: any) => c.job === "Director").slice(0, 12) ||
    [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={`${currentType}-${currentItem?.id}`}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="fixed inset-0 z-[110] flex flex-col bg-background"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-md border-b border-border/20 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
            <div className="flex-1 flex items-center">
              {navStack.length > 0 ? (
                <button
                  onClick={navigateBack}
                  className="flex items-center gap-1 text-foreground/50 hover:text-foreground text-xs font-sans transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Retour
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 text-foreground/50 hover:text-foreground text-xs font-sans transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Retour
                </button>
              )}
            </div>

            <button onClick={onClose} className="rounded-full bg-foreground/5 hover:bg-foreground/10 p-1.5 transition-colors">
              <X className="h-4 w-4 text-foreground/40" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(2rem+env(safe-area-inset-bottom))]">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
              </div>
            ) : currentType === "movie" ? (
              <MovieDetailContent
                item={currentItem}
                detail={detail}
                director={director}
                cast={cast}
                isTV={isTV}
                recommendationText={currentRecommendationText}
                onPersonClick={(person) => navigateTo(person, "person")}
              />
            ) : (
              <PersonDetailContent
                item={currentItem}
                detail={detail}
                filmography={filmography}
                onMovieClick={(movie) => navigateTo(movie, "movie")}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const MovieDetailContent = ({
  item,
  detail,
  director,
  cast,
  isTV,
  recommendationText,
  onPersonClick,
}: {
  item: any;
  detail: any;
  director: any;
  cast: any[];
  isTV?: boolean;
  recommendationText?: MatchData | null;
  onPersonClick: (person: any) => void;
}) => {
  const interaction = useMovieInteraction(item?.id);

  const summary =
    recommendationText?.summary ||
    recommendationText?.detailedExplanation ||
    recommendationText?.whyItMatches ||
    recommendationText?.pickNote ||
    null;

  const headline = recommendationText?.headline || null;
  const reasons = recommendationText?.matchingReasons || recommendationText?.reasons || [];
  const perfectFor = recommendationText?.perfectFor || null;
  const funFact = recommendationText?.funFact || null;
  const score = recommendationText?.matchScore ?? recommendationText?.score ?? recommendationText?.confidence ?? null;

  return (
    <div className="px-5 pb-8 pt-4 max-w-2xl mx-auto">
      <div className="flex gap-4 mb-5">
        <div className="relative shrink-0">
          <img
            src={getPosterUrl(item.poster_path, "w342")}
            alt={getDisplayTitle(item)}
            className="h-40 w-auto rounded-xl shadow-lg"
          />
          {interaction.hasInteraction && (
            <div className="absolute top-1.5 left-1.5">
              <FeedbackBadge
                type={interaction.primaryStatus}
                inWatchlist={interaction.watchlist}
                seen={interaction.seen}
                size="sm"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-serif font-bold leading-tight text-foreground">{getDisplayTitle(item)}</h3>

          {(detail?.release_date || detail?.first_air_date) && (
            <p className="mt-1 text-xs text-foreground/40">
              {(detail.release_date || detail.first_air_date).substring(0, 4)}
              {isTV
                ? detail?.number_of_seasons
                  ? ` • ${detail.number_of_seasons} saison${detail.number_of_seasons > 1 ? "s" : ""}`
                  : ""
                : detail?.runtime
                  ? ` • ${detail.runtime}min`
                  : ""}
            </p>
          )}

          {detail?.vote_average > 0 && (
            <p className="mt-1 text-xs text-foreground/50">
              <span className="text-primary">★</span> {detail.vote_average.toFixed(1)}/10
            </p>
          )}

          {detail?.genres && (
            <div className="mt-2 flex flex-wrap gap-1">
              {detail.genres.slice(0, 4).map((g: any) => (
                <span key={g.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary/70">
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {detail?.overview && (
        <div className="mb-5">
          <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
            Synopsis
          </h4>
          <p className="text-sm leading-relaxed text-foreground/60">{detail.overview}</p>
        </div>
      )}

      {(headline || summary || reasons.length > 0 || perfectFor || funFact) && (
        <div className="mb-5 rounded-2xl bg-primary/[0.04] border border-primary/15 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
                  Recommandation complète
                </p>
                {score != null && (
                  <span className="text-[10px] font-sans font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    {score}%
                  </span>
                )}
              </div>
              {headline && <p className="text-foreground/80 text-[13px] font-sans font-semibold mb-1">{headline}</p>}
              {summary && <p className="text-foreground/70 text-[12px] sm:text-[13px] font-sans leading-snug mb-2">{summary}</p>}
              {reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {reasons.map((reason: string, i: number) => (
                    <span
                      key={i}
                      className="text-[10px] font-sans text-primary/70 bg-primary/8 px-2 py-0.5 rounded-full border border-primary/10"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
              {perfectFor && <p className="text-foreground/50 text-[11px] font-sans italic mb-1">{perfectFor}</p>}
              {funFact && (
                <p className="text-foreground/40 text-[11px] font-sans mt-2 leading-snug">
                  <span className="text-primary/50">💡</span> {funFact}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {director && (
        <div className="mb-4">
          <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
            <Clapperboard className="inline h-3 w-3 mr-1" />
            {isTV ? "Créateur" : "Réalisateur"}
          </h4>
          <button
            onClick={() => onPersonClick({ id: director.id, name: director.name, profile_path: director.profile_path })}
            className="text-sm text-foreground/70 hover:text-primary transition-colors cursor-pointer"
          >
            {director.name} →
          </button>
        </div>
      )}

      {cast.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
            <User className="inline h-3 w-3 mr-1" />
            Casting
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {cast.map((c: any) => (
              <button
                key={c.id}
                onClick={() => onPersonClick({ id: c.id, name: c.name, profile_path: c.profile_path })}
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <img
                  src={c.profile_path ? `https://image.tmdb.org/t/p/w92${c.profile_path}` : "/placeholder.svg"}
                  alt={c.name}
                  className="h-14 w-14 rounded-full object-cover border border-border/20 group-hover:border-primary/30 transition-colors"
                />
                <span className="text-center text-[10px] text-foreground/50 leading-tight group-hover:text-primary transition-colors">
                  {c.name}
                </span>
                <span className="text-center text-[9px] text-foreground/25 leading-tight">{c.character}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PersonDetailContent = ({
  item,
  detail,
  filmography,
  onMovieClick,
}: {
  item: any;
  detail: any;
  filmography: any[];
  onMovieClick: (movie: any) => void;
}) => (
  <div className="px-5 pb-8 pt-4 max-w-2xl mx-auto">
    <div className="flex gap-4 mb-5">
      <img
        src={getPersonPhotoUrl(item.profile_path, "w185")}
        alt={item.name}
        className="h-40 w-auto rounded-xl shadow-lg object-cover"
      />
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-serif font-bold leading-tight text-foreground">{item.name}</h3>
        {detail?.known_for_department && (
          <p className="mt-1 text-xs text-foreground/40">
            {detail.known_for_department === "Acting" ? "Acteur/Actrice" : "Réalisateur/Réalisatrice"}
          </p>
        )}
        {detail?.birthday && (
          <p className="mt-0.5 text-xs text-foreground/30">
            Né(e) le {new Date(detail.birthday).toLocaleDateString("fr-FR")}
          </p>
        )}
        {detail?.place_of_birth && <p className="mt-0.5 text-xs text-foreground/25">{detail.place_of_birth}</p>}
      </div>
    </div>

    {detail?.biography && (
      <div className="mb-5">
        <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">Bio</h4>
        <p className="text-sm leading-relaxed text-foreground/60 line-clamp-6">{detail.biography}</p>
      </div>
    )}

    {filmography.length > 0 && (
      <div>
        <h4 className="mb-2 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
          <Film className="inline h-3 w-3 mr-1" />
          Filmographie
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {filmography.map((f: any) => (
            <button
              key={`${f.id}-${f.character || f.job}`}
              onClick={() => onMovieClick({ id: f.id, title: f.title, poster_path: f.poster_path })}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <img
                src={f.poster_path ? `https://image.tmdb.org/t/p/w92${f.poster_path}` : "/placeholder.svg"}
                alt={f.title}
                className="w-full aspect-[2/3] rounded-lg object-cover border border-border/20 group-hover:border-primary/30 transition-colors"
              />
              <span className="text-center text-[9px] text-foreground/50 leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {f.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default FlipCardDetail;
