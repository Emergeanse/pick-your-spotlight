import { useState, useEffect, useMemo } from "react";
import { comparerAdn, enregistrerAdn, lireAdnVisible, phraseComparaison, type AdnVisible } from "@/lib/adn-public";
import FlecheRonde from "@/components/pick/FlecheRonde";
import AdnCinema from "@/components/pick/AdnCinema";
import Distinctions from "@/components/pick/Distinctions";
import { clesDebloquees, enregistrerDistinctions, lireValeursTrophees } from "@/lib/distinctions";
import { calculerAdn, universFavoris, type Adn } from "@/lib/adn";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, X, Plus, Trophy, Sparkles, Film, CalendarDays, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchVisibleProfile } from "@/lib/visible-profiles";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyDuos, loadAcceptedFriends, type DuoProfile, type DuoFriendCandidate } from "@/lib/duo-profiles";
import { getLikedMovies } from "@/lib/liked-movies";
import { listFeedbackByType } from "@/lib/feedback";
import { getMyPreferences } from "@/lib/preferences";
import squirrelHappy from "@/assets/happy.webp";
import CartePick from "@/components/pick/CartePick";
import { rareteCarte, type DonneesCarte } from "@/lib/carte-pick";
import { signaturesAdn } from "@/lib/signatures";
import { distinctionsAffichees, tropheeParCle } from "@/lib/distinctions";
import { avatarAffiche } from "@/lib/avatars";
import { usePickPlus } from "@/hooks/use-pick-plus";
import squirrelCritique from "@/assets/critique.webp";
import squirrelExigeant from "@/assets/exigeant.webp";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const poster = (path: string | null, size = "w342") =>
  path ? `${TMDB_IMG}${size}${path}` : null;

const ARCHETYPE_ICONS: Record<string, string> = {
  squirrel_happy:    squirrelHappy,
  squirrel_critique: squirrelCritique,
  squirrel_exigeant: squirrelExigeant,
};

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7C3A"]; // or, argent, bronze

// ─── Composant Podium ────────────────────────────────────────────────────────
const PodiumSlot = ({
  rank, film, onSelect,
}: {
  rank: 1 | 2 | 3;
  film: any | null;
  onSelect: () => void;
}) => {
  const medals = ["🥇", "🥈", "🥉"];
  const heights = ["h-44", "h-36", "h-32"];
  const color = PODIUM_COLORS[rank - 1];

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 flex-1 ${rank === 1 ? "-mt-4" : ""}`}
    >
      {/* Poster */}
      <div className={`relative w-full ${heights[rank - 1]} rounded-2xl overflow-hidden border-2`}
        style={{ borderColor: color + "60" }}>
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
        <span className="absolute top-1.5 left-1.5 text-lg drop-shadow">{medals[rank - 1]}</span>
      </div>

      {/* Titre */}
      <p className="text-[10px] font-sans text-foreground/60 text-center leading-tight line-clamp-2 w-full px-1">
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

  const archetypeImg = dnaArchetype ? ARCHETYPE_ICONS[dnaArchetype] ?? null : null;

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
    <div className="fixed inset-0 bg-background overflow-y-auto scrollbar-hide">
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

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] px-4 pb-3 backdrop-blur-xl border-b border-white/[0.04]"
        style={{ background: "hsl(var(--background)/0.88)" }}>
        <div className="flex items-center gap-3 pt-3">
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
          <h1 className="font-serif text-[20px] text-foreground leading-tight">
            {isOwnProfile ? "Mon ADN Cinéma" : (displayName ? `ADN de ${displayName}` : "Profil cinéphile")}
          </h1>
          {/* Son propre ADN se partage : c'est une carte de visite cinéphile. */}
          {isOwnProfile && user && (
            <button
              type="button"
              onClick={partagerAdn}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-pick-border-hover text-[13px] font-sans font-semibold text-pick-purple-light active:scale-[0.97] transition-transform duration-120 ease-pick"
            >
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              Partager
            </button>
          )}
        </div>
      </div>

      <div className={`px-4 pt-5 flex flex-col gap-6 ${isOwnProfile ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-[calc(9rem+env(safe-area-inset-bottom))]"}`}>

        {/* ── Carte Pick : la carte à collectionner, recto et verso ── */}
        {isOwnProfile && !loading && (
          <button
            type="button"
            onClick={() => setCarteOuverte(true)}
            className="w-full flex items-center gap-3 rounded-pick-lg border border-pick-gold/35 bg-gradient-to-r from-pick-gold/[0.10] via-primary/[0.08] to-transparent px-4 py-3 text-left active:scale-[0.98] transition-transform duration-120 ease-pick"
          >
            <span className="w-9 h-12 shrink-0 rounded-[6px] border border-pick-gold/60 bg-[url('/cartes/or.webp')] bg-cover bg-center shadow-pick-card" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block font-serif text-[17px] text-foreground leading-tight">Ma Carte Pick</span>
              <span className="block text-[12px] font-sans text-pick-text-secondary">Ta carte cinéphile à retourner et partager</span>
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

        {/* ── Skeleton chargement ── */}
        {loading && (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="rounded-3xl border border-white/[0.06] p-5 flex gap-4" style={{ background: "hsl(var(--card)/0.4)" }}>
              <div className="w-20 h-20 rounded-2xl bg-foreground/[0.08] shrink-0" />
              <div className="flex-1 flex flex-col gap-2 pt-1">
                <div className="h-5 w-36 rounded-xl bg-foreground/[0.08]" />
                <div className="flex gap-2 mt-1">
                  <div className="h-4 w-16 rounded-full bg-foreground/[0.06]" />
                  <div className="h-4 w-12 rounded-full bg-foreground/[0.06]" />
                </div>
                <div className="h-3 w-full rounded bg-foreground/[0.06] mt-2" />
                <div className="h-3 w-2/3 rounded bg-foreground/[0.06]" />
              </div>
            </div>
            <div className="rounded-3xl border border-white/[0.06] p-4" style={{ background: "hsl(var(--card)/0.4)" }}>
              <div className="h-3 w-44 rounded bg-foreground/[0.06] mb-4" />
              <div className="h-[220px] rounded-2xl bg-foreground/[0.05] mb-4" />
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className="h-2.5 w-24 rounded bg-foreground/[0.06]" />
                  <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06]" />
                  <div className="h-2.5 w-8 rounded bg-foreground/[0.06]" />
                </div>
              ))}
            </div>
            <div>
              <div className="h-3 w-20 rounded bg-foreground/[0.06] mb-3" />
              <div className="flex items-end gap-3">
                <div className="flex-1 h-36 rounded-2xl bg-foreground/[0.06]" />
                <div className="flex-1 h-44 rounded-2xl bg-foreground/[0.08]" />
                <div className="flex-1 h-32 rounded-2xl bg-foreground/[0.06]" />
              </div>
            </div>
          </div>
        )}
        {!loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden border border-white/[0.06]"
          style={{ background: "linear-gradient(145deg, hsl(var(--primary)/0.25) 0%, hsl(var(--background)/0.6) 50%, hsl(var(--accent)/0.15) 100%)" }}>
          {/* Halo */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.3), transparent 70%)", filter: "blur(30px)" }} />

          <div className="relative p-5 flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/15" />
              ) : archetypeImg ? (
                <img src={archetypeImg} alt={dnaTitle ?? ""}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/30" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
                  <span className="text-3xl">🎬</span>
                </div>
              )}
              {/* Badge archétype */}
              {dnaTitle && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[9px] font-sans font-semibold border"
                  style={{ background: "hsl(var(--primary)/0.25)", borderColor: "hsl(var(--primary)/0.4)", color: "hsl(var(--primary)/0.9)" }}>
                  {dnaTitle}
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="font-serif text-[22px] text-foreground leading-tight truncate">{displayName}</h2>

              {/* Bio */}
              <div className="mt-3">
                {isOwnProfile && editingBio ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      autoFocus value={bioDraft}
                      onChange={e => setBioDraft(e.target.value)}
                      maxLength={120}
                      rows={2}
                      placeholder="En 1-2 phrases, ton rapport au cinéma…"
                      className="w-full bg-white/[0.06] border border-white/[0.12] rounded-xl px-3 py-2 text-[12px] font-sans text-foreground/80 placeholder:text-foreground/45 focus:outline-none focus:border-primary/40 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingBio(false); setBioDraft(bio); }}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 active:scale-[0.97] transition-colors"><X className="w-3.5 h-3.5 text-foreground/40" /></button>
                      <button onClick={saveBio} disabled={savingBio}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary/20 border border-primary/30 active:scale-[0.97] transition-colors">
                        <Check className="w-3.5 h-3.5 text-primary" />
                      </button>
                    </div>
                  </div>
                ) : isOwnProfile ? (
                  <button onClick={() => { setBioDraft(bio); setEditingBio(true); }}
                    className="flex items-start gap-1.5 group text-left w-full">
                    <p className={`text-[12px] font-sans leading-snug flex-1 ${bio ? "text-foreground/60" : "text-foreground/45 italic"}`}>
                      {bio || "Ajoute une courte description…"}
                    </p>
                    <Pencil className="w-3 h-3 text-foreground/40 group-hover:text-foreground/50 shrink-0 mt-0.5 transition-colors" />
                  </button>
                ) : bio ? (
                  <p className="text-[12px] font-sans leading-snug text-foreground/60">{bio}</p>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {/* ══ 2. ADN CINÉMA ══ */}
        {isOwnProfile ? (
          <AdnCinema
            adn={adn}
            adnRecent={adnRecent}
            narrative={narrative}
            genres={univers}
            titre="Ton ADN cinéma"
            archetype={dnaArchetype || dnaTitle}
            confiance={confiance}
          />
        ) : adnAutre && adnAutre.niveau !== "aucun" && (adnAutre.traits || adnAutre.univers.length > 0) ? (
          <AdnCinema
            adn={adnAutre.traits}
            adnRecent={null}
            narrative={adnAutre.narrative}
            genres={adnAutre.univers}
            titre={`L'ADN cinéma de ${displayName || "ce Picker"}`}
            archetype={adnAutre.archetype}
            chiffresMasques={adnAutre.niveau === "soiree"}
            comparaison={comparaison}
          />
        ) : adnAutre ? (
          <p className="rounded-pick-lg border border-pick-border bg-pick-surface/90 p-4 text-[13px] font-sans text-pick-text-secondary">
            {adnAutre.niveau === "aucun"
              ? `${displayName || "Cette personne"} n'a pas rendu son ADN cinéma visible.`
              : `${displayName || "Cette personne"} n'a pas encore d'ADN cinéma : il apparaîtra quand elle aura ouvert le sien.`}
          </p>
        ) : null}

        {!loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-3.5 h-3.5 text-amber-400/70" />
            <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Mon podium</p>
          </div>
          <div className="flex items-end gap-3">
            {/* Ordre visuel podium : 🥈 | 🥇 | 🥉 */}
            <PodiumSlot rank={2} film={podiumFilms[1]} onSelect={isOwnProfile ? () => setSelectingRank(2) : () => {}} />
            <PodiumSlot rank={1} film={podiumFilms[0]} onSelect={isOwnProfile ? () => setSelectingRank(1) : () => {}} />
            <PodiumSlot rank={3} film={podiumFilms[2]} onSelect={isOwnProfile ? () => setSelectingRank(3) : () => {}} />
          </div>
        </motion.div>
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
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-primary/25 bg-primary/10 active:scale-[0.97] transition-transform"
            >
              <CalendarDays className="w-4 h-4 text-primary" strokeWidth={1.8} />
              <span className="text-[13px] font-sans font-semibold text-primary">Soirée ciné</span>
            </button>
            <button
              onClick={() => navigate("/app", { state: { friendId: targetUserId, friendName: displayName, mode: "duo" } })}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent active:scale-[0.97] transition-transform"
            >
              <Film className="w-4 h-4 text-primary-foreground" strokeWidth={1.8} />
              <span className="text-[13px] font-sans font-semibold text-primary-foreground">Regarder ensemble</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CinemaDNAPage;
