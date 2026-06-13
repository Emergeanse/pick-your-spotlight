import { motion, AnimatePresence } from "framer-motion";
import { Mic, CalendarClock, Heart, Check, User, Flame, Eye, Coffee, Shuffle } from "lucide-react";
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

interface HomeScreenChoiceModalProps {
  open: boolean;
  mediaType: "both" | "movie" | "tv";
  onClose: () => void;
  onAutoPick: (duoId?: string) => void;
  onOpenChat: () => void;
  onOpenMoodCapture: () => void;
  initialDuoId?: string;
  onPickAmbiance?: (mood: AmbianceMood) => void;
}

const HomeScreenChoiceModal = ({
  open,
  mediaType,
  onClose,
  onAutoPick,
  onOpenChat,
  onOpenMoodCapture,
  initialDuoId,
  onPickAmbiance,
}: HomeScreenChoiceModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [duos, setDuos] = useState<DuoProfile[]>([]);
  const [mode, setMode] = useState<"solo" | "duo">("solo");
  const [selectedDuoId, setSelectedDuoId] = useState<string | null>(null);
  const [duoListOpen, setDuoListOpen] = useState(false);

  useEffect(() => {
    if (!open) { setMode("solo"); setSelectedDuoId(null); setDuoListOpen(false); return; }
    // Appliquer le duo immédiatement (sans attendre l'API) pour éviter le flash "solo"
    if (initialDuoId) {
      setMode("duo");
      setSelectedDuoId(initialDuoId);
      setDuoListOpen(false);
    }
    if (user) {
      fetchMyDuos(user.id).then((fetched) => {
        setDuos(fetched);
      });
    }
  }, [open, user, initialDuoId]);
  const isDuo = mode === "duo" && !!selectedDuoId;

  const title = isDuo
    ? "Ce soir mérite quelque chose pour vous deux."
    : mediaType === "movie"
      ? "Ce soir mérite un grand film."
      : mediaType === "tv"
        ? "Ce soir mérite une grande série."
        : "Ce soir mérite quelque chose de vrai.";

  const subtitle = isDuo
    ? "Choisissez comment je vous accompagne."
    : "Choisis comment je t'accompagne.";

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
          {/* Cinematic atmospheric layers */}
          <div className="absolute inset-0 bg-background/75 backdrop-blur-2xl pointer-events-none" />
          {/* Soft vignette around edges */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 30%, hsl(var(--background) / 0.85) 100%)",
            }}
          />
          {/* Subtle purple ambient glow behind modal */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] max-w-[640px] aspect-square pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.22) 0%, hsl(var(--primary) / 0.08) 35%, transparent 65%)",
              filter: "blur(40px)",
            }}
          />
          {/* Cinematic grain */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
            }}
          />

          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md mx-5 px-7 pt-9 pb-7 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow ring around modal */}
            <div
              className="absolute -inset-px rounded-[34px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.05) 40%, transparent)",
                filter: "blur(1px)",
              }}
            />
            {/* Glass surface */}
            <div className="absolute inset-0 rounded-[32px] bg-card/55 backdrop-blur-2xl border border-white/[0.07] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7),0_0_60px_-12px_hsl(var(--primary)/0.35)] pointer-events-none" />
            {/* Top inner highlight */}
            <div
              className="absolute inset-x-0 top-0 h-px rounded-t-[32px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)",
              }}
            />

            {/* Content */}
            <div className="relative flex flex-col gap-1.5 text-center mb-1">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-[10px] font-sans tracking-[0.28em] uppercase text-primary/70"
              >
                Ce soir
              </motion.p>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-foreground text-[26px] leading-[1.15] tracking-tight"
              >
                {title.split(" ").slice(0, -1).join(" ")}{" "}
                <span className="italic text-foreground/85">
                  {title.split(" ").slice(-1)}
                </span>
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32, duration: 0.5 }}
                className="text-foreground/45 text-[12px] font-sans mt-1"
              >
                {subtitle}
              </motion.p>
            </div>

            {/* Sélecteur "Pour qui ?" — visible uniquement si des duos existent */}
            {duos.length > 0 && (
              <div className="relative z-10 flex flex-col gap-2.5">
                {/* Toggle Solo / Duo */}
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <button
                    onClick={() => { setMode("solo"); setSelectedDuoId(null); }}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-sans font-medium transition-all overflow-hidden ${
                      mode === "solo"
                        ? "text-foreground border border-primary/40"
                        : "text-foreground/45 hover:text-foreground/70"
                    }`}
                  >
                    {mode === "solo" && (
                      <div className="absolute inset-0 rounded-xl" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.40) 0%, hsl(var(--primary) / 0.15) 100%)" }} />
                    )}
                    <User className="relative w-3.5 h-3.5" />
                    <span className="relative">Solo</span>
                  </button>
                  <button
                    onClick={() => {
                      setMode("duo");
                      setDuoListOpen(true);
                      if (duos.length === 1) setSelectedDuoId(duos[0].id);
                    }}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-sans font-medium transition-all overflow-hidden ${
                      mode === "duo"
                        ? "text-foreground border border-primary/40"
                        : "text-foreground/45 hover:text-foreground/70"
                    }`}
                  >
                    {mode === "duo" && (
                      <div className="absolute inset-0 rounded-xl" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.40) 0%, hsl(var(--primary) / 0.15) 100%)" }} />
                    )}
                    <Heart className="relative w-3.5 h-3.5" />
                    <span className="relative">Duo</span>
                  </button>
                </div>

                {/* Sélection duo */}
                {mode === "duo" && (
                  <AnimatePresence mode="wait">
                    {/* Duo sélectionné — vue réduite */}
                    {selectedDuoId && !duoListOpen ? (() => {
                      const duo = duos.find(d => d.id === selectedDuoId)!;
                      const partner = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                      return (
                        <motion.button
                          key="selected"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => setDuoListOpen(true)}
                          className="relative flex items-center gap-3 px-4 py-3 rounded-[20px] text-[13px] font-sans transition-all overflow-hidden border border-primary/40 text-foreground w-full"
                        >
                          <div className="absolute inset-0 rounded-[20px]" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.35) 0%, hsl(var(--primary) / 0.10) 100%)" }} />
                          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-primary/30 border border-primary/50">
                            <Heart className="w-3.5 h-3.5" />
                          </div>
                          <span className="relative flex-1 text-left font-medium">{duo.duo_name}</span>
                          <span className="relative text-[11px] text-foreground/50 shrink-0">avec {partner ?? "—"}</span>
                          <Check className="relative w-3.5 h-3.5 shrink-0 text-primary" />
                        </motion.button>
                      );
                    })() : (
                      /* Liste dépliante */
                      <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.22 }}
                        className="flex flex-col gap-1.5"
                      >
                        {duos.map(duo => {
                          const partner = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                          return (
                            <button
                              key={duo.id}
                              onClick={() => { setSelectedDuoId(duo.id); setDuoListOpen(false); }}
                              className="relative flex items-center gap-3 px-4 py-3 rounded-[20px] text-[13px] font-sans transition-all overflow-hidden border bg-white/[0.025] border-white/[0.06] text-foreground/80 hover:bg-white/[0.045] hover:border-white/[0.12] w-full"
                            >
                              <div className="relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.08]">
                                <Heart className="w-3.5 h-3.5" />
                              </div>
                              <span className="relative flex-1 text-left font-medium">{duo.duo_name}</span>
                              <span className="relative text-[11px] text-foreground/45 shrink-0">avec {partner ?? "—"}</span>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* PRIMARY — hero card */}
            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onAutoPick(selectedDuoId ?? undefined)}
              disabled={mode === "duo" && !selectedDuoId}
              className="group relative w-full text-left rounded-[24px] p-5 overflow-hidden disabled:opacity-40"
            >
              {/* Gradient surface */}
              <div
                className="absolute inset-0 rounded-[24px]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.45) 0%, hsl(var(--primary) / 0.18) 55%, hsl(var(--primary) / 0.08) 100%)",
                }}
              />
              <div className="absolute inset-0 rounded-[24px] border border-primary/40 group-hover:border-primary/60 transition-colors" />
              {/* Glow */}
              <div
                className="absolute -inset-4 rounded-[28px] pointer-events-none -z-10 opacity-70 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "radial-gradient(ellipse at top left, hsl(var(--primary) / 0.55), transparent 60%)",
                  filter: "blur(28px)",
                }}
              />
              {/* Breathing top highlight */}
              <motion.div
                animate={{ opacity: [0.4, 0.85, 0.4] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-x-6 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.7), transparent)",
                }}
              />

              <div className="relative flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-12 h-12 rounded-2xl bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)]"
                >
                  <span className="text-[22px] drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]">
                    🍿
                  </span>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif text-[17px] leading-tight text-foreground tracking-tight">
                    {isDuo ? "Laissez-moi vous surprendre" : "Laisse-moi te surprendre"}
                  </h4>
                  <p className="text-foreground/65 text-[12.5px] font-sans mt-1 italic">
                    {getAutoPickSubtitle()}
                  </p>
                </div>
              </div>
            </motion.button>

            {/* SECONDARY — quieter card */}
            <motion.button
              data-tour="parle-a-pick"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => { onClose(); onOpenMoodCapture(); }}
              className="group relative w-full text-left rounded-[24px] p-5 bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <motion.div
                    animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-2xl bg-primary/20"
                  />
                  <Mic className="relative w-[18px] h-[18px] text-foreground/75" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-sans text-[14.5px] font-medium text-foreground/90 tracking-tight">
                    {isDuo ? "Décrivez votre mood à deux" : "Décris-moi ton mood"}
                  </h4>
                  <p className="text-foreground/40 text-[12px] font-sans mt-0.5">
                    {isDuo ? "Parlez-moi de vos envies du moment." : "Parle-moi de ton envie du moment."}
                  </p>
                </div>
              </div>
            </motion.button>

            {/* TERTIARY — plan for later */}
            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                onClose();
                navigate("/app/plan");
              }}
              className="group relative w-full text-left rounded-[20px] px-5 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.1] transition-all flex items-center gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0">
                <CalendarClock className="w-[16px] h-[16px] text-foreground/65" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-sans text-[13.5px] font-medium text-foreground/85 tracking-tight">
                  Planifier pour plus tard
                </h4>
                <p className="text-foreground/40 text-[11.5px] font-sans mt-0.5">
                  Choisis une date, je m'occupe du reste.
                </p>
              </div>
            </motion.button>

            {/* Ambiances — filtre rapide */}
            {onPickAmbiance && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.68, duration: 0.45 }}
                className="flex flex-col gap-2"
              >
                <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/35 px-0.5">
                  Choisis une ambiance
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {AMBIANCES.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { onClose(); onPickAmbiance(id); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/[0.16] text-foreground/70 hover:text-foreground/90 text-[11px] font-sans transition-all"
                    >
                      <Icon className="w-3 h-3 text-foreground/45" strokeWidth={2.2} />
                      {label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HomeScreenChoiceModal;
