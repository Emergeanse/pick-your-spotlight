import { useEffect, useState, useCallback } from "react";
import duoBg from "@/assets/duo-background.png";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Copy, Check, Trash2, Pencil, ChevronRight,
  Heart, Loader2, Share2, ArrowLeft, Clock, RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createDuo, createDuoWithFriend, fetchMyDuos, fetchPendingDuos,
  updateDuoName, deleteDuo, loadAcceptedFriends, recalculateDuo, fetchDuoSharedMovies,
  type DuoProfile, type DuoFriendCandidate, type SharedMovie,
} from "@/lib/duo-profiles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/* ── Petit utilitaire affinité → couleur ── */
function affinityColor(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-primary";
  return "text-foreground/50";
}

/* ── Badge genre ── */
const GenreBadge = ({ label, variant = "neutral" }: { label: string; variant?: "common" | "solo" | "neutral" | "excluded" }) => {
  const styles: Record<string, string> = {
    common: "bg-primary/15 border-primary/25 text-primary",
    solo: "bg-foreground/[0.06] border-border/20 text-foreground/55",
    excluded: "bg-destructive/10 border-destructive/20 text-destructive/70 line-through",
    neutral: "bg-foreground/[0.06] border-border/15 text-foreground/50",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-sans font-medium ${styles[variant]}`}>
      {label}
    </span>
  );
};

/* ── Carte duo dans la liste ── */
const DuoCard = ({ duo, currentUserId, onOpen }: {
  duo: DuoProfile; currentUserId: string;
  onOpen: () => void;
}) => {
  const partner = duo.user1_id === currentUserId ? duo.user2_display_name : duo.user1_display_name;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full bg-foreground/[0.04] border border-border/40 rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onOpen}
    >
      <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
        <Heart className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans font-semibold text-foreground text-sm truncate">{duo.duo_name}</p>
        <p className="font-sans text-foreground/40 text-xs truncate">avec {partner ?? "—"}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-sans font-bold text-sm ${affinityColor(duo.affinity_score)}`}>
          {duo.affinity_score}%
        </span>
        <ChevronRight className="w-4 h-4 text-foreground/25" />
      </div>
    </motion.div>
  );
};

/* ── Carte duo pending ── */
const PendingDuoCard = ({ duo, onShare, onDelete }: {
  duo: DuoProfile; onShare: () => void; onDelete: () => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="w-full bg-foreground/[0.03] border border-border/30 border-dashed rounded-2xl px-4 py-4 flex items-center gap-3"
  >
    <div className="w-10 h-10 rounded-full bg-foreground/8 flex items-center justify-center shrink-0">
      <Clock className="w-4 h-4 text-foreground/30" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-sans font-semibold text-foreground/70 text-sm truncate">{duo.duo_name}</p>
      <p className="font-sans text-foreground/35 text-xs">En attente d'acceptation</p>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={onShare} className="p-1.5 rounded-lg hover:bg-foreground/8 transition-colors text-foreground/40 hover:text-primary">
        <Share2 className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-foreground/25 hover:text-destructive">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </motion.div>
);

/* ── Vue détail d'un duo ── */
const IMG = "https://image.tmdb.org/t/p/w154";

/* ── Ligne de posters ── */
const MovieRow = ({ movies, label }: { movies: SharedMovie[]; label: string }) => {
  if (movies.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {movies.slice(0, 10).map(m => (
          <div key={m.tmdb_id} className="shrink-0 w-14 flex flex-col gap-1">
            <div className="w-14 h-20 rounded-lg overflow-hidden bg-foreground/[0.06]">
              {m.poster_path
                ? <img src={`${IMG}${m.poster_path}`} alt={m.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-foreground/20 text-[10px] text-center px-1 leading-tight">{m.title}</div>
              }
            </div>
            <p className="text-[9px] text-foreground/40 font-sans leading-tight line-clamp-2 text-center">{m.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Vue détail d'un duo ── */
const DuoDetail = ({ duo: initialDuo, currentUserId, onBack, onRename, onDelete }: {
  duo: DuoProfile; currentUserId: string;
  onBack: () => void; onRename: (name: string) => void; onDelete: () => void;
}) => {
  const [duo, setDuo] = useState(initialDuo);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(duo.duo_name);
  const [recalculating, setRecalculating] = useState(false);
  const [sharedMovies, setSharedMovies] = useState<{ liked: SharedMovie[]; watchlist: SharedMovie[] } | null>(null);
  const partner = duo.user1_id === currentUserId ? duo.user2_display_name : duo.user1_display_name;
  const myGenres = duo.user1_id === currentUserId ? duo.user1_genres : duo.user2_genres;
  const partnerGenres = duo.user1_id === currentUserId ? duo.user2_genres : duo.user1_genres;
  const soloMyGenres = myGenres.filter(g => !duo.common_genres.includes(g));
  const soloPartnerGenres = partnerGenres.filter(g => !duo.common_genres.includes(g));

  useEffect(() => {
    if (duo.user2_id) {
      fetchDuoSharedMovies(duo.user1_id, duo.user2_id).then(setSharedMovies);
    }
  }, [duo.id, duo.user1_id, duo.user2_id]);

  const saveRename = () => { setEditing(false); if (name.trim()) onRename(name.trim()); };

  const handleRecalculate = async () => {
    setRecalculating(true);
    const updated = await recalculateDuo(duo);
    if (updated) setDuo(updated);
    setRecalculating(false);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-foreground/8 transition-colors text-foreground/50">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={e => e.key === "Enter" && saveRename()}
              className="w-full bg-transparent font-serif text-xl text-foreground border-b border-primary/40 outline-none pb-0.5"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 group">
              <h2 className="font-serif text-xl text-foreground truncate">{duo.duo_name}</h2>
              <Pencil className="w-3.5 h-3.5 text-foreground/25 group-hover:text-primary transition-colors" />
            </button>
          )}
          <p className="text-foreground/40 font-sans text-xs mt-0.5">avec {partner ?? "—"}</p>
        </div>
        <button onClick={onDelete} className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-foreground/25 hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Score affinité */}
      <div className="bg-foreground/[0.04] border border-border/15 rounded-2xl px-5 py-5 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/25 flex items-center justify-center shrink-0">
          <Heart className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className={`font-serif text-3xl font-bold ${affinityColor(duo.affinity_score)}`}>{duo.affinity_score}%</p>
          <p className="text-foreground/50 font-sans text-xs mt-0.5">d'affinité cinématographique</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground/[0.06] hover:bg-foreground/10 border border-border/15 hover:border-primary/25 transition-all text-foreground/50 hover:text-foreground disabled:opacity-40"
        >
          {recalculating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
          <span className="font-sans text-xs font-medium">Recalc.</span>
        </button>
      </div>

      {/* Genres en commun */}
      {duo.common_genres.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
            Vous aimez tous les deux
          </p>
          <div className="flex flex-wrap gap-1.5">
            {duo.common_genres.map(g => <GenreBadge key={g} label={g} variant="common" />)}
          </div>
        </div>
      )}

      {/* Genres solo */}
      {(soloMyGenres.length > 0 || soloPartnerGenres.length > 0) && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
            Ce qui vous distingue
          </p>
          {soloMyGenres.length > 0 && (
            <div className="mb-2">
              <p className="text-foreground/35 font-sans text-xs mb-1">Tes genres</p>
              <div className="flex flex-wrap gap-1.5">
                {soloMyGenres.map(g => <GenreBadge key={g} label={g} variant="solo" />)}
              </div>
            </div>
          )}
          {soloPartnerGenres.length > 0 && (
            <div>
              <p className="text-foreground/35 font-sans text-xs mb-1">Ses genres</p>
              <div className="flex flex-wrap gap-1.5">
                {soloPartnerGenres.map(g => <GenreBadge key={g} label={g} variant="solo" />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clusters communs */}
      {duo.top_clusters.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
            Vibe commune
          </p>
          <div className="flex flex-wrap gap-1.5">
            {duo.top_clusters.map(c => <GenreBadge key={c} label={c} variant="common" />)}
          </div>
        </div>
      )}

      {/* Genres exclus */}
      {duo.excluded_genres.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
            Exclus du duo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {duo.excluded_genres.map(g => <GenreBadge key={g} label={g} variant="excluded" />)}
          </div>
        </div>
      )}

      {/* Films en commun — toujours visible */}
      <div className="mt-2">
        <div className="h-px bg-border/10 mb-4" />
        {sharedMovies === null ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-foreground/25" />
            <p className="text-foreground/30 font-sans text-xs">Chargement des films en commun…</p>
          </div>
        ) : sharedMovies.liked.length === 0 && sharedMovies.watchlist.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-foreground/30 font-sans text-xs">Aucun film en commun pour l'instant.</p>
            <p className="text-foreground/20 font-sans text-[11px] mt-1">Likez ou ajoutez des films à votre liste pour voir les points communs.</p>
          </div>
        ) : (
          <>
            <MovieRow movies={sharedMovies.liked} label="Vous avez tous les deux aimé" />
            <MovieRow movies={sharedMovies.watchlist} label="Dans vos deux listes" />
          </>
        )}
      </div>
    </motion.div>
  );
};

/* ── Flow création ── */
const CreateFlow = ({ userId, displayName, onCreated, onCancel }: {
  userId: string; displayName: string;
  onCreated: (duo: DuoProfile, url?: string) => void; onCancel: () => void;
}) => {
  type Step = "choose" | "name" | "share";
  const [step, setStep] = useState<Step>("choose");
  const [friends, setFriends] = useState<DuoFriendCandidate[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<DuoFriendCandidate | null>(null);
  const [duoName, setDuoName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [createdDuo, setCreatedDuo] = useState<DuoProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAcceptedFriends(userId).then(f => { setFriends(f); setLoadingFriends(false); });
  }, [userId]);

  const handleSelectFriend = (friend: DuoFriendCandidate) => {
    setSelectedFriend(friend);
    setDuoName(`${displayName} & ${friend.displayName}`);
    setStep("name");
  };

  const handleInviteByLink = () => {
    setSelectedFriend(null);
    setDuoName("");
    setStep("name");
  };

  const handleCreate = async () => {
    if (!duoName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      if (selectedFriend) {
        // Création directe avec un ami → duo actif immédiatement
        const duo = await createDuoWithFriend(userId, displayName, selectedFriend.id, selectedFriend.displayName, duoName.trim());
        if (duo) onCreated(duo);
        else setError("Erreur lors de la création. Réessaie.");
      } else {
        // Lien d'invitation
        const result = await createDuo(userId, displayName, duoName.trim());
        if (result) { setInviteUrl(result.inviteUrl); setCreatedDuo(result.duo); setStep("share"); }
        else setError("Erreur lors de la création. Réessaie.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur inattendue.");
    } finally {
      setCreating(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Étape "share" : lien d'invitation ── */
  if (step === "share" && createdDuo) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-3">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-serif text-xl text-foreground">En attente…</h3>
          <p className="text-foreground/50 font-sans text-sm mt-1">Partage ce lien à ton ami pour activer <span className="text-primary">«&nbsp;{createdDuo.duo_name}&nbsp;»</span></p>
        </div>
        <div className="bg-foreground/[0.04] border border-border/15 rounded-xl px-3 py-3 flex items-center gap-2">
          <p className="flex-1 font-mono text-xs text-foreground/60 truncate">{inviteUrl}</p>
          <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-foreground/40" />}
          </button>
        </div>
        <Button className="w-full" onClick={() => onCreated(createdDuo, inviteUrl)}>Terminé</Button>
      </motion.div>
    );
  }

  /* ── Étape "name" : nom du duo ── */
  if (step === "name") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("choose")} className="p-2 rounded-xl hover:bg-foreground/8 transition-colors text-foreground/40">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="font-serif text-xl text-foreground">Nom du duo</h3>
            {selectedFriend && (
              <p className="text-foreground/40 font-sans text-xs mt-0.5">avec {selectedFriend.displayName}</p>
            )}
          </div>
        </div>
        <input
          autoFocus
          placeholder="Ex: Soirée Ciné, Alice & Bob…"
          value={duoName}
          onChange={e => setDuoName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()}
          className="w-full bg-foreground/[0.04] border border-border/20 rounded-xl px-4 py-3 font-sans text-sm text-foreground placeholder:text-foreground/25 outline-none focus:border-primary/40 transition-colors"
        />
        {error && <p className="text-destructive text-xs font-sans">{error}</p>}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Annuler</Button>
          <Button className="flex-1" onClick={handleCreate} disabled={!duoName.trim() || creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedFriend ? "Créer le duo" : "Générer le lien"}
          </Button>
        </div>
      </motion.div>
    );
  }

  /* ── Étape "choose" : sélection ami ou lien ── */
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-2 rounded-xl hover:bg-foreground/8 transition-colors text-foreground/40">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="font-serif text-xl text-foreground">Nouveau duo</h3>
          <p className="text-foreground/40 font-sans text-xs mt-0.5">Avec qui ?</p>
        </div>
      </div>

      {/* Liste d'amis */}
      {loadingFriends ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-foreground/30" /></div>
      ) : friends.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold">Mes amis</p>
          {friends.map(friend => (
            <button
              key={friend.id}
              onClick={() => handleSelectFriend(friend)}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-foreground/[0.04] border border-border/15 hover:border-primary/30 hover:bg-foreground/[0.07] transition-all text-left"
            >
              <Avatar className="h-9 w-9 ring-1 ring-white/10 shrink-0">
                {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />}
                <AvatarFallback className="bg-primary/20 text-foreground text-xs font-bold">
                  {friend.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 font-sans font-medium text-sm text-foreground">{friend.displayName}</span>
              <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-foreground/35 font-sans text-sm text-center py-4">Aucun ami dans ta liste pour l'instant.</p>
      )}

      {/* Séparateur + option lien */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-border/15" />
        <span className="text-foreground/25 font-sans text-xs">ou</span>
        <div className="flex-1 h-px bg-border/15" />
      </div>
      <button
        onClick={handleInviteByLink}
        className="flex items-center gap-3 px-3 py-3 rounded-2xl border border-dashed border-border/20 hover:border-primary/30 hover:bg-foreground/[0.04] transition-all text-left"
      >
        <div className="w-9 h-9 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0">
          <Share2 className="w-4 h-4 text-foreground/40" />
        </div>
        <div className="flex-1">
          <p className="font-sans font-medium text-sm text-foreground/70">Inviter par lien</p>
          <p className="font-sans text-xs text-foreground/35">Partager un lien d'invitation</p>
        </div>
        <ChevronRight className="w-4 h-4 text-foreground/20 shrink-0" />
      </button>
    </motion.div>
  );
};

/* ══════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════ */
export default function DuoPage() {
  const { user, isReady } = useAuth();
  const location = useLocation();

  const [duos, setDuos] = useState<DuoProfile[]>([]);
  const [pendingDuos, setPendingDuos] = useState<DuoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDuo, setSelectedDuo] = useState<DuoProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const [active, pending] = await Promise.all([
      fetchMyDuos(user.id),
      fetchPendingDuos(user.id),
    ]);
    setDuos(active);
    setPendingDuos(pending);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isReady || !user) return;
    load();
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? user.email?.split("@")[0] ?? "Moi"));

    // Ouvrir directement le duo si on revient depuis JoinDuo
    const state = location.state as any;
    if (state?.newDuoId) {
      load().then(() => {
        setDuos(prev => {
          const found = prev.find(d => d.id === state.newDuoId);
          if (found) setSelectedDuo(found);
          return prev;
        });
      });
    }
  }, [isReady, user, load, location.state]);

  const handleRename = async (duoId: string, newName: string) => {
    await updateDuoName(duoId, newName);
    setDuos(prev => prev.map(d => d.id === duoId ? { ...d, duo_name: newName } : d));
    setSelectedDuo(prev => prev?.id === duoId ? { ...prev, duo_name: newName } : prev);
  };

  const handleDelete = async (duoId: string) => {
    await deleteDuo(duoId);
    setDuos(prev => prev.filter(d => d.id !== duoId));
    setPendingDuos(prev => prev.filter(d => d.id !== duoId));
    if (selectedDuo?.id === duoId) setSelectedDuo(null);
  };

  const handleShare = (duo: DuoProfile) => {
    const url = `${window.location.origin}/join-duo/${duo.invite_code}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  if (!isReady || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Fond d'écran */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${duoBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background/92" />

      {/* Contenu */}
      <div className="relative z-10 pb-28 px-4 pt-[calc(4.5rem+env(safe-area-inset-top))] max-w-lg mx-auto w-full">
      <AnimatePresence mode="wait">
        {/* ── Vue détail ── */}
        {selectedDuo && (
          <DuoDetail
            key="detail"
            duo={selectedDuo}
            currentUserId={user!.id}
            onBack={() => setSelectedDuo(null)}
            onRename={name => handleRename(selectedDuo.id, name)}
            onDelete={() => handleDelete(selectedDuo.id)}
          />
        )}

        {/* ── Flow création ── */}
        {!selectedDuo && creating && (
          <CreateFlow
            key="create"
            userId={user!.id}
            displayName={displayName}
            onCreated={(duo) => {
              setDuos(prev => [...prev, duo]);
              setPendingDuos(prev => [...prev, duo]);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* ── Liste ── */}
        {!selectedDuo && !creating && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="font-serif text-2xl text-foreground">Mes Duos</h1>
                <p className="text-foreground/40 font-sans text-xs mt-0.5">Profils fusionnés avec tes amis</p>
              </div>
              <button
                onClick={() => setCreating(true)}
                className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center hover:bg-primary/25 transition-colors"
              >
                <Plus className="w-4 h-4 text-primary" />
              </button>
            </div>

            {/* Duos actifs */}
            {duos.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold">
                  Duos actifs
                </p>
                <AnimatePresence>
                  {duos.map(duo => (
                    <DuoCard
                      key={duo.id}
                      duo={duo}
                      currentUserId={user!.id}
                      onOpen={() => setSelectedDuo(duo)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Duos pending */}
            {pendingDuos.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold">
                  En attente
                </p>
                <AnimatePresence>
                  {pendingDuos.map(duo => (
                    <PendingDuoCard
                      key={duo.id}
                      duo={duo}
                      onShare={() => handleShare(duo)}
                      onDelete={() => handleDelete(duo.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Empty state */}
            {duos.length === 0 && pendingDuos.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 pt-16 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-foreground/[0.04] border border-border/15 flex items-center justify-center">
                  <Users className="w-7 h-7 text-foreground/20" />
                </div>
                <div className="space-y-1">
                  <p className="font-sans font-medium text-foreground/60">Aucun duo pour l'instant</p>
                  <p className="font-sans text-foreground/35 text-sm">Fusionne ton profil avec celui d'un ami pour découvrir vos goûts communs.</p>
                </div>
                <Button onClick={() => setCreating(true)} className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer mon premier duo
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
