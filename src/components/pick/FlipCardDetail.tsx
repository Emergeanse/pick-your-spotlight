import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Film, User, Clapperboard, ChevronLeft, Sparkles } from "lucide-react";
import { getPosterUrl, getDisplayTitle, getMovieDetailsWithCredits, getWatchProviders, type Movie } from "@/lib/tmdb";
import { buildStreamingLinks, type StreamingLink } from "@/lib/streaming-links";
import { getPersonPhotoUrl, fetchPersonDetail } from "@/lib/people-preferences";
import FeedbackBadge from "@/components/pick/FeedbackBadge";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import MovieActionBar from "@/components/pick/MovieActionBar";
import AppOverlayPortal from "@/components/pick/AppOverlayPortal";
import TmdbAttribution from "@/components/pick/TmdbAttribution";
import { overlayDetailScrollPaddingBottom } from "@/lib/app-chrome";

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
  /** Clic sur l'affiche — ex. retour au carrousel de recommandations */
  onPosterClick?: () => void;
  recommendationTexts?: MatchData | null;
  recommendationTextsByMovieId?: Record<number, MatchData | undefined>;
  isEnriching?: boolean;
  watchProviders?: { name: string; logo_path: string; provider_id?: number }[];
}

type NavEntry = {
  item: any;
  type: "movie" | "person";
};

const IMG_BASE = "https://image.tmdb.org/t/p";

const FlipCardDetail = ({
  item,
  type,
  isOpen,
  onClose,
  onPosterClick,
  recommendationTexts,
  recommendationTextsByMovieId,
  isEnriching,
  watchProviders,
}: FlipCardDetailProps) => {
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [currentType, setCurrentType] = useState<"movie" | "person">(type);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [streamingLinks, setStreamingLinks] = useState<StreamingLink[]>([]);

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
      getMovieDetailsWithCredits(currentItem.id, isTV ? "tv" : "movie")
        .then((d) => setDetail(d))
        .finally(() => setLoading(false));
    } else {
      fetchPersonDetail(currentItem.id)
        .then((d) => setDetail(d))
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentItem?.id, currentType]);

  useEffect(() => {
    if (!isOpen || currentType !== "movie" || !currentItem?.id) {
      setStreamingLinks([]);
      return;
    }

    const mediaType = currentItem.first_air_date ? "tv" : "movie";
    const title = getDisplayTitle(currentItem);
    const usePrefetched =
      watchProviders &&
      watchProviders.length > 0 &&
      currentItem.id === item?.id;

    if (usePrefetched) {
      setStreamingLinks(buildStreamingLinks(watchProviders, title));
      return;
    }

    getWatchProviders(currentItem.id, mediaType)
      .then((p) => setStreamingLinks(buildStreamingLinks(p, title)))
      .catch(() => setStreamingLinks([]));
  }, [isOpen, currentType, currentItem, item?.id, watchProviders]);

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

  const isTV = !!currentItem?.first_air_date;
  const director = isTV
    ? (detail?.created_by?.[0] ?? detail?.credits?.crew?.find((c: any) => c.job === "Executive Producer"))
    : detail?.credits?.crew?.find((c: any) => c.job === "Director");
  const cast = detail?.credits?.cast?.slice(0, 6) || [];
  const filmography =
    detail?.movie_credits?.cast?.slice(0, 12) ||
    detail?.movie_credits?.crew?.filter((c: any) => c.job === "Director").slice(0, 12) ||
    [];

  return (
    <AppOverlayPortal>
      <AnimatePresence>
        {isOpen && currentItem && (
          <motion.div
            key={`${currentType}-${currentItem.id}`}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.6 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute inset-0 z-[55] flex flex-col bg-background"
          >
          {/* Sticky top bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-md border-b border-border/15 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
            <button
              onClick={navigateBack}
              className="flex items-center gap-1.5 text-foreground/55 hover:text-foreground text-sm font-sans transition-colors px-1 py-0.5"
            >
              <ChevronLeft className="h-4 w-4" />
              {navStack.length > 0 ? "Retour" : "Fermer"}
            </button>

            <button
              onClick={onClose}
              className="rounded-full bg-foreground/8 hover:bg-foreground/12 p-2 transition-colors"
            >
              <X className="h-4 w-4 text-foreground/50" />
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto overscroll-contain scrollbar-dark"
            style={{ paddingBottom: overlayDetailScrollPaddingBottom }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="h-7 w-7 animate-spin text-primary/40" />
              </div>
            ) : currentType === "movie" ? (
              <MovieDetailContent
                item={currentItem}
                detail={detail}
                director={director}
                cast={cast}
                isTV={isTV}
                recommendationText={currentRecommendationText}
                isEnriching={isEnriching}
                streamingLinks={streamingLinks}
                onPersonClick={(person) => navigateTo(person, "person")}
                onPosterClick={navStack.length === 0 ? onPosterClick : undefined}
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
    </AppOverlayPortal>
  );
};

const MovieDetailContent = ({
  item,
  detail,
  director,
  cast,
  isTV,
  recommendationText,
  isEnriching,
  streamingLinks = [],
  onPersonClick,
  onPosterClick,
}: {
  item: any;
  detail: any;
  director: any;
  cast: any[];
  isTV?: boolean;
  recommendationText?: MatchData | null;
  isEnriching?: boolean;
  streamingLinks?: StreamingLink[];
  onPersonClick: (person: any) => void;
  onPosterClick?: () => void;
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
    <div className="pb-8 max-w-2xl mx-auto">
      {/* Hero poster + metadata — larger, more cinematic */}
      <div className="flex gap-4 px-5 pt-5 mb-5">
        <div className="relative shrink-0">
          {onPosterClick ? (
            <button
              type="button"
              onClick={onPosterClick}
              aria-label="Retour à la sélection"
              className="block rounded-2xl transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <img
                src={getPosterUrl(item.poster_path, "w342")}
                alt={getDisplayTitle(item)}
                className="h-52 w-auto rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)] border border-white/8"
              />
            </button>
          ) : (
            <img
              src={getPosterUrl(item.poster_path, "w342")}
              alt={getDisplayTitle(item)}
              className="h-52 w-auto rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)] border border-white/8"
            />
          )}
          {interaction.hasInteraction && (
            <div className="absolute top-2 left-2 pointer-events-none">
              <FeedbackBadge
                type={interaction.primaryStatus}
                inWatchlist={interaction.watchlist}
                seen={interaction.seen}
                size="sm"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <h3 className="text-xl font-serif font-bold leading-tight text-foreground mb-1.5">
            {getDisplayTitle(item)}
          </h3>

          {/* Year + runtime/seasons */}
          {(detail?.release_date || detail?.first_air_date) && (
            <p className="text-sm text-foreground/50 font-sans mb-1.5">
              {(detail.release_date || detail.first_air_date).substring(0, 4)}
              {isTV
                ? detail?.number_of_seasons
                  ? ` · ${detail.number_of_seasons} saison${detail.number_of_seasons > 1 ? "s" : ""}`
                  : ""
                : detail?.runtime
                  ? ` · ${detail.runtime} min`
                  : ""}
            </p>
          )}

          {/* TMDB rating */}
          {detail?.vote_average > 0 && (
            <p className="text-sm text-foreground/55 font-sans mb-2">
              <span className="text-yellow-400">★</span> {detail.vote_average.toFixed(1)}
              <span className="text-foreground/45">/10</span>
            </p>
          )}

          {/* Match score badge — if available */}
          {score != null && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/25 mb-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-primary text-xs font-sans font-bold">{score}% d'adhésion</span>
            </div>
          )}

          {/* Genre tags */}
          {detail?.genres && (
            <div className="flex flex-wrap gap-1">
              {detail.genres.slice(0, 4).map((g: any) => (
                <span key={g.id} className="rounded-full bg-foreground/8 px-2.5 py-0.5 text-[11px] text-foreground/55 font-sans">
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action bar — compact (~50 % footprint) */}
      <div className="mx-5 mb-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/[0.06] px-1 py-0.5">
        <MovieActionBar movie={detail || item} size="xs" />
      </div>

      {streamingLinks.length > 0 && (
        <div className="mx-5 mb-5">
          <p className="text-[10px] uppercase tracking-widest text-foreground/45 font-sans font-semibold mb-2">
            Où regarder
          </p>
          <div className="flex flex-wrap gap-2">
            {streamingLinks.map((link) => (
              <a
                key={link.providerId}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.name}
                className="opacity-80 hover:opacity-100 transition-opacity"
              >
                {link.logo_path && (
                  <img
                    src={`${IMG_BASE}/original${link.logo_path}`}
                    alt={link.name}
                    className="h-10 w-10 object-cover rounded-xl"
                  />
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border/10 mx-5 mb-5" />

      {/* AI recommendation block — visually impactful */}
      {(headline || summary || reasons.length > 0 || perfectFor || funFact || isEnriching) && (
        <div className="mx-5 mb-5 rounded-2xl bg-primary/[0.06] border border-primary/20 overflow-hidden">
          {/* Header strip */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10 bg-primary/[0.04]">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              {isEnriching && !headline ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              )}
            </div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-sans font-semibold flex-1">
              Pourquoi c'est pour toi !
            </p>
          </div>
          {/* Body */}
          <div className="px-4 py-3.5">
            {isEnriching && !headline ? (
              // Placeholder flou pendant la génération des textes
              <motion.div
                className="space-y-2 select-none pointer-events-none"
                animate={{ opacity: [0.5, 0.75, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ filter: "blur(5px)" }}
              >
                <p className="text-foreground/90 text-[14px] font-sans font-semibold leading-snug mb-2">
                  Analyse de tes goûts cinématographiques en cours…
                </p>
                <p className="text-foreground/65 text-[13px] font-sans leading-relaxed mb-2.5">
                  Pick compare tes préférences avec les caractéristiques émotionnelles et narratives de ce film pour t'expliquer pourquoi il pourrait vraiment te plaire.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {["Correspond à ton goût", "Ambiance similaire", "Bien noté"].map((tag, i) => (
                    <span key={i} className="text-[11px] font-sans text-primary/80 bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/15">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={headline ? { opacity: 0, filter: "blur(6px)" } : false}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                {headline && (
                  <p className="text-foreground/90 text-[14px] font-sans font-semibold leading-snug mb-2">{headline}</p>
                )}
                {summary && (
                  <p className="text-foreground/65 text-[13px] font-sans leading-relaxed mb-2.5">{summary}</p>
                )}
                {reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {reasons.map((reason: string, i: number) => (
                      <span
                        key={i}
                        className="text-[11px] font-sans text-primary/80 bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/15"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                {perfectFor && (
                  <p className="text-foreground/50 text-[12px] font-sans italic mb-1.5">{perfectFor}</p>
                )}
                {funFact && (
                  <p className="text-foreground/45 text-[12px] font-sans leading-snug mt-1">
                    💡 {funFact}
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Synopsis */}
      {detail?.overview && (
        <div className="px-5 mb-5">
          <h4 className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
            <span className="w-4 h-px bg-foreground/20 inline-block" />
            Synopsis
          </h4>
          <p className="text-[13px] leading-relaxed text-foreground/60">{detail.overview}</p>
        </div>
      )}

      {/* Director */}
      {director && (
        <div className="px-5 mb-4">
          <h4 className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
            <Clapperboard className="h-3 w-3" />
            {isTV ? "Créateur" : "Réalisateur"}
          </h4>
          <button
            onClick={() => onPersonClick({ id: director.id, name: director.name, profile_path: director.profile_path })}
            className="text-[13px] text-foreground/65 hover:text-primary transition-colors cursor-pointer font-sans"
          >
            {director.name} →
          </button>
        </div>
      )}

      {/* Cast grid */}
      {cast.length > 0 && (
        <div className="px-5">
          <h4 className="mb-3 text-[11px] font-sans font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
            <User className="h-3 w-3" />
            Casting
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {cast.map((c: any) => (
              <button
                key={c.id}
                onClick={() => onPersonClick({ id: c.id, name: c.name, profile_path: c.profile_path })}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <img
                  src={c.profile_path ? `https://image.tmdb.org/t/p/w92${c.profile_path}` : "/placeholder.svg"}
                  alt={c.name}
                  className="h-16 w-16 rounded-full object-cover border-2 border-border/15 group-hover:border-primary/40 transition-colors shadow-sm"
                />
                <span className="text-center text-[11px] text-foreground/55 leading-tight group-hover:text-primary transition-colors font-sans">
                  {c.name}
                </span>
                {c.character && (
                  <span className="text-center text-[10px] text-foreground/45 leading-tight font-sans">{c.character}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attribution TMDB — la fiche entière provient de leur API. */}
      <div className="px-5 pt-2">
        <TmdbAttribution compact />
      </div>
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
  <div className="pb-8 max-w-2xl mx-auto">
    {/* Hero section */}
    <div className="flex gap-4 px-5 pt-5 mb-5">
      <img
        src={getPersonPhotoUrl(item.profile_path, "w185")}
        alt={item.name}
        className="h-52 w-auto rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)] object-cover border border-white/8"
      />
      <div className="flex-1 min-w-0 pt-1">
        <h3 className="text-xl font-serif font-bold leading-tight text-foreground mb-1.5">{item.name}</h3>
        {detail?.known_for_department && (
          <p className="text-sm text-foreground/50 font-sans mb-1">
            {detail.known_for_department === "Acting" ? "Acteur / Actrice" : "Réalisateur / Réalisatrice"}
          </p>
        )}
        {detail?.birthday && (
          <p className="text-[12px] text-foreground/50 font-sans">
            Né(e) le {new Date(detail.birthday).toLocaleDateString("fr-FR")}
          </p>
        )}
        {detail?.place_of_birth && (
          <p className="text-[11px] text-foreground/45 font-sans mt-0.5">{detail.place_of_birth}</p>
        )}
      </div>
    </div>

    <div className="border-t border-border/10 mx-5 mb-5" />

    {detail?.biography && (
      <div className="px-5 mb-5">
        <h4 className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
          <span className="w-4 h-px bg-foreground/20 inline-block" />
          Biographie
        </h4>
        <p className="text-[13px] leading-relaxed text-foreground/60 line-clamp-6">{detail.biography}</p>
      </div>
    )}

    {filmography.length > 0 && (
      <div className="px-5">
        <h4 className="mb-3 text-[11px] font-sans font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
          <Film className="h-3 w-3" />
          Filmographie
        </h4>
        <div className="grid grid-cols-4 gap-2.5">
          {filmography.map((f: any) => (
            <button
              key={`${f.id}-${f.character || f.job}`}
              onClick={() => onMovieClick({ id: f.id, title: f.title, poster_path: f.poster_path })}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <img
                src={f.poster_path ? `https://image.tmdb.org/t/p/w92${f.poster_path}` : "/placeholder.svg"}
                alt={f.title}
                className="w-full aspect-[2/3] rounded-xl object-cover border border-border/15 group-hover:border-primary/35 transition-colors shadow-sm"
              />
              <span className="text-center text-[10px] text-foreground/50 leading-tight line-clamp-2 group-hover:text-primary/80 transition-colors font-sans">
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
