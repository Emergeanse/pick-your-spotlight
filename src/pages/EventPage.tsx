import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clapperboard, UsersRound, CalendarClock, ChevronRight } from "lucide-react";
import { setPendingDuoPick } from "@/lib/duo-pending";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { fetchMyDuos, type DuoProfile } from "@/lib/duo-profiles";

const EventPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [duos, setDuos] = useState<DuoProfile[]>([]);

  useEffect(() => {
    if (user) fetchMyDuos(user.id).then(setDuos);
  }, [user]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="pt-[calc(3.5rem+env(safe-area-inset-top))] px-5 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Clapperboard className="w-5 h-5 text-primary" strokeWidth={1.8} />
          <span className="text-[11px] font-sans font-semibold tracking-[0.12em] uppercase text-primary/80">
            Événement
          </span>
        </div>
        <h1 className="text-[28px] font-serif font-bold text-foreground leading-tight">
          On organise<br />
          <span className="italic text-primary">quoi ce soir ?</span>
        </h1>
        <p className="text-foreground/50 text-sm font-sans mt-1.5">
          Crée un moment ciné, seul ou à plusieurs.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-3">

        {/* Ce soir en duo */}
        <div className="space-y-2">
          <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/35 px-1">
            Ce soir
          </p>

          {/* Solo rapide */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/app", { state: { openFindChoice: true } })}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg">🎬</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans font-semibold text-foreground">Trouve-moi un film</p>
              <p className="text-xs text-foreground/45 mt-0.5">Sélection personnalisée pour toi</p>
            </div>
            <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" />
          </motion.button>

          {/* Duo existants */}
          {duos.map((duo) => (
            <motion.button
              key={duo.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setPendingDuoPick(duo.id);
                navigate("/app", { state: { openFindChoice: true, duoId: duo.id } });
              }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UsersRound className="w-5 h-5 text-primary" strokeWidth={1.7} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-semibold text-foreground truncate">
                  Soirée avec {duo.user2_display_name || duo.user1_display_name || "votre duo"}
                </p>
                <p className="text-xs text-foreground/45 mt-0.5">Film commun · ce soir</p>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" />
            </motion.button>
          ))}

          {/* Nouveau duo si aucun */}
          {duos.length === 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/app/duo")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UsersRound className="w-5 h-5 text-primary" strokeWidth={1.7} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-semibold text-foreground">Soirée en duo</p>
                <p className="text-xs text-foreground/45 mt-0.5">Crée un duo pour commencer</p>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" />
            </motion.button>
          )}
        </div>

        {/* Programmer */}
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/35 px-1">
            Programmer
          </p>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/app/plan")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-accent" strokeWidth={1.7} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans font-semibold text-foreground">Planifier une soirée</p>
              <p className="text-xs text-foreground/45 mt-0.5">Choisis une date, Pick s'occupe du reste</p>
            </div>
            <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" />
          </motion.button>

          {/* Groupe — à venir */}
          <div className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] opacity-50">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <span className="text-lg">👥</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans font-semibold text-foreground">Soirée en groupe</p>
              <p className="text-xs text-foreground/45 mt-0.5">Bientôt disponible</p>
            </div>
            <span className="text-[10px] font-sans text-foreground/30 border border-white/10 rounded-full px-2 py-0.5 shrink-0">
              Bientôt
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EventPage;
