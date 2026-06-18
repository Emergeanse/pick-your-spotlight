import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pencil, Check, X, Plus, Trophy, Heart, Users, Sparkles } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyDuos, loadAcceptedFriends, type DuoProfile, type DuoFriendCandidate } from "@/lib/duo-profiles";
import { getLikedMovies } from "@/lib/liked-movies";
import { listFeedbackByType } from "@/lib/feedback";
import { getMyPreferences } from "@/lib/preferences";
import squirrelHappy from "@/assets/Happy.png";
import squirrelCritique from "@/assets/Critique.png";
import squirrelExigeant from "@/assets/Exigeant.png";

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

  // Radar
  const [genreStats, setGenreStats] = useState<{ genre: string; count: number }[]>([]);

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
  }, [user, searchParams]);

  const load = async () => {
    if (!user) return;
    const tid = searchParams.get("userId") || user.id;
    const isOwn = !searchParams.get("userId") || searchParams.get("userId") === user.id;
    setLoading(true);
    try {
      // ── Profil & ADN (commun own + friend) ───────────────────────────────
      const [profileRes, dnaRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", tid).single(),
        supabase.from("cinematic_profiles" as any).select("personality_title,dna_archetype").eq("user_id", tid).maybeSingle(),
      ]);

      const p = profileRes.data as any;
      setProfile(p);
      setDisplayName(p?.display_name || (isOwn ? user.email?.split("@")[0] : "") || "");
      setAvatarUrl(p?.avatar_url || null);
      setBio(p?.bio || "");

      const savedIds: (number | null)[] = p?.podium_film_ids ?? [null, null, null];
      setPodiumIds([savedIds[0] ?? null, savedIds[1] ?? null, savedIds[2] ?? null]);

      if (dnaRes.data) {
        setDnaTitle((dnaRes.data as any).personality_title || null);
        setDnaArchetype((dnaRes.data as any).dna_archetype || null);
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

  const radarData = useMemo(() => {
    if (genreStats.length < 3) return [];
    const top = genreStats.slice(0, 7);
    const max = top[0]?.count || 1;
    return top.map(gs => ({
      genre: gs.genre.length > 11 ? gs.genre.slice(0, 10) + "…" : gs.genre,
      value: Math.round((gs.count / max) * 100),
    }));
  }, [genreStats]);

  const podiumFilms = useMemo(() => {
    return podiumIds.map(id =>
      id != null ? lovedFilms.find(f => (f.tmdb_id ?? f.id) === id) ?? null : null
    );
  }, [podiumIds, lovedFilms]);

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
          <button onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground/60" />
          </button>
          <h1 className="font-serif text-[20px] text-foreground leading-tight">
            {isOwnProfile ? "Mon ADN Cinéma" : (displayName ? `ADN de ${displayName}` : "Profil cinéphile")}
          </h1>
        </div>
      </div>

      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] px-4 pt-5 flex flex-col gap-6">

        {/* ══ 1. HERO CARD ══ */}
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

              {/* Stats chips */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {lovedCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/20 text-[10px] font-sans text-rose-400">
                    <Heart className="w-2.5 h-2.5" />{lovedCount} adorés
                  </span>
                )}
                {isOwnProfile && duos.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20 text-[10px] font-sans text-violet-400">
                    💑 {duos.length} duo{duos.length > 1 ? "s" : ""}
                  </span>
                )}
                {seenCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/20 text-[10px] font-sans text-primary/80">
                    🎬 {seenCount} vus
                  </span>
                )}
              </div>

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
                        className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-3.5 h-3.5 text-foreground/40" /></button>
                      <button onClick={saveBio} disabled={savingBio}
                        className="p-1.5 rounded-lg bg-primary/20 border border-primary/30">
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

        {/* ══ 2. EMPREINTE CINÉMATOGRAPHIQUE (RADAR) ══ */}
        {radarData.length >= 3 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="rounded-3xl border border-white/[0.06] overflow-hidden"
            style={{ background: "hsl(var(--card)/0.6)" }}>
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary/50" />
              <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Empreinte cinématographique</p>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="hsl(var(--foreground)/0.06)" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="genre"
                  tick={{ fill: "hsl(var(--foreground)/0.45)", fontSize: 10, fontFamily: "var(--font-sans)" }}
                  tickLine={false} />
                <Radar name="Goûts" dataKey="value"
                  stroke="hsl(var(--primary)/0.8)"
                  fill="hsl(var(--primary)/0.18)"
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
              </RadarChart>
            </ResponsiveContainer>

            {/* Barres genres top 4 */}
            <div className="px-4 pb-4 flex flex-col gap-1.5">
              {genreStats.slice(0, 4).map((gs, i) => {
                const max = genreStats[0].count;
                const pct = Math.round((gs.count / max) * 100);
                return (
                  <div key={gs.genre} className="flex items-center gap-2">
                    <p className="text-[10px] font-sans text-foreground/50 w-28 truncate shrink-0">{gs.genre}</p>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: `hsl(var(--primary)/${0.9 - i * 0.15})` }} />
                    </div>
                    <p className="text-[10px] font-sans text-foreground/45 w-8 text-right shrink-0">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══ 3. MON PODIUM ══ */}
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

        {/* ══ 4. FILMS ADORÉS ══ */}
        {lovedFilms.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-rose-400/70" />
                <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">{isOwnProfile ? "Films adorés" : "Films adorés"}</p>
              </div>
              <span className="text-[10px] font-sans text-foreground/45">{lovedCount > 0 ? lovedCount : lovedFilms.length} films</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
              {lovedFilms.slice(0, 20).map((film: any) => {
                const id = film.tmdb_id ?? film.id;
                return (
                  <div key={id} className="shrink-0 w-20">
                    <div className="w-20 h-[120px] rounded-xl overflow-hidden border border-white/[0.07]">
                      {film.poster_path ? (
                        <img src={poster(film.poster_path) ?? ""} alt={film.title}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                          <span className="text-foreground/40 text-xs">?</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[8.5px] font-sans text-foreground/40 mt-1 line-clamp-1 text-center">{film.title}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══ 5. CERCLE SOCIAL ══ */}
        {(duos.length > 0 || friends.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-violet-400/70" />
              <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Mon cercle cinéphile</p>
            </div>

            {/* Duos */}
            {duos.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {duos.map(duo => {
                  const partnerName = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                  const partnerAvatar = duo.user1_id === user?.id ? duo.user2_avatar_url : duo.user1_avatar_url;
                  const affinity = duo.affinity_score ?? 0;
                  const hue = affinity > 75 ? "emerald" : affinity > 50 ? "primary" : "amber";
                  const hueClass = hue === "emerald" ? "bg-emerald-400" : hue === "amber" ? "bg-amber-400" : "bg-primary";
                  return (
                    <button key={duo.id} onClick={() => navigate("/app/duo")}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/[0.06] text-left transition-all hover:border-primary/20"
                      style={{ background: "hsl(var(--card)/0.5)" }}>
                      {/* Avatars superposés */}
                      <div className="relative shrink-0 w-10 h-10">
                        {partnerAvatar ? (
                          <img src={partnerAvatar} alt={partnerName ?? ""}
                            className="w-10 h-10 rounded-full object-cover border-2 border-background" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-violet-500/20 border-2 border-background flex items-center justify-center">
                            <span className="text-sm font-semibold text-violet-400">
                              {(partnerName ?? "?")[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 text-[11px]">💑</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans font-semibold text-[13px] text-foreground truncate">{duo.duo_name}</p>
                        <p className="font-sans text-[11px] text-foreground/45 truncate">avec {partnerName ?? "…"}</p>
                        {/* Barre affinité */}
                        {affinity > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className={`h-full rounded-full ${hueClass}`}
                                style={{ width: `${affinity}%`, opacity: 0.75 }} />
                            </div>
                            <span className="text-[10px] font-sans text-foreground/40 shrink-0">{affinity}%</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Amis */}
            {friends.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {friends.map(friend => (
                  <button key={friend.id}
                    onClick={() => navigate(`/app/adn?userId=${friend.id}`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.06] hover:border-primary/20 transition-colors"
                    style={{ background: "hsl(var(--card)/0.5)" }}>
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-primary">
                        {friend.displayName[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[11px] font-sans text-foreground/60">{friend.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default CinemaDNAPage;
