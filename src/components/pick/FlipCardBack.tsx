import { useState, useEffect, useMemo } from "react";
import { Loader2, Film, User, Clapperboard } from "lucide-react";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { getPersonPhotoUrl, fetchPersonDetail } from "@/lib/people-preferences";
import type { Movie } from "@/lib/tmdb";
import FeedbackBadge from "@/components/pick/FeedbackBadge";
import { useMovieInteraction, useMovieInteractions } from "@/hooks/use-movie-interactions";

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface FlipCardBackProps {
  item: Movie | any;
  type: "movie" | "tv" | "person";
}

const FlipCardBack = ({ item, type }: FlipCardBackProps) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const interaction = useMovieInteraction(
    type === "movie" || type === "tv" ? item?.id : null,
    type === "tv" ? "tv" : "movie",
  );

  useEffect(() => {
    if (!item) return;

    let cancelled = false;

    setLoading(true);
    setDetail(null);
    setHasError(false);

    const handleSuccess = (data: any) => {
      if (!cancelled) {
        setDetail(data);
      }
    };

    const handleError = () => {
      if (!cancelled) {
        setHasError(true);
      }
    };

    const handleFinally = () => {
      if (!cancelled) {
        setLoading(false);
      }
    };

    if (type === "movie") {
      fetch(
        `https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`,
      )
        .then((r) => r.json())
        .then(handleSuccess)
        .catch(handleError)
        .finally(handleFinally);
    } else if (type === "tv") {
      fetch(
        `https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`,
      )
        .then((r) => r.json())
        .then(handleSuccess)
        .catch(handleError)
        .finally(handleFinally);
    } else {
      fetchPersonDetail(item.id).then(handleSuccess).catch(handleError).finally(handleFinally);
    }

    return () => {
      cancelled = true;
    };
  }, [item?.id, type]);

  if (type === "movie" || type === "tv") {
    const title = type === "tv" ? item.name || item.title || getDisplayTitle(item) : getDisplayTitle(item);

    const releaseYear =
      detail?.release_date?.substring(0, 4) ||
      detail?.first_air_date?.substring(0, 4) ||
      item.release_date?.substring(0, 4) ||
      item.first_air_date?.substring(0, 4);

    const synopsis = detail?.overview || item.overview;

    const director =
      type === "tv" ? detail?.created_by?.[0] || null : detail?.credits?.crew?.find((c: any) => c.job === "Director");

    const cast = detail?.credits?.cast?.slice(0, 4) || [];

    return (
      <div className="relative flex h-full min-h-full flex-col overflow-y-auto bg-background px-4 py-4">
        {(loading || hasError) && (
          <div className="mb-3 flex items-center justify-between rounded-full border border-border/40 bg-card/80 px-3 py-2 text-[10px] font-medium text-foreground/70 backdrop-blur-sm">
            <span>{loading ? "Chargement des détails…" : "Détails partiels affichés"}</span>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/70" /> : null}
          </div>
        )}

        <div className="relative mb-3 overflow-hidden rounded-2xl border border-border/20 bg-card/40">
          <img
            src={getPosterUrl(item.poster_path, "w342")}
            alt={title}
            className="aspect-[2/3] w-full object-cover brightness-[1.14] contrast-[1.08] saturate-[1.18]"
          />
          {interaction.hasInteraction && (
            <div className="absolute top-2 left-2">
              <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} size="sm" />
            </div>
          )}
        </div>

        <h3 className="mb-1 text-base font-serif font-bold leading-tight text-foreground">{title}</h3>

        {type === "tv" ? (
          <p className="mb-2 text-[10px] font-sans text-foreground/40">
            {releaseYear}
            {detail?.number_of_seasons &&
              ` • ${detail.number_of_seasons} saison${detail.number_of_seasons > 1 ? "s" : ""}`}
            {detail?.number_of_episodes && ` • ${detail.number_of_episodes} ép.`}
            {detail?.vote_average > 0 && <span className="ml-2 text-primary">★ {detail.vote_average.toFixed(1)}</span>}
          </p>
        ) : releaseYear ? (
          <p className="mb-2 text-[10px] font-sans text-foreground/40">
            {releaseYear}
            {detail?.runtime ? ` • ${detail.runtime}min` : ""}
            {detail?.vote_average > 0 && <span className="ml-2 text-primary">★ {detail.vote_average.toFixed(1)}</span>}
          </p>
        ) : null}

        {detail?.genres && (
          <div className="mb-2 flex flex-wrap gap-1">
            {detail.genres.slice(0, 4).map((g: any) => (
              <span key={g.id} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary/70">
                {g.name}
              </span>
            ))}
          </div>
        )}

        {synopsis && <p className="mb-3 text-[11px] leading-relaxed text-foreground/55 line-clamp-5">{synopsis}</p>}

        {director && (
          <div className="mb-2">
            <p className="mb-0.5 text-[9px] font-sans font-semibold uppercase tracking-wider text-foreground/45">
              <Clapperboard className="mr-0.5 inline h-2.5 w-2.5" />
              {type === "tv" ? "Créateur" : "Réalisateur"}
            </p>
            <p className="text-[11px] text-foreground/60">{director.name}</p>
          </div>
        )}

        {cast.length > 0 && (
          <div>
            <p className="mb-1 text-[9px] font-sans font-semibold uppercase tracking-wider text-foreground/45">
              <User className="mr-0.5 inline h-2.5 w-2.5" />
              Casting
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {cast.map((c: any) => (
                <div key={c.id} className="flex flex-col items-center gap-0.5">
                  <img
                    src={c.profile_path ? `https://image.tmdb.org/t/p/w92${c.profile_path}` : "/placeholder.svg"}
                    alt={c.name}
                    className="h-10 w-10 rounded-full border border-border/20 object-cover brightness-[1.08] contrast-[1.06] saturate-[1.12]"
                  />
                  <span className="text-center text-[8px] leading-tight text-foreground/45">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !synopsis && !director && cast.length === 0 && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-border/30 bg-card/60 p-3">
            <div className="relative mb-3">
              <img
                src={getPosterUrl(item.poster_path, "w342")}
                alt={title}
                className="aspect-[2/3] w-full rounded-xl object-cover"
              />
              {interaction.hasInteraction && (
                <div className="absolute top-2 left-2">
                  <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} size="sm" />
                </div>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-foreground/55">
              Les détails complets ne sont pas encore disponibles pour ce titre.
            </p>
          </div>
        )}
      </div>
    );
  }

  const actorCredits = detail?.movie_credits?.cast?.slice(0, 8) || [];
  const directorCredits = detail?.movie_credits?.crew?.filter((c: any) => c.job === "Director").slice(0, 8) || [];
  const filmography = actorCredits.length > 0 ? actorCredits : directorCredits;

  return (
    <PersonDetailContent item={item} detail={detail} filmography={filmography} loading={loading} hasError={hasError} />
  );
};

const PersonDetailContent = ({
  item,
  detail,
  filmography,
  loading,
  hasError,
}: {
  item: any;
  detail: any;
  filmography: any[];
  loading: boolean;
  hasError: boolean;
}) => {
  const filmographyInteractions = useMovieInteractions(
    useMemo(
      () => filmography.filter((f: any) => f?.id).map((f: any) => ({ tmdbId: f.id, mediaType: "movie" as const })),
      [filmography],
    ),
  );

  return (
    <div className="relative flex h-full min-h-full flex-col overflow-y-auto bg-background px-4 pt-10 pb-4">
      {(loading || hasError) && (
        <div className="mb-3 flex items-center justify-between rounded-full border border-border/40 bg-card/80 px-3 py-2 text-[10px] font-medium text-foreground/70 backdrop-blur-sm">
          <span>{loading ? "Chargement des détails…" : "Détails partiels affichés"}</span>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/70" /> : null}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <img
          src={getPersonPhotoUrl(item.profile_path, "w185")}
          alt={item.name}
          className="h-16 w-12 shrink-0 rounded-xl border border-border/20 object-cover brightness-[1.14] contrast-[1.08] saturate-[1.18]"
        />
        <div className="min-w-0">
          <h3 className="text-base font-serif font-bold leading-tight text-foreground">{item.name}</h3>
          {(detail?.known_for_department || item.known_for_department) && (
            <p className="text-[10px] font-sans text-foreground/40">
              {(detail?.known_for_department || item.known_for_department) === "Acting"
                ? "Acteur/Actrice"
                : "Réalisateur/Réalisatrice"}
            </p>
          )}
          {detail?.birthday && (
            <p className="text-[10px] font-sans text-foreground/45">
              Né(e) le {new Date(detail.birthday).toLocaleDateString("fr-FR")}
              {detail?.place_of_birth && ` · ${detail.place_of_birth.split(",").pop()?.trim()}`}
            </p>
          )}
        </div>
      </div>

      {(detail?.biography || item?.known_for?.length) && (
        <p className="mb-3 text-[11px] leading-relaxed text-foreground/55 line-clamp-6">
          {detail?.biography ||
            `Connu(e) pour ${item.known_for
              .map((entry: any) => entry.title || entry.name)
              .filter(Boolean)
              .slice(0, 4)
              .join(", ")}.`}
        </p>
      )}

      {filmography.length > 0 && (
        <div>
          <p className="mb-1.5 text-[9px] font-sans font-semibold uppercase tracking-wider text-foreground/45">
            <Film className="mr-0.5 inline h-2.5 w-2.5" />
            Filmographie
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {filmography.map((f: any) => {
              const interaction = filmographyInteractions[f.id];
              return (
                <div key={`${f.id}-${f.character || f.job}`} className="flex flex-col items-center gap-0.5">
                  <div className="relative w-full">
                    <img
                      src={getPosterUrl(f.poster_path, "w185")}
                      alt={f.title}
                      className="aspect-[2/3] w-full rounded-lg border border-border/20 object-cover brightness-[1.08] contrast-[1.06] saturate-[1.12]"
                    />
                    {interaction?.hasInteraction && (
                      <div className="absolute top-1 left-1">
                        <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} size="sm" />
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-2 text-center text-[8px] leading-tight text-foreground/45">
                    {f.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !detail?.biography && filmography.length === 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-foreground/55">
          Les détails complets ne sont pas encore disponibles pour cette personne.
        </p>
      )}
    </div>
  );
};

export default FlipCardBack;
