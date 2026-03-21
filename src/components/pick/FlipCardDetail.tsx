import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Film, User, Clapperboard } from "lucide-react";
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

const FlipCardDetail = ({ item, type, isOpen, onClose }: FlipCardDetailProps) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    setLoading(true);
    setDetail(null);

    if (type === "movie") {
      fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`)
        .then(r => r.json())
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    } else {
      fetchPersonDetail(item.id)
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    }
  }, [isOpen, item, type]);

  if (!isOpen) return null;

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
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-card/90 px-5 pt-4 pb-2 backdrop-blur-md">
              <div className="h-1 w-10 rounded-full bg-foreground/10 mx-auto" />
              <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-foreground/5 p-1.5">
                <X className="h-4 w-4 text-foreground/40" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
              </div>
            ) : type === "movie" ? (
              <div className="px-5 pb-8 pt-2">
                {/* Movie header */}
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

                {/* Synopsis */}
                {detail?.overview && (
                  <div className="mb-5">
                    <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">Synopsis</h4>
                    <p className="text-sm leading-relaxed text-foreground/60">{detail.overview}</p>
                  </div>
                )}

                {/* Director */}
                {director && (
                  <div className="mb-4">
                    <h4 className="mb-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
                      <Clapperboard className="inline h-3 w-3 mr-1" />Réalisateur
                    </h4>
                    <p className="text-sm text-foreground/70">{director.name}</p>
                  </div>
                )}

                {/* Cast */}
                {cast.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-sans font-semibold uppercase tracking-wider text-foreground/30">
                      <User className="inline h-3 w-3 mr-1" />Casting
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {cast.map((c: any) => (
                        <div key={c.id} className="flex flex-col items-center gap-1">
                          <img
                            src={c.profile_path ? `https://image.tmdb.org/t/p/w92${c.profile_path}` : "/placeholder.svg"}
                            alt={c.name}
                            className="h-14 w-14 rounded-full object-cover border border-border/20"
                          />
                          <span className="text-center text-[10px] text-foreground/50 leading-tight">{c.name}</span>
                          <span className="text-center text-[9px] text-foreground/25 leading-tight">{c.character}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Person detail */
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
                        <div key={`${f.id}-${f.character || f.job}`} className="flex flex-col items-center gap-1">
                          <img
                            src={f.poster_path ? `https://image.tmdb.org/t/p/w92${f.poster_path}` : "/placeholder.svg"}
                            alt={f.title}
                            className="w-full aspect-[2/3] rounded-lg object-cover border border-border/20"
                          />
                          <span className="text-center text-[9px] text-foreground/50 leading-tight line-clamp-2">{f.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FlipCardDetail;
