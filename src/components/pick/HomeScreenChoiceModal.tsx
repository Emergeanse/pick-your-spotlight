import { motion, AnimatePresence } from "framer-motion";
import { Mic, CalendarClock, Heart, Check, User, Flame, Eye, Coffee, Shuffle, Users, MapPin, Wifi, ChevronDown, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAutoPickSubtitle } from "@/lib/time-context";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyDuos, type DuoProfile } from "@/lib/duo-profiles";
import type { AmbianceMood } from "./HomeAmbianceSection";

const AMBIANCES: { id: AmbianceMood; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "intense",    label: "Intense",       Icon: Flame   },
  { id: "mysterious", label: "Mystérieux",    Icon: Eye     },
  { id: "comfort",    label: "Réconfortant",  Icon: Coffee  },
  { id: "couple",     label: "À deux",        Icon: Heart   },
  { id: "surprise",   label: "Surprends-moi", Icon: Shuffle },
];

const GENRES: { key: string; label: string; emoji: string }[] = [
  { key: "Comédie",    label: "Comédie",    emoji: "😄" },
  { key: "Drame",      label: "Drame",      emoji: "🎭" },
  { key: "Thriller",   label: "Thriller",   emoji: "🔪" },
  { key: "Fantastique",label: "Fantastique",emoji: "✨" },
  { key: "Histoire",   label: "Histoire",   emoji: "📜" },
];

type ModalMode = "solo" | "duo" | "groupe";
type ModalQuand = "ce-soir" | "planifier";
type ModalOu = "ensemble" | "a-distance" | null;

export type LaunchContext = "solo" | "duo" | "famille" | "amis" | "surprise";

interface HomeScreenChoiceModalProps {
  open: boolean;
  mediaType: "both" | "movie" | "tv";
  onClose: () => void;
  onAutoPick: (duoId?: string, opts?: { genre?: string }) => void;
  onOpenChat: () => void;
  onOpenMoodCapture: () => void;
  initialDuoId?: string;
  onPickAmbiance?: (mood: AmbianceMood) => void;
  initialContext?: LaunchContext;
}

const TAB_GRADIENT = "linear-gradient(135deg, hsl(var(--primary) / 0.40) 0%, hsl(var(--primary) / 0.15) 100%)";

const HomeScreenChoiceModal = ({
  open, mediaType, onClose, onAutoPick, onOpenChat, onOpenMoodCapture,
  initialDuoId, onPickAmbiance, initialContext = "solo",
}: HomeScreenChoiceModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [duos, setDuos] = useState<DuoProfile[]>([]);
  const [mode, setMode] = useState<ModalMode>("solo");
  const [selectedDuoId, setSelectedDuoId] = useState<string | null>(null);
  const [duoListOpen, setDuoListOpen] = useState(false);
  const [quand, setQuand] = useState<ModalQuand>("ce-soir");
  const [planDate, setPlanDate] = useState("");
  const [planTime, setPlanTime] = useState("20:30");
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [ou, setOu] = useState<ModalOu>(null);
  const [ouDescription, setOuDescription] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("solo");
      setSelectedDuoId(null);
      setDuoListOpen(false);
      setQuand("ce-soir");
      setPlanDate("");
      setPlanTime("20:30");
      setPlanConfirmed(false);
      setOu(null);
      setOuDescription("");
      setSelectedGenre(null);
      setThemeOpen(false);
      return;
    }
    if (initialContext === "duo" || initialDuoId) {
      setMode("duo");
      if (initialDuoId) { setSelectedDuoId(initialDuoId); setDuoListOpen(false); }
    } else if (initialContext === "famille" || initialContext === "amis") {
      setMode("groupe");
    } else {
      setMode("solo");
    }
    if (user) fetchMyDuos(user.id).then(d => {
      setDuos(d);
      // Auto-sélectionne le duo favori (le plus récent) si on ouvre en mode duo
      if ((initialContext === "duo" || initialDuoId) && !initialDuoId && d.length > 0) {
        setSelectedDuoId(d[0].id);
      }
    });
  }, [open, user, initialDuoId, initialContext]);

  const isDuo = mode === "duo" && !!selectedDuoId;
  const isGroupe = mode === "groupe";

  const title =
    isGroupe
      ? initialContext === "famille"
        ? "Ce soir, c'est soirée en famille !"
        : "Ce soir, c'est soirée entre amis !"
      : isDuo
        ? "Ce soir mérite quelque chose pour vous deux."
        : mediaType === "movie"
          ? "Ce soir mérite un grand film."
          : mediaType === "tv"
            ? "Ce soir mérite une grande série."
            : "Ce soir mérite quelque chose de vrai.";

  const subtitle = isDuo
    ? "Choisissez comment je vous accompagne."
    : isGroupe
      ? "Je trouve le film parfait pour tout le groupe."
      : "Choisis comment je t'accompagne.";

  const handleModeChange = (m: ModalMode) => {
    setMode(m);
    if (m !== "duo") setSelectedDuoId(null);
    if (m === "duo") {
      // Auto-sélectionne le duo favori (le + récent, premier de la liste)
      if (duos.length >= 1) { setSelectedDuoId(duos[0].id); setDuoListOpen(duos.length > 1); }
      else setDuoListOpen(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/75 backdrop-blur-2xl pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 30%, hsl(var(--background) / 0.85) 100%)" }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] max-w-[640px] aspect-square pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.22) 0%, hsl(var(--primary) / 0.08) 35%, transparent 65%)", filter: "blur(40px)" }} />
          <div className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")" }} />

          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md mx-5 px-6 pt-8 pb-7 flex flex-col gap-4 max-h-[88vh] overflow-y-auto scrollbar-hide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass surface */}
            <div className="absolute -inset-px rounded-[34px] pointer-events-none" style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.05) 40%, transparent)", filter: "blur(1px)" }} />
            <div className="absolute inset-0 rounded-[32px] bg-card/55 backdrop-blur-2xl border border-white/[0.07] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7),0_0_60px_-12px_hsl(var(--primary)/0.35)] pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px rounded-t-[32px] pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)" }} />

            {/* ── TITRE ── */}
            <div className="relative flex flex-col gap-1 text-center mb-1">
              <p className="text-[10px] font-sans tracking-[0.28em] uppercase text-primary/70">Ce soir</p>
              <h3 className="font-serif text-foreground text-[22px] leading-[1.2] tracking-tight">
                {title.split(" ").slice(0, -1).join(" ")}{" "}
                <span className="italic text-foreground/85">{title.split(" ").slice(-1)}</span>
              </h3>
              <p className="text-foreground/45 text-[12px] font-sans mt-0.5">{subtitle}</p>
            </div>

            {/* ── BLOC 1 : POUR QUI ? ── */}
            <div className="relative flex flex-col gap-2">
              <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/35">Pour qui ?</p>
              <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                {([
                  { m: "solo" as ModalMode,   Icon: User,  label: "Solo",   disabled: false },
                  { m: "duo" as ModalMode,    Icon: Heart, label: "Duo",    disabled: false },
                  { m: "groupe" as ModalMode, Icon: Users, label: "Groupe", disabled: true  },
                ]).map(({ m, Icon, label, disabled }) => (
                  <button
                    key={m}
                    onClick={() => !disabled && handleModeChange(m)}
                    disabled={disabled}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${disabled ? "text-foreground/20 cursor-not-allowed" : mode === m ? "text-foreground border border-primary/40" : "text-foreground/45 hover:text-foreground/70"}`}
                  >
                    {mode === m && !disabled && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_GRADIENT }} />}
                    <Icon className="relative w-3.5 h-3.5" />
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>

              {/* Duo selector */}
              <AnimatePresence mode="wait">
                {mode === "duo" && duos.length > 0 && (
                  selectedDuoId && !duoListOpen ? (() => {
                    const duo = duos.find(d => d.id === selectedDuoId)!;
                    const partner = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                    return (
                      <motion.button key="selected" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                        onClick={() => setDuoListOpen(true)}
                        className="relative flex items-center gap-3 px-4 py-3 rounded-[20px] text-[13px] font-sans border border-primary/40 text-foreground w-full overflow-hidden"
                      >
                        <div className="absolute inset-0 rounded-[20px]" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.35) 0%, hsl(var(--primary) / 0.10) 100%)" }} />
                        <div className="relative w-8 h-8 rounded-xl bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0"><Heart className="w-3.5 h-3.5" /></div>
                        <span className="relative flex-1 text-left font-medium">{duo.duo_name}</span>
                        <span className="relative text-[11px] text-foreground/50 shrink-0">avec {partner ?? "—"}</span>
                        <Check className="relative w-3.5 h-3.5 shrink-0 text-primary" />
                      </motion.button>
                    );
                  })() : (
                    <motion.div key="list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} className="flex flex-col gap-1.5">
                      {duos.map(duo => {
                        const partner = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                        return (
                          <button key={duo.id} onClick={() => { setSelectedDuoId(duo.id); setDuoListOpen(false); }}
                            className="flex items-center gap-3 px-4 py-3 rounded-[20px] text-[13px] font-sans border bg-white/[0.025] border-white/[0.06] text-foreground/80 hover:bg-white/[0.045] w-full"
                          >
                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0"><Heart className="w-3.5 h-3.5" /></div>
                            <span className="flex-1 text-left font-medium">{duo.duo_name}</span>
                            <span className="text-[11px] text-foreground/45 shrink-0">avec {partner ?? "—"}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              {/* Groupe placeholder */}
              {mode === "groupe" && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-3 rounded-[20px] bg-white/[0.025] border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-foreground/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-sans font-medium text-foreground/70">
                      {initialContext === "famille" ? "Soirée Famille" : "Soirée entre amis"}
                    </p>
                    <p className="text-[11px] text-foreground/40 mt-0.5">Groupes bientôt disponibles</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── BLOC 2 : THÈME (accordéon) ── */}
            <div className="relative z-10 flex flex-col gap-0">
              <button
                onClick={() => setThemeOpen(o => !o)}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "20px",
                  border: selectedGenre ? "1px solid hsl(var(--primary) / 0.6)" : "1px solid rgba(255,255,255,0.18)",
                  background: selectedGenre ? "hsl(var(--primary) / 0.2)" : "rgba(255,255,255,0.07)",
                  color: "#ffffff",
                  width: "100%",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <Tag style={{ width: "16px", height: "16px", flexShrink: 0, opacity: 0.7 }} />
                <span style={{ flex: 1, textAlign: "left" }}>
                  {selectedGenre
                    ? <>{GENRES.find(g => g.key === selectedGenre)?.emoji} {selectedGenre}</>
                    : "Thème — optionnel"
                  }
                </span>
                {selectedGenre && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setSelectedGenre(null); }}
                    style={{ fontSize: "11px", opacity: 0.5, padding: "0 4px", cursor: "pointer" }}
                  >✕</span>
                )}
                <ChevronDown style={{ width: "16px", height: "16px", flexShrink: 0, opacity: 0.5, transform: themeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>

              {themeOpen && (
                <div style={{ position: "relative", zIndex: 10, display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "8px", paddingLeft: "4px", paddingRight: "4px" }}>
                  {GENRES.map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      onClick={() => { setSelectedGenre(selectedGenre === key ? null : key); setThemeOpen(false); }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: selectedGenre === key
                          ? "2px solid hsl(var(--primary))"
                          : "2px solid rgba(255,255,255,0.55)",
                        background: selectedGenre === key
                          ? "hsl(var(--primary) / 0.5)"
                          : "rgba(120,100,200,0.45)",
                        color: "#ffffff",
                        cursor: "pointer",
                        backdropFilter: "none",
                        WebkitBackdropFilter: "none",
                      }}
                    >
                      <span style={{ fontSize: "14px", lineHeight: "1" }}>{emoji}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── BLOC 3 : QUAND ? ── */}
            <div className="relative flex flex-col gap-2">
              <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/35">Quand ?</p>
              <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <button
                  onClick={() => { setQuand("ce-soir"); setPlanConfirmed(false); }}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${quand === "ce-soir" ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                >
                  {quand === "ce-soir" && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_GRADIENT }} />}
                  <span className="relative">🎬 Ce soir</span>
                </button>
                <button
                  onClick={() => {
                    if (quand === "planifier" && planConfirmed) { setPlanConfirmed(false); }
                    else setQuand("planifier");
                  }}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${quand === "planifier" ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                >
                  {quand === "planifier" && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_GRADIENT }} />}
                  <CalendarClock className="relative w-3.5 h-3.5" />
                  {quand === "planifier" && planConfirmed && planDate
                    ? <span className="relative text-[11px]">{new Date(planDate + "T" + planTime).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {planTime}</span>
                    : <span className="relative">Planifier</span>
                  }
                </button>
              </div>
              <AnimatePresence>
                {quand === "planifier" && !planConfirmed && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={planDate}
                        onChange={(e) => setPlanDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[13px] font-sans text-foreground/80 focus:outline-none focus:border-primary/40 [color-scheme:dark]"
                      />
                      <input
                        type="time"
                        value={planTime}
                        onChange={(e) => setPlanTime(e.target.value)}
                        className="w-[88px] bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] font-sans text-foreground/80 focus:outline-none focus:border-primary/40 [color-scheme:dark]"
                      />
                    </div>
                    {planDate && planTime && (
                      <motion.button
                        initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => setPlanConfirmed(true)}
                        className="self-end flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-sans font-semibold border border-primary/50 text-foreground/90 transition-all"
                        style={{ background: TAB_GRADIENT }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Valider
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── BLOC 4 : OÙ ? ── (Duo & Groupe uniquement) */}
            <AnimatePresence>
              {mode !== "solo" && (
                <motion.div
                  key="ou-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/35">Où ?</p>
                    <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                      <button
                        onClick={() => setOu(ou === "ensemble" ? null : "ensemble")}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${ou === "ensemble" ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                      >
                        {ou === "ensemble" && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_GRADIENT }} />}
                        <MapPin className="relative w-3.5 h-3.5" />
                        <span className="relative">Ensemble</span>
                      </button>
                      <button
                        onClick={() => setOu(ou === "a-distance" ? null : "a-distance")}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${ou === "a-distance" ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                      >
                        {ou === "a-distance" && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_GRADIENT }} />}
                        <Wifi className="relative w-3.5 h-3.5" />
                        <span className="relative">À distance</span>
                      </button>
                    </div>
                    {ou === "ensemble" && (
                      <input
                        autoFocus type="text"
                        placeholder="Chez nous, home cinéma, salon…"
                        value={ouDescription}
                        onChange={(e) => setOuDescription(e.target.value)}
                        className="bg-white/20 border-2 border-white/50 rounded-xl px-3.5 py-2.5 text-[13px] font-sans font-medium text-white placeholder:text-white/50 focus:outline-none focus:border-primary/70"
                      />
                    )}
                    {ou === "a-distance" && (
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", padding: "0 4px", lineHeight: "1.4" }}>Film disponible sur vos plateformes communes.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── BLOC 5 : COMMENT ? ── */}
            {/* Primary — Laisse-moi te surprendre */}
            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                if (quand === "planifier") {
                  onClose();
                  const params = new URLSearchParams();
                  const ctx = mode === "duo" ? "duo" : mode === "groupe" ? (initialContext === "famille" ? "famille" : "amis") : "solo";
                  if (ctx !== "solo") params.set("context", ctx);
                  if (selectedDuoId) params.set("duoId", selectedDuoId);
                  if (planDate) params.set("date", planDate);
                  if (planTime) params.set("time", planTime);
                  if (ou === "a-distance") params.set("remote", "true");
                  if (ou === "ensemble" && ouDescription.trim()) params.set("location", ouDescription.trim());
                  navigate(`/app/soiree/nouvelle?${params.toString()}`);
                } else {
                  onAutoPick(selectedDuoId ?? undefined, { genre: selectedGenre ?? undefined });
                }
              }}
              disabled={mode === "duo" && !selectedDuoId}
              className="group relative w-full text-left rounded-[24px] p-5 overflow-hidden disabled:opacity-40"
            >
              <div className="absolute inset-0 rounded-[24px]" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.45) 0%, hsl(var(--primary) / 0.18) 55%, hsl(var(--primary) / 0.08) 100%)" }} />
              <div className="absolute inset-0 rounded-[24px] border border-primary/40 group-hover:border-primary/60 transition-colors" />
              <div className="absolute -inset-4 rounded-[28px] pointer-events-none -z-10 opacity-70 group-hover:opacity-100 transition-opacity" style={{ background: "radial-gradient(ellipse at top left, hsl(var(--primary) / 0.55), transparent 60%)", filter: "blur(28px)" }} />
              <motion.div animate={{ opacity: [0.4, 0.85, 0.4] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-x-6 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.7), transparent)" }} />
              <div className="relative flex items-center gap-4">
                <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="w-12 h-12 rounded-2xl bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)]">
                  <span className="text-[22px] drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]">🍿</span>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif text-[17px] leading-tight text-foreground tracking-tight">
                    {quand === "planifier"
                      ? (isDuo ? "Créer cette soirée" : isGroupe ? "Créer cette soirée" : "Créer cette soirée")
                      : (isDuo ? "Laissez-moi vous surprendre" : isGroupe ? "Je choisis pour le groupe" : "Laisse-moi te surprendre")}
                  </h4>
                  <p className="text-foreground/65 text-[12.5px] font-sans mt-1 italic">
                    {quand === "planifier" ? "Je génère le film idéal pour cette date." : getAutoPickSubtitle()}
                  </p>
                </div>
              </div>
            </motion.button>

            {/* Secondary — Mood */}
            <motion.button
              data-tour="parle-a-pick"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.5 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                if (quand === "planifier") {
                  onClose();
                  const params = new URLSearchParams();
                  const ctx = mode === "duo" ? "duo" : mode === "groupe" ? (initialContext === "famille" ? "famille" : "amis") : "solo";
                  if (ctx !== "solo") params.set("context", ctx);
                  if (selectedDuoId) params.set("duoId", selectedDuoId);
                  if (planDate) params.set("date", planDate);
                  if (planTime) params.set("time", planTime);
                  if (ou === "a-distance") params.set("remote", "true");
                  if (ou === "ensemble" && ouDescription.trim()) params.set("location", ouDescription.trim());
                  navigate(`/app/soiree/nouvelle?${params.toString()}`);
                } else {
                  onClose();
                  onOpenMoodCapture();
                }
              }}
              className="group relative w-full text-left rounded-[24px] p-5 bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-2xl bg-primary/20" />
                  <Mic className="relative w-[18px] h-[18px] text-foreground/75" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-sans text-[14.5px] font-medium text-foreground/90 tracking-tight">
                    {isDuo ? "Décrivez votre mood à deux" : isGroupe ? "Décrivez le mood du groupe" : "Décris-moi ton mood"}
                  </h4>
                  <p className="text-foreground/40 text-[12px] font-sans mt-0.5">
                    {isDuo || isGroupe ? "Parlez-moi de vos envies du moment." : "Parle-moi de ton envie du moment."}
                  </p>
                </div>
              </div>
            </motion.button>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HomeScreenChoiceModal;
