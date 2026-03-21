import { useState, useEffect } from "react";
import { Loader2, Film, User, Clapperboard } from "lucide-react";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { getPersonPhotoUrl, fetchPersonDetail } from "@/lib/people-preferences";
import type { Movie } from "@/lib/tmdb";

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface FlipCardBackProps {
  item: Movie | any;
  type: "movie" | "tv" | "person";
}

const FlipCardBack = ({ item, type }: FlipCardBackProps) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    setDetail(null);

    if (type === "movie") {
      fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`)
        .then(r => r.json())
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    } else if (type === "tv") {
      fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`)
        .then(r => r.json())
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    } else {
      fetchPersonDetail(item.id)
        .then(d => setDetail(d))
        .finally(() => setLoading(false));
    }
  }, [item?.id, type]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
      </div>
    );
  }

  if (type === "movie" || type === "tv") {
    const director = detail?.credits?.crew?.find((c: any) => c.job === "Director");
    const cast = detail?.credits?.cast?.slice(0, 4) || [];

    return (
      <div className="flex h-full flex-col overflow-y-auto bg-card px-4 py-4">
        <h3 className="mb-1 text-base font-serif font-bold leading-tight text-foreground">
          {type === "tv" ? (item.name || item.title || getDisplayTitle(item)) : getDisplayTitle(item)}
        </h3>
        {type === "tv" ? (
          <p className="mb-2 text-[10px] font-sans text-foreground/40">
            {detail?.first_air_date?.substring(0, 4) || item.release_date?.substring(0, 4)}
            {detail?.number_of_seasons && ` • ${detail.number_of_seasons} saison${detail.number_of_seasons > 1 ? "s" : ""}`}
            {detail?.number_of_episodes && ` • ${detail.number_of_episodes} ép.`}
            {detail?.vote_average > 0 && (
              <span className="ml-2 text-primary">★ {detail.vote_average.toFixed(1)}</span>
            )}
          </p>
        ) : detail?.release_date ? (
          <p className="mb-2 text-[10px] font-sans text-foreground/40">
            {detail.release_date.substring(0, 4)} • {detail?.runtime}min
            {detail?.vote_average > 0 && (
              <span className="ml-2 text-primary">★ {detail.vote_average.toFixed(1)}</span>
            )}
          </p>
        ) : null}

        {detail?.genres && (
          <div className="mb-2 flex flex-wrap gap-1">
            {detail.genres.slice(0, 4).map((g: any) => (
              <span key={g.id} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary/70">{g.name}</span>
            ))}
          </div>
        )}

        {detail?.overview && (
          <p className="mb-3 text-[11px] leading-relaxed text-foreground/55 line-clamp-4">{detail.overview}</p>
        )}

        {director && (
          <div className="mb-2">
            <p className="text-[9px] font-sans font-semibold uppercase tracking-wider text-foreground/25 mb-0.5">
              <Clapperboard className="inline h-2.5 w-2.5 mr-0.5" />Réalisateur
            </p>
            <p className="text-[11px] text-foreground/60">{director.name}</p>
          </div>
        )}

        {cast.length > 0 && (
          <div>
            <p className="text-[9px] font-sans font-semibold uppercase tracking-wider text-foreground/25 mb-1">
              <User className="inline h-2.5 w-2.5 mr-0.5" />Casting
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {cast.map((c: any) => (
                <div key={c.id} className="flex flex-col items-center gap-0.5">
                  <img
                    src={c.profile_path ? `https://image.tmdb.org/t/p/w92${c.profile_path}` : "/placeholder.svg"}
                    alt={c.name}
                    className="h-10 w-10 rounded-full object-cover border border-border/20"
                  />
                  <span className="text-center text-[8px] text-foreground/45 leading-tight">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Person type
  const filmography = detail?.movie_credits?.cast?.slice(0, 8) || detail?.movie_credits?.crew?.filter((c: any) => c.job === "Director").slice(0, 8) || [];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card px-4 py-4">
      <h3 className="mb-1 text-base font-serif font-bold leading-tight text-foreground">{item.name}</h3>
      {detail?.known_for_department && (
        <p className="mb-1 text-[10px] font-sans text-foreground/40">
          {detail.known_for_department === "Acting" ? "Acteur/Actrice" : "Réalisateur/Réalisatrice"}
        </p>
      )}
      {detail?.birthday && (
        <p className="mb-2 text-[10px] font-sans text-foreground/25">
          Né(e) le {new Date(detail.birthday).toLocaleDateString("fr-FR")}
        </p>
      )}

      {detail?.biography && (
        <p className="mb-3 text-[11px] leading-relaxed text-foreground/55 line-clamp-4">{detail.biography}</p>
      )}

      {filmography.length > 0 && (
        <div>
          <p className="text-[9px] font-sans font-semibold uppercase tracking-wider text-foreground/25 mb-1.5">
            <Film className="inline h-2.5 w-2.5 mr-0.5" />Filmographie
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {filmography.map((f: any) => (
              <div key={`${f.id}-${f.character || f.job}`} className="flex flex-col items-center gap-0.5">
                <img
                  src={f.poster_path ? `https://image.tmdb.org/t/p/w92${f.poster_path}` : "/placeholder.svg"}
                  alt={f.title}
                  className="w-full aspect-[2/3] rounded-lg object-cover border border-border/20"
                />
                <span className="text-center text-[8px] text-foreground/45 leading-tight line-clamp-2">{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlipCardBack;
