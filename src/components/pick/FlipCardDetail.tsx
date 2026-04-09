import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Film, User, Clapperboard, ChevronLeft } from "lucide-react";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { getPersonPhotoUrl, fetchPersonDetail } from "@/lib/people-preferences";
import type { Movie } from "@/lib/tmdb";

interface FlipCardDetailProps {
  item: Movie | any;
  type: "movie" | "person";
  isOpen: boolean;
  onClose: () => void;
}

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

type NavEntry = { item: any; type: "movie" | "person" };

const FlipCardDetail = ({ item, type, isOpen, onClose }: FlipCardDetailProps) => {
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [currentType, setCurrentType] = useState<"movie" | "person">(type);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Sync with props when opened fresh
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

  // Fetch detail for current item
  useEffect(() => {
    if (!isOpen || !currentItem) return;
    setLoading(true);
    setDetail(null);

    if (currentType === "movie") {
      fetch(`https://api.themoviedb.org/3/movie/${currentItem.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`)
        .then(r => r.json())
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    } else {
      fetchPersonDetail(currentItem.id)
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentItem?.id, currentType]);

  const navigateTo = useCallback((newItem: any, newType: "movie" | "person") => {
    setNavStack(prev => [...prev, { item: currentItem, type: currentType }]);
    setCurrentItem(newItem);
    setCurrentType(newType);
  }, [currentItem, currentType]);

  const navigateBack = useCallback(() => {
    if (navStack.length === 0) {
      onClose();
      return;
    }
    const prev = navStack[navStack.length - 1];
    setNavStack(s => s.slice(0, -1));
    setCurrentItem(prev.item);
    setCurrentType(prev.type);
  }, [navStack, onClose]);

  if (!isOpen || !currentItem) return null;
  const director = detail?.credits?.crew?.find((c: any) => c.job === "Director");
  const cast = detail?.credits?.cast?.slice(0, 6) || [];
  const filmography = detail?.movie_credits?.cast?.slice(0, 12) || detail?.movie_credits?.crew?.filter((c: any) => c.job === "Director").slice(0, 12) || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-background/80 backdrop-blur-md"
          onClick={navigateBack}
        >
          <motion.div
            key={`${currentType}-${currentItem?.id}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with back / close */}
            <div className="sticky top-0 z-10 flex items-center justify-between bg-card/90 px-5 pt-4 pb-2 backdrop-blur-md">
              <div className="flex-1 flex items-center">
                {navStack.length > 0 && (
                  <button onClick={navigateBack} className="flex items-center gap-1 text-foreground/50 hover:text-foreground text-xs font-sans transition-colors mr-2">
                    <ChevronLeft className="h-4 w-4" />
                    Retour
                  </button>
                )}
              </div>
              <div className="h-1 w-10 rounded-full bg-foreground/10 mx-auto" />
              <div className="flex-1 flex justify-end">
                <button onClick={onClose} className="rounded-full bg-foreground/5 p-1.5">
                  <X className="h-4 w-4 text-foreground/40" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
              </div>
            ) : currentType === "movie" ? (
              <MovieDetailContent
                item={currentItem}
                detail={detail}
                director={director}
                cast={cast}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Movie Detail Sub-component ── */
const MovieDetailContent = ({ item, detail, director, cast, onPersonClick }: {
  item: any; detail: any; director: any; cast: any[];
  onPersonClick: (person: any) => void;
}) => (
  <div className="px-5 pb-8 pt-2">
    <div className="flex gap-4 mb-4">
      <img
        src={getPosterUrl(item.poster_path, "w185")}
        alt={getDisplayTitle(item)}
        className="h-32 w-auto rounded-xl shadow-lg"
      />
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-serif font-bold leading-tight text-foreground">
          {getDisplayTitle(item)}
        </h3>
        {detail?.release_date && (
          <p className="mt-1 text-xs text-foreground/40">{detail.release_date.substring(0, 4)} • {detail?.runtime}min</p>
        )}
        {detail?.vote_average > 0 && (
          <p className="mt-1 text-xs text-foreground/50">
            <span className="text-primary">★</span> {detail.vote_average.toFixed(1)}/10
          </p>
        )}
        {detail?.genres && (
          <div className="mt-2 flex flex-wrap gap-1">
            {detail.genres.slice(0, 4).map((g: any) => (
              <span key={g.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary/70">{g.name}</span>
            ))}
          </div>
        )}
      </div>
    </div>

    {detail?.overview && (
      <div className="mb-5">
        <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">Synopsis</h4>
        <p className="text-sm leading-relaxed text-foreground/60">{detail.overview}</p>
      </div>
    )}

    {director && (
      <div className="mb-4">
        <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
          <Clapperboard className="inline h-3 w-3 mr-1" />Réalisateur
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
          <User className="inline h-3 w-3 mr-1" />Casting
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
              <span className="text-center text-[10px] text-foreground/50 leading-tight group-hover:text-primary transition-colors">{c.name}</span>
              <span className="text-center text-[9px] text-foreground/25 leading-tight">{c.character}</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

/* ── Person Detail Sub-component ── */
const PersonDetailContent = ({ item, detail, filmography, onMovieClick }: {
  item: any; detail: any; filmography: any[];
  onMovieClick: (movie: any) => void;
}) => (
  <div className="px-5 pb-8 pt-2">
    <div className="flex gap-4 mb-4">
      <img
        src={getPersonPhotoUrl(item.profile_path, "w185")}
        alt={item.name}
        className="h-32 w-auto rounded-xl shadow-lg object-cover"
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
        {detail?.place_of_birth && (
          <p className="mt-0.5 text-xs text-foreground/25">{detail.place_of_birth}</p>
        )}
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
          <Film className="inline h-3 w-3 mr-1" />Filmographie
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
              <span className="text-center text-[9px] text-foreground/50 leading-tight line-clamp-2 group-hover:text-primary transition-colors">{f.title}</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default FlipCardDetail;
