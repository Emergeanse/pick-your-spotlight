import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Check, UserPlus, X, Plus, QrCode, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface Friend {
  id: string;
  displayName: string;
  friendCode: string;
  avatarUrl?: string | null;
}

interface Guest {
  id: string;
  name: string;
  age?: number;
  gender?: "homme" | "femme" | "autre";
  favoriteGenres: string[];
}

const GENRE_OPTIONS = [
  "Action", "Aventure", "Animation", "Comédie", "Crime", "Documentaire",
  "Drame", "Famille", "Fantastique", "Horreur", "Romance", "Science-Fiction", "Thriller",
];

interface WhoStepProps {
  friends: Friend[];
  selectedFriendIds: Set<string>;
  guests: Guest[];
  sessionInviteCode: string | null;
  sessionInviteUrl: string;
  realtimeMembers: { id: string; name: string }[];
  onToggleFriend: (id: string) => void;
  onAddGuest: (guest: Guest) => void;
  onRemoveGuest: (id: string) => void;
  onContinue: () => void;
  onShareSession: () => void;
  onCopyLink: () => void;
  onNavigateToProfile: () => void;
}

const WhoStep = ({
  friends, selectedFriendIds, guests, sessionInviteCode, sessionInviteUrl,
  realtimeMembers, onToggleFriend, onAddGuest, onRemoveGuest, onContinue,
  onShareSession, onCopyLink, onNavigateToProfile,
}: WhoStepProps) => {
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestAge, setGuestAge] = useState("");
  const [guestGender, setGuestGender] = useState<"homme" | "femme" | "autre" | "">("");
  const [guestGenres, setGuestGenres] = useState<Set<string>>(new Set());

  const selectedCount = selectedFriendIds.size + guests.length + 1;

  const toggleGuestGenre = (genre: string) => {
    setGuestGenres(prev => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else if (next.size < 5) next.add(genre);
      return next;
    });
  };

  const handleAddGuest = () => {
    if (!guestName.trim()) { toast.info("Donne un prénom à ton invité"); return; }
    onAddGuest({
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: guestName.trim(),
      age: guestAge ? parseInt(guestAge) : undefined,
      gender: guestGender || undefined,
      favoriteGenres: [...guestGenres],
    });
    setGuestName("");
    setGuestAge("");
    setGuestGender("");
    setGuestGenres(new Set());
    setShowGuestForm(false);
  };

  return (
    <motion.div key="who" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      className="h-full overflow-y-auto pt-16 pb-[calc(6rem+env(safe-area-inset-bottom))] px-5"
    >
      <div className="max-w-lg mx-auto">
        {/* Conversational header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 mt-4">
          <PickCharacter mood="wave" size="sm" animate />
          <div className="mt-4 bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/10 relative">
            <div className="absolute -top-2 left-8 w-4 h-4 bg-card/60 border-l border-t border-border/10 rotate-45" />
            <p className="text-foreground text-[15px] font-sans leading-relaxed">
              Super, une soirée ciné à plusieurs ! 🍿<br />
              <span className="text-foreground/60">Qui sera là ce soir ?</span>
            </p>
          </div>
        </motion.div>

        {/* Current user */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/15 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-sm font-sans font-bold text-primary">Toi</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-sans font-semibold text-foreground">Toi</p>
            <p className="text-foreground/30 text-[10px] font-sans">Organisateur</p>
          </div>
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>

        {/* Friends list */}
        {friends.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-foreground/50 text-sm font-sans mb-1">Pas encore d'amis sur Pick</p>
            <p className="text-foreground/30 text-xs font-sans mb-4">Partage ton code ami pour commencer</p>
            <Button onClick={onNavigateToProfile} variant="outline" className="rounded-xl font-sans border-primary/30 text-primary">
              Ajouter des amis
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-2 mb-4">
            {friends.map((f, i) => {
              const selected = selectedFriendIds.has(f.id);
              return (
                <motion.button
                  key={f.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onToggleFriend(f.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                    selected
                      ? "bg-primary/8 border-primary/25 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.2)]"
                      : "bg-card/40 border-border/10 hover:border-border/25"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all overflow-hidden ${
                    selected ? "bg-primary/15 border-primary/30" : "bg-muted/50 border-border/20"
                  }`}>
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`text-sm font-sans font-bold ${selected ? "text-primary" : "text-muted-foreground"}`}>
                        {f.displayName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-sans font-medium transition-colors ${selected ? "text-foreground" : "text-foreground/70"}`}>{f.displayName}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selected ? "border-primary bg-primary" : "border-border/30"
                  }`}>
                    {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Invitation Card */}
        {sessionInviteCode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-card/60 backdrop-blur-sm border border-primary/15 p-4 mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-4 h-4 text-primary" />
              <p className="text-sm font-sans font-semibold text-foreground">Invite tes potes</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-white rounded-xl p-2 shrink-0">
                <QRCodeSVG value={sessionInviteUrl} size={88} level="M" />
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-foreground/40 text-[11px] font-sans leading-relaxed">
                  Scanne le QR ou partage le lien pour inviter des gens à ta soirée ciné.
                </p>
                <div className="flex gap-2">
                  <button onClick={onShareSession} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-sans font-medium hover:bg-primary/15 transition-all">
                    <Share2 className="w-3.5 h-3.5" />Partager
                  </button>
                  <button onClick={onCopyLink} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/30 border border-border/15 text-foreground/60 text-xs font-sans font-medium hover:bg-muted/50 transition-all">
                    <Copy className="w-3.5 h-3.5" />Copier le lien
                  </button>
                </div>
                <p className="text-foreground/25 text-[10px] font-sans text-center font-mono tracking-wider">{sessionInviteCode}</p>
              </div>
            </div>
            {realtimeMembers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/10 space-y-1.5">
                <p className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-widest">Ont rejoint</p>
                {realtimeMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{m.name[0]}</span>
                    </div>
                    <p className="text-sm font-sans text-foreground">{m.name}</p>
                    <Check className="w-3.5 h-3.5 text-primary ml-auto" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Guests */}
        <div className="mt-5">
          <p className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest mb-3">Invités (sans compte)</p>
          {guests.map((g) => (
            <div key={g.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-accent/5 border border-accent/15 mb-2">
              <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center">
                <span className="text-sm font-sans font-bold text-accent-foreground/70">{g.name[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-medium text-foreground">{g.name}</p>
                <p className="text-foreground/30 text-[10px] font-sans truncate">
                  {[g.age ? `${g.age} ans` : null, g.gender, g.favoriteGenres.length > 0 ? g.favoriteGenres.slice(0, 2).join(", ") : null].filter(Boolean).join(" · ") || "Invité"}
                </p>
              </div>
              <button onClick={() => onRemoveGuest(g.id)} className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center hover:bg-destructive/10 transition-colors">
                <X className="w-3 h-3 text-foreground/30" />
              </button>
            </div>
          ))}

          <AnimatePresence mode="wait">
            {!showGuestForm ? (
              <motion.button
                key="add-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGuestForm(true)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-border/20 hover:border-primary/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-muted/20 border border-border/15 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                  <UserPlus className="w-4 h-4 text-foreground/30 group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-sans font-medium text-foreground/50 group-hover:text-foreground/70 transition-colors">Ajouter un invité</p>
                  <p className="text-foreground/25 text-[10px] font-sans">Quelqu'un sans compte Pick</p>
                </div>
              </motion.button>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/15 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-sans font-semibold text-foreground">Nouvel invité</p>
                  <button onClick={() => setShowGuestForm(false)} className="text-foreground/30 hover:text-foreground/60 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Prénom *</label>
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Ex: Sarah" maxLength={30}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border/15 text-foreground text-sm font-sans placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Âge</label>
                    <input type="number" value={guestAge} onChange={e => setGuestAge(e.target.value)} placeholder="25" min={5} max={99}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/60 border border-border/15 text-foreground text-sm font-sans placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Genre</label>
                    <div className="flex gap-1.5">
                      {(["homme", "femme", "autre"] as const).map(g => (
                        <button key={g} onClick={() => setGuestGender(guestGender === g ? "" : g)}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-sans font-medium transition-all border ${
                            guestGender === g ? "bg-primary/10 border-primary/30 text-primary" : "bg-background/40 border-border/10 text-foreground/40 hover:border-border/25"
                          }`}
                        >
                          {g === "homme" ? "H" : g === "femme" ? "F" : "?"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-sans font-semibold text-foreground/30 uppercase tracking-widest block mb-1.5">Genres préférés</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRE_OPTIONS.map(genre => {
                      const selected = guestGenres.has(genre);
                      return (
                        <button key={genre} onClick={() => toggleGuestGenre(genre)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-sans transition-all border ${
                            selected ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-background/40 border-border/10 text-foreground/40 hover:border-border/25"
                          }`}
                        >{genre}</button>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={handleAddGuest} disabled={!guestName.trim()} className="w-full rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-sans gap-2">
                  <Plus className="w-4 h-4" />Ajouter {guestName.trim() || "l'invité"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Continue button */}
        <AnimatePresence>
          {(selectedFriendIds.size > 0 || guests.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-0 left-0 right-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-transparent z-20"
            >
              <Button onClick={onContinue}
                className="w-full max-w-lg mx-auto block rounded-2xl h-14 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-base neon-glow shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
              >
                <Users className="w-4 h-4" />
                C'est parti — {selectedCount} personnes
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default WhoStep;
export type { Friend, Guest };
