import { useState, useEffect, useMemo } from "react";
import { comparerAdn, enregistrerAdn, lireAdnVisible, phraseComparaison, type AdnVisible } from "@/lib/adn-public";
import FlecheRonde from "@/components/pick/FlecheRonde";
import AdnCinema from "@/components/pick/AdnCinema";
import Distinctions from "@/components/pick/Distinctions";
import { clesDebloquees, enregistrerDistinctions, lireValeursTrophees } from "@/lib/distinctions";
import { calculerAdn, traitsDominants, universFavoris, type Adn } from "@/lib/adn";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, X, Plus, Film, CalendarDays, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchVisibleProfile } from "@/lib/visible-profiles";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyDuos, loadAcceptedFriends, type DuoProfile, type DuoFriendCandidate } from "@/lib/duo-profiles";
import { getLikedMovies } from "@/lib/liked-movies";
import { listFeedbackByType } from "@/lib/feedback";
import { getMyPreferences } from "@/lib/preferences";
import salleCinema from "@/assets/accueil-salle.webp";
import glandPick from "@/assets/gland-pick.webp";
import PhotoEncadree from "@/components/pick/PhotoEncadree";
import SignaturesAdn from "@/components/pick/SignaturesAdn";
import { cadrePour } from "@/lib/cadres";
import { estAmbassadeur } from "@/lib/invitation";
import CartePick from "@/components/pick/CartePick";
import { rareteCarte, type DonneesCarte } from "@/lib/carte-pick";
import { signaturesAdn } from "@/lib/signatures";
import { distinctionsAffichees, tropheeParCle } from "@/lib/distinctions";
import { avatarAffiche } from "@/lib/avatars";
import { usePickPlus } from "@/hooks/use-pick-plus";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const poster = (path: string | null, size = "w342") =>
  path ? `${TMDB_IMG}${size}${path}` : null;

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7C3A"]; // or, argent, bronze

// ─── Composant Podium ────────────────────────────────────────────────────────
const PodiumSlot = ({
  rank, film, onSelect,
}: {
  rank: 1 | 2 | 3;
  film: any | null;
  onSelect: () => void;
}) => {
  const heights = ["h-44", "h-36", "h-32"];
  const color = PODIUM_COLORS[rank - 1];

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 flex-1 ${rank === 1 ? "-mt-4" : ""}`}
    >
      {/* Poster */}
      <div className={`relative w-full ${heights[rank - 1]} rounded-pick-md overflow-hidden border`}
        style={{ borderColor: color + "90", boxShadow: rank === 1 && film ? `0 0 28px ${color}45` : undefined }}>
        {film ? (
          <>
            <img src={poster(film.poster_path) ?? ""} alt={film.title}
              className="w-full h-full object-cover" />
            <div className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${color}30, transparent 60%)` }} />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: `${color}12` }}>
            <Plus className="w-6 h-6" style={{ color: color + "80" }} />
          </div>
        )}
        {/* Médaille */}
        <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center font-serif text-[14px] leading-none text-black shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          style={{ background: color }}>{rank}</span>
      </div>

      {/* Titre */}
      <p className="text-[11px] font-sans text-pick-text-secondary text-center leading-tight line-clamp-2 w-full px-1">
        {film ? film.title : <span style={{ color: color + "80" }}>Choisir</span>}
      </p>
    </motion.button>
  );
};

// ─── Sélecteur de film pour le podium ────────────────────────────────────────
const PodiumSelector = ({
  lovedFilms, currentIds, rank, onPick, onClose,
}: {
  lovedFilms: any[];
  currentIds: (number | null)[];
  rank: 1 | 2 | 3;
  onPick: (film: any) => void;
  onClose: () => void;
}) => {
  const medals = ["🥇", "🥈", "🥉"];
  const available = lovedFilms.filter(f => {
    const id = f.tmdb_id ?? f.id;
    const idx = rank - 1;
    return !currentIds.some((cid, i) => i !== idx && cid === id);
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "hsl(var(--background)/0.97)" }}
    >
      <div className="flex items-center gap-3 px-5 pt-[calc(3rem+env(safe-area-inset-top))] pb-4 border-b border-white/[0.06]">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/5">
          <X className="w-5 h-5 text-foreground/60" />
        </button>
        <h2 className="font-serif text-[18px] text-foreground">
          {medals[rank - 1]} Choisir pour la place {rank}
        </h2>
      </div>
      {available.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-foreground/40 font-sans text-sm text-center px-8">
            Aucun film adoré disponible.<br />Ajoute des ❤️ dans ta bibliothèque.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5">
          <div className="grid grid-cols-3 gap-3">
            {available.map(film => {
              const id = film.tmdb_id ?? film.id;
              return (
                <motion.button key={id} whileTap={{ scale: 0.95 }}
                  onClick={() => onPick(film)}
                  className="flex flex-col items-center gap-1.5">
                  <div className="w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/[0.08]">
                    {film.poster_path ? (
                      <img src={poster(film.poster_path) ?? ""} alt={film.title}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <span className="text-foreground/40 text-xs">?</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-sans text-foreground/50 text-center line-clamp-2 leading-tight">
                    {film.title}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────
const CinemaDNAPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const targetUserId = searchParams.get("userId") || user?.id;
  const isOwnProfile = !searchParams.get("userId");

  // Profil
  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  // ADN
  const [dnaTitle, setDnaTitle] = useState<string | null>(null);
  const [dnaArchetype, setDnaArchetype] = useState<string | null>(null);

  // ADN cinéma : six traits (vecteurs de goût) et univers favoris (genres)
  const [genreStats, setGenreStats] = useState<{ genre: string; count: number }[]>([]);
  const [adn, setAdn] = useState<Adn | null>(null);
  const [adnRecent, setAdnRecent] = useState<Adn | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [confiance, setConfiance] = useState<number | null>(null);

  // Films adorés / podium
  const [lovedFilms, setLovedFilms] = useState<any[]>([]);
  const [podiumIds, setPodiumIds] = useState<(number | null)[]>([null, null, null]);
  const [selectingRank, setSelectingRank] = useState<1 | 2 | 3 | null>(null);

  // Social
  const [duos, setDuos] = useState<DuoProfile[]>([]);
  const [friends, setFriends] = useState<DuoFriendCandidate[]>([]);

  // Stats
  const [lovedCount, setLovedCount] = useState(0);
  const [seenCount, setSeenCount] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  // Le chargeur est redéfini à chaque rendu ; il ne lit que ce qui figure dans les dépendances.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  const load = async () => {
    if (!user) return;
    const tid = searchParams.get("userId") || user.id;
    const isOwn = !searchParams.get("userId") || searchParams.get("userId") === user.id;
    setLoading(true);
    try {
      // ── Profil & ADN (commun own + friend) ───────────────────────────────
      // Son propre profil se lit en entier ; celui d'un autre passe par la
      // fonction dédiée, qui ne rend que les colonnes partageables.
      const [profileRes, dnaRes] = await Promise.all([
        isOwn
          ? supabase.from("profiles").select("*").eq("id", tid).single().then((r) => r.data)
          : fetchVisibleProfile(tid),
        supabase.from("cinematic_profiles" as any).select("personality_title,dna_archetype,narrative").eq("user_id", tid).maybeSingle(),
      ]);

      const p = profileRes as any;
      setProfile(p);
      setDisplayName(p?.display_name || (isOwn ? user.email?.split("@")[0] : "") || "");
      setAvatarUrl(p?.avatar_url || null);
      setBio(p?.bio || "");

      const savedIds: (number | null)[] = p?.podium_film_ids ?? [null, null, null];
      setPodiumIds([savedIds[0] ?? null, savedIds[1] ?? null, savedIds[2] ?? null]);

      if (dnaRes.data) {
        setDnaTitle((dnaRes.data as any).personality_title || null);
        setDnaArchetype((dnaRes.data as any).dna_archetype || null);
        setNarrative((dnaRes.data as { narrative?: string | null }).narrative || null);
      }

      if (isOwn) {
        // ── Données propres ───────────────────────────────────────────────
        const [likedData, prefsData, duosData, friendsData, loveRows, lovedRes, seenRes] =
          await Promise.all([
            getLikedMovies().catch(() => []),
            getMyPreferences().catch(() => []),
            fetchMyDuos(user.id),
            loadAcceptedFriends(user.id),
            listFeedbackByType("love").catch(() => []),
            supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feedback_type", "love"),
            supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feedback_type", "seen"),
          ]);

        // Films adorés depuis les vrais feedbacks "love"
        const loved = (loveRows as any[]).map((row: any) => {
          const ci = row.catalog_items;
          if (!ci) return null;
          return { id: row.item_id, tmdb_id: ci.tmdb_id, title: ci.title, poster_path: ci.poster_path, media_type: ci.media_type };
        }).filter(Boolean);
        setLovedFilms(loved);
        setLovedCount(lovedRes.count || 0);
        setSeenCount(seenRes.count || 0);

        // Genres depuis movie_embeddings (genres réels des films vus)
        const tmdbIds = (likedData as any[]).map((m: any) => m.tmdb_id).filter(Boolean);
        const genreCounts: Record<string, number> = {};
        if (tmdbIds.length > 0) {
          const { data: embData } = await supabase
            .from("movie_embeddings" as any)
            .select("genres")
            .in("tmdb_id", tmdbIds.slice(0, 100));
          (embData ?? []).forEach((m: any) => {
            (m.genres || []).forEach((g: string) => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          });
        }
        // Fallback préférences explicites si données insuffisantes
        if (Object.keys(genreCounts).length < 3) {
          (prefsData as any[])
            .filter((pref: any) => pref.tag.category === "genre" && pref.weight > 0)
            .forEach((pref: any) => {
              genreCounts[pref.tag.label] = (genreCounts[pref.tag.label] || 0) + 1;
            });
        }
        setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })));

        setDuos(duosData);
        setFriends(friendsData);
      } else {
        // ── Profil d'un ami ───────────────────────────────────────────────
        const [loveRes, seenRes, loveRows] = await Promise.all([
          supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", tid).eq("feedback_type", "love"),
          supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", tid).eq("feedback_type", "seen"),
          supabase.from("user_item_feedback").select("item_id, catalog_items(tmdb_id, title, poster_path)").eq("user_id", tid).eq("feedback_type", "love").limit(50),
        ]);
        setLovedCount(loveRes.count || 0);
        setSeenCount(seenRes.count || 0);

        // Films adorés
        const loved = ((loveRows.data ?? []) as any[]).map((row: any) => {
          const ci = row.catalog_items;
          if (!ci) return null;
          return { id: row.item_id, tmdb_id: ci.tmdb_id, title: ci.title, poster_path: ci.poster_path };
        }).filter(Boolean);
        setLovedFilms(loved);

        // Genres depuis les films aimés
        const tmdbIds = loved.map((m: any) => m.tmdb_id).filter(Boolean);
        const genreCounts: Record<string, number> = {};
        if (tmdbIds.length > 0) {
          const { data: embData } = await supabase
            .from("movie_embeddings" as any)
            .select("genres")
            .in("tmdb_id", tmdbIds.slice(0, 100));
          (embData ?? []).forEach((m: any) => {
            (m.genres || []).forEach((g: string) => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          });
        }
        setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })));

        // Podium
        const podFilmIds = ((p?.podium_film_ids ?? []) as number[]).filter(Boolean);
        if (podFilmIds.length > 0) {
          const { data: catData } = await supabase
            .from("catalog_items" as any)
            .select("tmdb_id, title, poster_path")
            .in("tmdb_id", podFilmIds);
          // Merge avec lovedFilms pour avoir les données podium
          setLovedFilms(prev => {
            const merged = [...prev];
            ((catData ?? []) as any[]).forEach((c: any) => {
              if (!merged.find((m: any) => m.tmdb_id === c.tmdb_id)) merged.push(c);
            });
            return merged;
          });
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const univers = useMemo(() => universFavoris(genreStats), [genreStats]);

  // Son propre ADN se calcule sur ses vecteurs, dans le téléphone. Celui d'un
  // autre se lit via get_adn_visible, selon la relation et son réglage.
  const [monAdn, setMonAdn] = useState<Adn | null>(null);
  const [adnAutre, setAdnAutre] = useState<AdnVisible | null>(null);
  // Ses propres distinctions : calculées ici, épinglées lues dans l'ADN enregistré.
  const [mesDistinctions, setMesDistinctions] = useState<string[] | null>(null);
  const [mesEpinglees, setMesEpinglees] = useState<string[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let actif = true;
    computeMultiVectorProfile(user.id)
      .then((profil) => {
        if (!actif) return;
        const fond = calculerAdn(profil?.stableTasteVector);
        setMonAdn(fond);
        if (isOwnProfile) {
          setAdn(fond);
          setAdnRecent(calculerAdn(profil?.recentTasteVector));
          setConfiance(profil?.stableConfidence ?? null);
        }
      })
      .catch(() => {});
    if (!isOwnProfile && targetUserId) {
      lireAdnVisible(targetUserId).then((v) => { if (actif) setAdnAutre(v); });
    } else {
      setAdnAutre(null);
      lireValeursTrophees(user.id)
        .then((valeurs) => { if (actif) setMesDistinctions(clesDebloquees(valeurs)); })
        .catch(() => { if (actif) setMesDistinctions([]); });
      lireAdnVisible(user.id).then((v) => { if (actif && v) setMesEpinglees(v.epinglees); });
    }
    return () => { actif = false; };
  }, [isOwnProfile, user?.id, targetUserId]);

  // Son ADN est enregistré à chaque ouverture : c'est ce que voient ses amis.
  useEffect(() => {
    if (!isOwnProfile || !user?.id || !adn || loading) return;
    // Les distinctions après l'ADN : elles complètent la même ligne.
    enregistrerAdn(user.id, adn, univers).then(() => {
      if (mesDistinctions) enregistrerDistinctions(user.id, mesDistinctions);
    });
  }, [isOwnProfile, user?.id, adn, univers, loading, mesDistinctions]);

  // Personne consultée : bio et podium de la fonction ADN quand le profil visible
  // ne les donne pas (personne seulement croisée en soirée).
  useEffect(() => {
    if (!adnAutre || adnAutre.niveau === "aucun") return;
    if (adnAutre.bio && !bio) setBio(adnAutre.bio);
    if (adnAutre.podium?.length && podiumIds.every((id) => id == null)) {
      const ids = adnAutre.podium;
      setPodiumIds([ids[0] ?? null, ids[1] ?? null, ids[2] ?? null]);
      supabase.from("catalog_items" as never).select("tmdb_id, title, poster_path").in("tmdb_id", ids.filter(Boolean))
        .then(({ data }) => {
          const films = (data ?? []) as { tmdb_id: number; title: string; poster_path: string | null }[];
          setLovedFilms((prev) => [...prev, ...films.filter((f) => !prev.some((m) => m.tmdb_id === f.tmdb_id))]);
        });
    }
  // Ne réagit qu'à l'arrivée de l'ADN consulté.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adnAutre]);

  const comparaison = useMemo(() => {
    if (isOwnProfile || !monAdn || !adnAutre?.traits || adnAutre.niveau === "aucun") return null;
    const c = comparerAdn(monAdn, adnAutre.traits);
    const prenom = displayName || "cette personne";
    return { prenom, affinite: adnAutre.niveau === "ami" ? c.affinite : null, phrase: phraseComparaison(c, prenom) };
  }, [isOwnProfile, monAdn, adnAutre, displayName]);

  const podiumFilms = useMemo(() => {
    return podiumIds.map(id =>
      id != null ? lovedFilms.find(f => (f.tmdb_id ?? f.id) === id) ?? null : null
    );
  }, [podiumIds, lovedFilms]);

  // ── Carte Pick (son propre ADN) ──
  const { isPremium } = usePickPlus();
  const [carteOuverte, setCarteOuverte] = useState(false);
  const [comptesCarte, setComptesCarte] = useState<{ choix: number; coeurs: number }>({ choix: 0, coeurs: 0 });
  useEffect(() => {
    if (!carteOuverte || !user?.id) return;
    Promise.all([
      supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("feedback_type", ["like", "love"]),
    ]).then(([a, b]) => setComptesCarte({ choix: a.count ?? 0, coeurs: b.count ?? 0 }));
  }, [carteOuverte, user?.id]);
  const donneesCarte = useMemo<DonneesCarte>(() => ({
    prenom: displayName,
    archetype: dnaArchetype || dnaTitle,
    photo: avatarAffiche(avatarUrl),
    signatures: signaturesAdn(adn, univers),
    adn,
    univers,
    podium: [0, 1, 2].map((i) => {
      const f = podiumFilms[i] as { poster_path?: string | null } | null;
      return f?.poster_path ? poster(f.poster_path, "w185") : null;
    }),
    distinctions: distinctionsAffichees(mesDistinctions ?? [], mesEpinglees, 5)
      .map((c) => tropheeParCle(c)?.image)
      .filter((x): x is string => Boolean(x)),
    choixAnalyses: comptesCarte.choix,
    coupsDeCoeur: comptesCarte.coeurs,
  }), [displayName, dnaArchetype, dnaTitle, avatarUrl, adn, univers, podiumFilms, mesDistinctions, mesEpinglees, comptesCarte]);

  const saveBio = async () => {
    if (!user) return;
    setSavingBio(true);
    await supabase.from("profiles").update({ bio: bioDraft } as any).eq("id", user.id);
    setBio(bioDraft);
    setEditingBio(false);
    setSavingBio(false);
  };

  const savePodium = async (newIds: (number | null)[]) => {
    if (!user) return;
    setPodiumIds(newIds);
    await supabase.from("profiles").update({ podium_film_ids: newIds } as any).eq("id", user.id);
  };

  const handlePickFilm = (film: any) => {
    if (selectingRank == null) return;
    const id = film.tmdb_id ?? film.id;
    const newIds = [...podiumIds] as (number | null)[];
    newIds[selectingRank - 1] = id;
    savePodium(newIds);
    setSelectingRank(null);
  };

  // La fiche montre son propre ADN, ou celui de la personne consultée s'il est visible.
  const adnVisible = !isOwnProfile && adnAutre && adnAutre.niveau !== "aucun" ? adnAutre : null;
  const adnAffiche = isOwnProfile ? adn : adnVisible?.traits ?? null;
  const archetypeAffiche = isOwnProfile ? (dnaArchetype || dnaTitle) : adnVisible?.archetype ?? null;
  const narrativeAffichee = isOwnProfile ? narrative : adnVisible?.narrative ?? null;
  const dominantsAffiches = adnAffiche ? traitsDominants(adnAffiche) : [];
  const signaturesAffichees = signaturesAdn(adnAffiche, isOwnProfile ? univers : adnVisible?.univers ?? []);
  // Le cadre de la photo suit les trophées, comme sur l'accueil.
  const cadre = isOwnProfile
    ? cadrePour(mesDistinctions?.length ?? 0, estAmbassadeur(user?.user_metadata))
    : cadrePour(adnVisible?.distinctions.length ?? 0);

  // Partage du lien vers son ADN (feuille de partage du téléphone, sinon copie).
  const partagerAdn = async () => {
    if (!user) return;
    const url = `${window.location.origin}/app/adn?userId=${user.id}`;
    const texte = dnaArchetype || dnaTitle ? `Mon ADN cinéma sur Pick : ${dnaArchetype || dnaTitle}` : "Mon ADN cinéma sur Pick";
    try {
      if (navigator.share) await navigator.share({ title: "Mon ADN cinéma", text: texte, url });
      else { await navigator.clipboard.writeText(url); toast.success("Lien copié"); }
    } catch { /* partage annulé : rien à faire */ }
  };

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto overflow-x-hidden scrollbar-hide">
      {/* Sélecteur podium */}
      <AnimatePresence>
        {selectingRank != null && (
          <PodiumSelector
            lovedFilms={lovedFilms}
            currentIds={podiumIds}
            rank={selectingRank}
            onPick={handlePickFilm}
            onClose={() => setSelectingRank(null)}
          />
        )}
      </AnimatePresence>

      {/* Décor : la salle de l'accueil, fondue dans la nuit. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[520px] bg-cover bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${salleCinema})`,
          backgroundPosition: "50% 25%",
          maskImage: "linear-gradient(to bottom, black 15%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 15%, transparent 100%)",
          opacity: 0.32,
        }}
      />

      {/* ── En-tête ── */}
      <div className="relative z-10 pt-[calc(0.75rem+env(safe-area-inset-top))] px-4 flex items-center">
        <FlecheRonde
          direction="gauche"
          label="Retour"
          tailleClasse="w-10 h-10"
          onClick={() => {
            const from = (location.state as { from?: string } | null)?.from;
            if (from === "amis") navigate("/app/duo", { state: { tab: "amis" } });
            else navigate(-1);
          }}
        />
        <h1 className="flex-1 pr-10 text-center text-[11px] font-sans font-semibold tracking-[0.3em] uppercase text-pick-gold">
          {isOwnProfile ? "Mon ADN cinéma" : "ADN cinéma"}
        </h1>
      </div>

      <div className={`relative px-4 pt-4 flex flex-col gap-7 ${isOwnProfile ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-[calc(10rem+env(safe-area-inset-bottom))]"}`}>

        {/* ── Skeleton chargement ── */}
        {loading && (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="rounded-pick-xl border border-pick-gold/15 px-5 pt-10 pb-8 flex flex-col items-center gap-3" style={{ background: "hsl(var(--card)/0.4)" }}>
              <div className="w-28 h-28 rounded-full bg-foreground/[0.08]" />
              <div className="h-7 w-40 rounded-xl bg-foreground/[0.08] mt-3" />
              <div className="h-5 w-52 rounded-xl bg-foreground/[0.06]" />
              <div className="h-3 w-64 rounded bg-foreground/[0.06] mt-4" />
              <div className="h-3 w-48 rounded bg-foreground/[0.06]" />
            </div>
            <div className="h-[260px] rounded-pick-xl bg-foreground/[0.05]" />
          </div>
        )}

        {/* ══ 1. LA FICHE : l'identité cinéphile, le moment Pick de l'écran ══ */}
        {!loading && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative rounded-pick-xl border border-pick-gold/35 overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)] bg-[radial-gradient(120%_60%_at_50%_0%,rgba(139,92,246,0.30),transparent_62%),linear-gradient(180deg,rgba(24,17,44,0.94),rgba(9,7,16,0.97))]"
          >
            {/* Double filet doré : la fiche se lit comme un carton d'avant-première. */}
            <div aria-hidden="true" className="absolute inset-[6px] rounded-pick-lg border border-pick-gold/15 pointer-events-none" />

            <div className="relative flex flex-col items-center text-center px-5 pt-3 pb-6">
              <div className="p-[46px]">
                <PhotoEncadree photo={avatarUrl} cadre={cadre.image} taille={104} />
              </div>

              <p className="-mt-3 font-serif text-[34px] leading-[1.05] text-white [text-wrap:balance]">{displayName || "Picker"}</p>
              {archetypeAffiche && (
                <p className="mt-1.5 font-serif italic text-[20px] leading-tight text-pick-gold [text-wrap:balance]">{archetypeAffiche}</p>
              )}
              {dominantsAffiches.length > 0 && (
                <p className="mt-2.5 text-[11px] font-sans font-semibold tracking-[0.22em] uppercase text-pick-purple-light">
                  {dominantsAffiches.map((d) => d.adjectif).join(" · ")}
                </p>
              )}

              {/* Filet doré marqué du gland : la signature de Pick. */}
              <div aria-hidden="true" className="mt-5 flex items-center gap-3 w-full max-w-[240px]">
                <span className="flex-1 h-px bg-gradient-to-r from-transparent to-pick-gold/55" />
                <img src={glandPick} alt="" className="w-4 h-4 object-contain opacity-90" />
                <span className="flex-1 h-px bg-gradient-to-l from-transparent to-pick-gold/55" />
              </div>

              {narrativeAffichee && (
                <p className="mt-4 max-w-[34ch] text-[14px] font-sans leading-relaxed text-pick-text-secondary">{narrativeAffichee}</p>
              )}
              {signaturesAffichees.length > 0 && (
                <div className="mt-4"><SignaturesAdn signatures={signaturesAffichees} centre /></div>
              )}

              {/* Bio : sa phrase de cinéphile, en citation. */}
              <div className="mt-5 w-full max-w-[320px]">
                {isOwnProfile && editingBio ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      autoFocus value={bioDraft}
                      onChange={e => setBioDraft(e.target.value)}
                      maxLength={120}
                      rows={2}
                      placeholder="En une phrase, ton rapport au cinéma…"
                      className="w-full bg-white/[0.06] border border-pick-border-hover rounded-pick-md px-3 py-2 text-[14px] font-serif italic text-foreground/90 placeholder:text-foreground/45 focus:outline-none focus:border-pick-purple-light/60 resize-none text-center"
                    />
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => { setEditingBio(false); setBioDraft(bio); }} aria-label="Annuler"
                        className="w-10 h-10 flex items-center justify-center rounded-full border border-pick-border active:scale-[0.97] transition-transform duration-120 ease-pick"><X className="w-4 h-4 text-foreground/60" /></button>
                      <button onClick={saveBio} disabled={savingBio} aria-label="Enregistrer"
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/20 border border-pick-purple-light/50 active:scale-[0.97] transition-transform duration-120 ease-pick">
                        <Check className="w-4 h-4 text-pick-purple-light" />
                      </button>
                    </div>
                  </div>
                ) : isOwnProfile ? (
                  <button onClick={() => { setBioDraft(bio); setEditingBio(true); }}
                    className="inline-flex items-start gap-2 text-left active:scale-[0.98] transition-transform duration-120 ease-pick">
                    <span className={`font-serif italic text-[15px] leading-snug ${bio ? "text-foreground/85" : "text-pick-text-muted"}`}>
                      {bio ? `« ${bio} »` : "Ajoute ta phrase de cinéphile"}
                    </span>
                    <Pencil className="w-3.5 h-3.5 text-pick-text-muted shrink-0 mt-1" aria-hidden="true" />
                  </button>
                ) : bio ? (
                  <p className="font-serif italic text-[15px] leading-snug text-foreground/85">« {bio} »</p>
                ) : null}
              </div>

              {/* Son ADN : trois chiffres, puis le partage. */}
              {isOwnProfile && (
                <>
                  <dl className="mt-6 w-full grid grid-cols-3 divide-x divide-pick-gold/20 border-y border-pick-gold/20 py-3">
                    {[
                      { valeur: lovedCount, libelle: lovedCount > 1 ? "coups de cœur" : "coup de cœur" },
                      { valeur: seenCount, libelle: seenCount > 1 ? "films vus" : "film vu" },
                      { valeur: mesDistinctions?.length ?? 0, libelle: (mesDistinctions?.length ?? 0) > 1 ? "distinctions" : "distinction" },
                    ].map((c) => (
                      <div key={c.libelle} className="flex flex-col-reverse items-center px-1">
                        <dt className="text-[11px] font-sans text-pick-text-secondary leading-tight">{c.libelle}</dt>
                        <dd className="font-serif text-[26px] leading-none text-white tabular-nums">{c.valeur}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    type="button"
                    onClick={partagerAdn}
                    className="mt-6 w-full h-[52px] inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-pick-purple-light/80 bg-[linear-gradient(180deg,#3a2470,#1c1040)] shadow-[0_0_0_4px_rgba(139,92,246,0.14),0_0_34px_rgba(168,85,247,0.55)] text-[15px] font-sans font-semibold text-white active:scale-[0.98] transition-transform duration-120 ease-pick"
                  >
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    Partager mon ADN
                  </button>
                </>
              )}

              {/* L'ADN d'un ami : ce qui vous rapproche. */}
              {comparaison && (
                <div className="mt-6 w-full border-t border-pick-gold/20 pt-5">
                  {comparaison.affinite != null && (
                    <>
                      <p className="font-serif text-[44px] leading-none text-pick-gold tabular-nums">{comparaison.affinite}&nbsp;%</p>
                      <p className="mt-1 text-[11px] font-sans font-semibold tracking-[0.2em] uppercase text-pick-text-secondary">d&apos;affinité cinéma entre vous</p>
                    </>
                  )}
                  <p className="mt-3 mx-auto max-w-[34ch] text-[13px] font-sans leading-snug text-pick-text-secondary">{comparaison.phrase}</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* ── Carte Pick : la carte à collectionner, recto et verso ── */}
        {isOwnProfile && !loading && (
          <button
            type="button"
            onClick={() => setCarteOuverte(true)}
            className="-mt-2 w-full flex items-center gap-4 rounded-pick-lg border border-pick-gold/35 bg-[linear-gradient(100deg,rgba(232,184,92,0.12),rgba(139,92,246,0.08)_55%,transparent)] px-4 py-3.5 text-left active:scale-[0.98] transition-transform duration-120 ease-pick"
          >
            <span className="relative w-11 h-[60px] shrink-0" aria-hidden="true">
              <span className="absolute inset-0 rounded-[6px] border border-pick-gold/40 bg-[url('/cartes/verso-or.webp')] bg-cover bg-center -rotate-6 opacity-70" />
              <span className="absolute inset-0 rounded-[6px] border border-pick-gold/70 bg-[url('/cartes/recto-or.webp')] bg-cover bg-center rotate-3 shadow-pick-card" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-serif text-[18px] text-pick-gold leading-tight">Ma Carte Pick</span>
              <span className="block mt-0.5 text-[12px] font-sans text-pick-text-secondary">Recto, verso : ta carte de cinéphile à offrir</span>
            </span>
            <ChevronRight className="w-4 h-4 text-pick-gold shrink-0" aria-hidden="true" />
          </button>
        )}
        <CartePick
          ouvert={carteOuverte}
          onFermer={() => setCarteOuverte(false)}
          donnees={donneesCarte}
          rarete={rareteCarte(mesDistinctions?.length ?? 0)}
          pickPlus={isPremium}
        />

        {/* ══ 2. LA CONSTELLATION ══ */}
        {isOwnProfile ? (
          <AdnCinema
            adn={adn}
            adnRecent={adnRecent}
            narrative={null}
            genres={univers}
            titre="Ta constellation"
            confiance={confiance}
            enTete={false}
          />
        ) : adnAutre && adnAutre.niveau !== "aucun" && (adnAutre.traits || adnAutre.univers.length > 0) ? (
          <AdnCinema
            adn={adnAutre.traits}
            adnRecent={null}
            narrative={null}
            genres={adnAutre.univers}
            titre={`La constellation de ${displayName || "ce Picker"}`}
            chiffresMasques={adnAutre.niveau === "soiree"}
            enTete={false}
          />
        ) : adnAutre && !loading ? (
          <p className="rounded-pick-lg border border-pick-border bg-pick-surface/90 p-4 text-[13px] font-sans text-pick-text-secondary">
            {adnAutre.niveau === "aucun"
              ? `${displayName || "Cette personne"} n'a pas rendu son ADN cinéma visible.`
              : `${displayName || "Cette personne"} n'a pas encore d'ADN cinéma : il apparaîtra quand elle aura ouvert le sien.`}
          </p>
        ) : null}

        {/* ══ 3. LE PODIUM ══ */}
        {!loading && (
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <h2 className="font-serif text-[18px] text-pick-gold px-1">{isOwnProfile ? "Mon podium" : "Son podium"}</h2>
          <p className="px-1 mb-4 text-[12px] font-sans text-pick-text-muted">
            {isOwnProfile ? "Les trois films qui te racontent." : `Les trois films qui racontent ${displayName || "ce Picker"}.`}
          </p>
          <div className="flex items-end gap-3 px-1">
            {/* Ordre visuel podium : 2 | 1 | 3 */}
            <PodiumSlot rank={2} film={podiumFilms[1]} onSelect={isOwnProfile ? () => setSelectingRank(2) : () => {}} />
            <PodiumSlot rank={1} film={podiumFilms[0]} onSelect={isOwnProfile ? () => setSelectingRank(1) : () => {}} />
            <PodiumSlot rank={3} film={podiumFilms[2]} onSelect={isOwnProfile ? () => setSelectingRank(3) : () => {}} />
          </div>
        </motion.section>
        )}

        {!loading && isOwnProfile && user?.id && mesDistinctions && (
          <Distinctions debloquees={mesDistinctions} epinglees={mesEpinglees} userId={user.id} onEpinglees={setMesEpinglees} />
        )}
        {!loading && !isOwnProfile && adnAutre && adnAutre.niveau !== "aucun" && (
          <Distinctions debloquees={adnAutre.distinctions} epinglees={adnAutre.epinglees} prenom={displayName || undefined} />
        )}

        {/* « Films adorés » et « Mon cercle cinéphile » ne figurent plus ici :
            ils relèvent du compte (Biblio, Amis & Duo), pas de l'identité
            cinéphile que les autres voient. Le podium, choisi par l'utilisateur,
            dit déjà quels films le représentent. */}
      </div>

      {/* ── CTA Regarder ensemble (profil ami uniquement) ── */}
      {!isOwnProfile && !loading && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pb-[calc(5rem+env(safe-area-inset-bottom))] px-4 pt-3 pointer-events-none"
          style={{ background: "linear-gradient(to top, hsl(var(--background)) 60%, transparent)" }}>
          <div className="flex gap-2.5 pointer-events-auto">
            <button
              onClick={() => navigate("/app/soiree/nouvelle", { state: { friendId: targetUserId, friendName: displayName } })}
              className="flex-1 flex items-center justify-center gap-2 h-[52px] rounded-full border border-pick-border-hover bg-white/[0.06] backdrop-blur-md active:scale-[0.97] transition-transform duration-120 ease-pick"
            >
              <CalendarDays className="w-4 h-4 text-pick-purple-light" strokeWidth={1.8} />
              <span className="text-[14px] font-sans font-semibold text-foreground">Soirée ciné</span>
            </button>
            <button
              onClick={() => navigate("/app", { state: { friendId: targetUserId, friendName: displayName, mode: "duo" } })}
              className="flex-[1.3] flex items-center justify-center gap-2 h-[52px] rounded-full border-[1.5px] border-pick-purple-light/80 bg-[linear-gradient(180deg,#3a2470,#1c1040)] shadow-[0_0_0_4px_rgba(139,92,246,0.14),0_0_34px_rgba(168,85,247,0.55)] active:scale-[0.97] transition-transform duration-120 ease-pick"
            >
              <Film className="w-4 h-4 text-white" strokeWidth={1.8} />
              <span className="text-[14px] font-sans font-semibold text-white">Regarder ensemble</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CinemaDNAPage;
