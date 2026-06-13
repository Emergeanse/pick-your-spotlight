import { motion } from "framer-motion";
import { CalendarDays, UsersRound, Clapperboard } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FICTIONAL_EVENTS = [
  {
    id: "1",
    title: "Soirée avec Sophie",
    date: "Mercredi 18 juin · 20h30",
    type: "duo",
    compat: 87,
    upcoming: true,
  },
  {
    id: "2",
    title: "Ciné en famille",
    date: "Dimanche 22 juin · 19h00",
    type: "famille",
    compat: 74,
    upcoming: true,
  },
  {
    id: "3",
    title: "Soirée avec Antoine & Marc",
    date: "Vendredi 7 juin · 21h00",
    type: "amis",
    compat: 81,
    upcoming: false,
  },
];

const SoireesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="pt-[calc(3.5rem+env(safe-area-inset-top))] px-5 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <CalendarDays className="w-5 h-5 text-primary" strokeWidth={1.8} />
          <span className="text-[11px] font-sans font-semibold tracking-[0.12em] uppercase text-primary/80">
            Soirées
          </span>
        </div>
        <h1 className="text-[28px] font-serif font-bold text-foreground leading-tight">
          Tes soirées<br />
          <span className="italic text-primary">ciné</span>
        </h1>
        <p className="text-foreground/50 text-sm font-sans mt-1.5">
          Passées et à venir — avec qui, quand.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-3">
        {["À venir", "Passées"].map((section) => {
          const events = FICTIONAL_EVENTS.filter((e) => e.upcoming === (section === "À venir"));
          if (!events.length) return null;
          return (
            <div key={section} className="space-y-2">
              <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/35 px-1">
                {section}
              </p>
              {events.map((evt, i) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07]"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {evt.type === "duo" ? (
                      <UsersRound className="w-5 h-5 text-primary" strokeWidth={1.7} />
                    ) : (
                      <Clapperboard className="w-5 h-5 text-primary" strokeWidth={1.7} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-semibold text-foreground truncate">{evt.title}</p>
                    <p className="text-xs text-foreground/45 mt-0.5">{evt.date}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[11px] font-sans font-semibold text-primary">{evt.compat}%</p>
                    <p className="text-[9px] font-sans text-foreground/30">compat.</p>
                  </div>
                </motion.div>
              ))}
            </div>
          );
        })}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/app/event")}
          className="w-full mt-2 py-3.5 rounded-2xl border border-primary/25 bg-primary/8 text-primary text-[13px] font-sans font-semibold"
        >
          + Organiser une soirée
        </motion.button>
      </div>
    </div>
  );
};

export default SoireesPage;
