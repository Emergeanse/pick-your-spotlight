import { motion, AnimatePresence } from "framer-motion";
import { Mic, CalendarClock, Heart, Check, User, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAutoPickSubtitle } from "@/lib/time-context";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyDuos, type DuoProfile } from "@/lib/duo-profiles";

interface HomeScreenChoiceModalProps {
  open: boolean;
  mediaType: "both" | "movie" | "tv";
  onClose: () => void;
  onAutoPick: (duoId?: string) => void;
  onOpenChat: () => void;
  onOpenMoodCapture: () => void;
}

const HomeScreenChoiceModal = ({
  open,
  mediaType,
  onClose,
  onAutoPick,
  onOpenChat,
  onOpenMoodCapture,
}: HomeScreenChoiceModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [duos, setDuos] = useState<DuoProfile[]>([]);
  const [mode, setMode] = useState<"solo" | "duo">("solo");
  const [selectedDuoId, setSelectedDuoId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchMyDuos(user.id).then(setDuos);
    }
    if (!open) { setMode("solo"); setSelectedDuoId(null); }
  }, [open, user]);
  const title =
    mediaType === "movie"
      ? "Ce soir mérite un grand film."
      : mediaType === "tv"
        ? "Ce soir mérite une grande série."
        : "Ce soir mérite quelque chose de vrai.";

  const subtitle = "Choisis comment je t'accompagne.";

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
          <div className="absolute inset-0 bg-background/75 backdrop-blur-2xl" />
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
            <div className="absolute inset-0 rounded-[32px] bg-card/55 backdrop-blur-2xl border border-white/[0.07] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7),0_0_60px_-12px_hsl(var(--primary)/0.35)]" />
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
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.33, duration: 0.4 }}
                className="flex flex-col gap-2.5"
              >
                {/* Toggle Solo / Duo */}
                <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)" }}>
                  <button
                    onClick={() => { setMode("solo"); setSelectedDuoId(null); }}
                    style={mode === "solo" ? { background: "rgba(255,255,255,0.92)" } : {}}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-sans font-semibold transition-all ${
                      mode === "solo" ? "text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Solo
                  </button>
                  <button
                    onClick={() => {
                      setMode("duo");
                      if (!selectedDuoId && duos.length === 1) setSelectedDuoId(duos[0].id);
                    }}
                    style={mode === "duo" ? { background: "rgba(255,255,255,0.92)" } : {}}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-sans font-semibold transition-all ${
                      mode === "duo" ? "text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5" />
                    Duo
                  </button>
                </div>

                {/* Liste des duos */}
                {mode === "duo" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-1.5"
                  >
                    {duos.map(duo => {
                      const partner = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                      const active = selectedDuoId === duo.id;
                      return (
                        <button
                          key={duo.id}
                          onClick={() => setSelectedDuoId(duo.id)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-sans transition-all border ${
                            active
                              ? "bg-primary/20 border-primary/45 text-primary"
                              : "bg-white/[0.03] border-white/[0.07] text-foreground/65 hover:border-white/20"
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left font-medium">{duo.duo_name}</span>
                          <span className="text-[11px] opacity-60 shrink-0">avec {partner ?? "—"}</span>
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                    {!selectedDuoId && (
                      <p className="text-[11px] text-foreground/35 font-sans text-center pt-0.5">
                        Sélectionne un duo
                      </p>
                    )}
                  </motion.div>
                )}
              </motion.div>
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
                    Laisse-moi te surprendre
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
                    Décris-moi ton mood
                  </h4>
                  <p className="text-foreground/40 text-[12px] font-sans mt-0.5">
                    Parle-moi de ton envie du moment.
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HomeScreenChoiceModal;
