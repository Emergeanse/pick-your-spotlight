import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import TonightPickOverlay from "./TonightPickOverlay";
import FlipCardDetail from "./FlipCardDetail";
import { useAuth } from "@/hooks/use-auth";
import { evaluerAdhesion } from "@/lib/adhesion";
import { ficheFilm, useFilmOuvert } from "@/lib/fiche-film";
import { getMovieDetails, getWatchProviders, type MovieDetail } from "@/lib/tmdb";

/**
 * Hôte de la fiche film commune : fiche principale (mur d'affiches pendant le
 * chargement, puis affiche, adhésion, actions), et fiche détaillée par-dessus
 * quand on la touche. Réagit aussi à « ?film=ID&media=movie|tv » dans
 * l'adresse (notification « Léa te conseille… », lien partagé).
 */
const FicheFilmHost = () => {
  const { user } = useAuth();
  const film = useFilmOuvert();
  const location = useLocation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [fournisseurs, setFournisseurs] = useState<{ name: string; logo_path: string }[]>([]);
  const [detailOuvert, setDetailOuvert] = useState(false);

  // Arrivée par l'adresse : on ouvre la fiche, puis on retire le paramètre.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const id = Number(p.get("film"));
    if (!(id > 0)) return;
    ficheFilm.ouvrir({ tmdbId: id, media: p.get("media") === "tv" ? "tv" : "movie" });
    p.delete("film");
    p.delete("media");
    const reste = p.toString();
    navigate(`${location.pathname}${reste ? `?${reste}` : ""}`, { replace: true });
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    setDetail(null);
    setDetailOuvert(false);
    setFournisseurs([]);
    if (!film) return;
    let actif = true;
    (async () => {
      try {
        const d = await getMovieDetails(film.tmdbId, film.media);
        getWatchProviders(d.id, film.media).then((f) => { if (actif) setFournisseurs(f); }).catch(() => {});
        // L'adhésion rejoint le film : la fiche principale l'affiche comme pour une recommandation.
        const adhesion = user ? await evaluerAdhesion(user.id, d) : null;
        if (actif) setDetail(adhesion ? ({ ...d, recommendationTexts: adhesion } as MovieDetail) : d);
      } catch {
        if (!actif) return;
        toast.error("Impossible d'ouvrir ce film pour le moment.");
        ficheFilm.fermer();
      }
    })();
    return () => { actif = false; };
  }, [film, user]);

  const fermer = () => ficheFilm.fermer();
  const ouvrirDetail = () => { if (detail) setDetailOuvert(true); };

  return (
    <>
      <TonightPickOverlay
        open={!!film}
        detailOpen={detailOuvert}
        movie={detail}
        tonightPool={detail ? [detail] : []}
        tonightPickIndex={0}
        tonightSeenMovieIds={new Set()}
        tonightProviders={fournisseurs}
        movieMatchData={{}}
        canGoPrev={false}
        canGoNext={false}
        tonightAllVisited={false}
        tonightLoading={!!film && !detail}
        onClose={fermer}
        onPrev={() => {}}
        onNext={() => {}}
        onOpenDetail={ouvrirDetail}
        onConfirm={ouvrirDetail}
        onInteraction={() => {}}
        onMoreSuggestions={() => {}}
        expectedCount={1}
        filmSeul
      />
      <FlipCardDetail
        item={detail}
        type="movie"
        isOpen={detailOuvert && !!detail}
        onClose={() => setDetailOuvert(false)}
        onPosterClick={() => setDetailOuvert(false)}
        recommendationTexts={(detail as { recommendationTexts?: never } | null)?.recommendationTexts ?? null}
        watchProviders={fournisseurs}
      />
    </>
  );
};

export default FicheFilmHost;
