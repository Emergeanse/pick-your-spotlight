import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Loader2, Heart, ThumbsDown, Star, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchPopularPeople, getPersonPhotoUrl, savePersonPreference, type PreferenceValue } from "@/lib/people-preferences";
import FlipCardBack from "./FlipCardBack";

interface PeopleTrainerProps {
  onBack?: () => void;
}

const RATING_BUTTONS = [
  { value: "disliked" as PreferenceValue, label: "Pas fan", icon: ThumbsDown,
    toneClass: "bg-[hsl(var(--destructive)/0.18)] border-[hsl(var(--destructive)/0.34)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.28)]" },
  { value: "liked" as PreferenceValue, label: "J'aime", icon: Heart,
    toneClass: "bg-[hsl(var(--train)/0.18)] border-[hsl(var(--train)/0.30)] text-[hsl(var(--train))] hover:bg-[hsl(var(--train)/0.26)]" },
  { value: "loved" as PreferenceValue, label: "J'adore", icon: Star,
    toneClass: "bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.30)] text-primary hover:bg-[hsl(var(--primary)/0.26)]" },
];

const PeopleTrainer = ({ onBack }: PeopleTrainerProps) => {
  const { user } = useAuth();
  const [people, setPeople] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<number[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [ratedCount, setRatedCount] = useState(0);
  const x = useMotionValue(0);

  const loadPeople = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const randomPage = Math.floor(Math.random() * 30) + p;
      const results = await fetchPopularPeople(randomPage);
      const filtered = results.filter(p => !processedIds.has(p.id));
      setPeople(prev => [...prev, ...filtered]);
    } catch (e) {
      console.error("Failed to load people:", e);
    } finally {
      setLoading(false);
    }
  }, [processedIds]);

  useEffect(() => { loadPeople(1); }, []);

  useEffect(() => {
    if (people.length - currentIndex < 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPeople(nextPage);
    }
  }, [currentIndex, people.length, loading, page]);

  const currentPerson = people[currentIndex];
  const nextPerson = people[currentIndex + 1];

  const rotate = useTransform(x, [-200, 0, 200], [-8, 0, 8]);
  const likeOpacity = useTransform(x, [0, 80, 200], [0, 0.6, 1]);
  const skipOpacity = useTransform(x, [-200, -80, 0], [1, 0.6, 0]);

  const handleRate = async (preference: PreferenceValue) => {
    if (!currentPerson || !user) return;
    setSwiping(preference === "disliked" ? "left" : "right");

    try {
      const knownFor = (currentPerson.known_for || []).map((m: any) => m.title || m.name).filter(Boolean);
      await savePersonPreference({
        person_id: currentPerson.id,
        person_name: currentPerson.name,
        person_type: currentPerson.known_for_department === "Directing" ? "director" : "actor",
        photo_url: currentPerson.profile_path,
        preference,
        known_for: knownFor.slice(0, 5),
      });
      setRatedCount(c => c + 1);
    } catch (e) {
      console.error("Failed to rate person:", e);
    }

    setHistory(prev => [...prev, currentIndex]);
    setProcessedIds(prev => new Set(prev).add(currentPerson.id));
    setTimeout(() => {
      setSwiping(null);
      setFlipped(false);
      setCurrentIndex(i => i + 1);
      x.set(0);
    }, 300);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) handleRate("liked");
    else if (info.offset.x < -100) handleRate("disliked");
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
    setFlipped(false);
    x.set(0);
  };

  const skip = () => {
    if (!currentPerson) return;
    setHistory(prev => [...prev, currentIndex]);
    setProcessedIds(prev => new Set(prev).add(currentPerson.id));
    setCurrentIndex(i => i + 1);
    setFlipped(false);
    x.set(0);
  };

  const knownForTitles = (currentPerson?.known_for || []).map((m: any) => m.title || m.name).filter(Boolean).slice(0, 3);
  const isDirector = currentPerson?.known_for_department === "Directing";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Counter */}
      <div className="px-4 pb-2">
        <p className="text-center text-[11px] font-sans text-foreground/25">
          {ratedCount} évalué{ratedCount > 1 ? "s" : ""}
        </p>
      </div>

      {/* Card area */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        {loading && people.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            <p className="text-sm font-sans text-foreground/30">Chargement…</p>
          </div>
        ) : !currentPerson ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-sans text-foreground/50">Plus de personnes pour le moment</p>
          </div>
        ) : (
          <div className="relative mx-auto w-full max-w-[280px]" style={{ width: "min(68vw, 30vh, 280px)", perspective: "1200px" }}>
            {nextPerson && !flipped && (
              <div className="absolute inset-0 -z-10">
                <div className="h-full w-full translate-y-3 scale-[0.94] overflow-hidden rounded-[1.75rem] border border-white/10 opacity-30 aspect-[3/4]">
                  <img src={getPersonPhotoUrl(nextPerson.profile_path, "w342")} alt="" className="h-full w-full object-cover" />
                </div>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentPerson.id}
                drag={flipped ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                animate={
                  swiping === "right" ? { x: 400, opacity: 0, rotate: 15 } :
                  swiping === "left" ? { x: -400, opacity: 0, rotate: -15 } : {}
                }
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={swiping ? { duration: 0.3, ease: "easeOut" } : { type: "spring", stiffness: 260, damping: 24 }}
                className="relative aspect-[3/4] w-full select-none"
                style={{ x, rotate: flipped ? 0 : rotate, touchAction: "none" }}
                onClick={() => !swiping && setFlipped(f => !f)}
              >
                {/* Front face */}
                <div
                  className="absolute inset-0 rounded-[1.75rem] overflow-hidden shadow-[0_24px_80px_hsl(var(--background)/0.72)] cursor-pointer transition-all duration-500"
                  style={{
                    opacity: flipped ? 0 : 1,
                    transform: flipped ? "scale(0.95)" : "scale(1)",
                    pointerEvents: flipped ? "none" : "auto",
                  }}
                >
                  <img
                    src={getPersonPhotoUrl(currentPerson.profile_path, "w780")}
                    alt={currentPerson.name}
                    className="absolute inset-0 h-full w-full object-cover brightness-[1.1] contrast-[1.05]"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10" />

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/50 to-transparent px-5 pt-20 pb-5">
                    <h3 className="mb-1 text-xl font-serif font-bold text-white drop-shadow-md">{currentPerson.name}</h3>
                    <p className="mb-2 text-xs font-sans text-white/60">
                      {isDirector ? "Réalisateur" : "Acteur/Actrice"}
                    </p>
                    {knownForTitles.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {knownForTitles.map((t: string) => (
                          <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 rounded-full bg-background/30 px-2 py-1 backdrop-blur-sm">
                    <span className="text-[9px] font-sans text-white/50">Tap pour détails</span>
                  </div>

                  <motion.div className="absolute top-5 left-5 z-30 rounded-xl border-2 border-[hsl(var(--destructive)/0.6)] px-4 py-2 -rotate-12" style={{ opacity: skipOpacity }}>
                    <span className="text-sm font-sans font-bold text-[hsl(var(--destructive))]">PASSE</span>
                  </motion.div>
                  <motion.div className="absolute top-5 right-5 z-30 rounded-xl border-2 border-[hsl(var(--train)/0.6)] px-4 py-2 rotate-12" style={{ opacity: likeOpacity }}>
                    <span className="text-sm font-sans font-bold text-[hsl(var(--train))]">J'AIME</span>
                  </motion.div>
                </div>

                {/* Back face */}
                <div
                  className="absolute inset-0 rounded-[1.75rem] overflow-hidden shadow-[0_24px_80px_hsl(var(--background)/0.72)] border border-border/20 cursor-pointer transition-all duration-500"
                  style={{
                    opacity: flipped ? 1 : 0,
                    transform: flipped ? "scale(1)" : "scale(0.95)",
                    pointerEvents: flipped ? "auto" : "none",
                  }}
                >
                  {flipped && <FlipCardBack item={currentPerson} type="person" />}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            {!flipped && (
              <>
                <div className="absolute inset-y-0 -left-10 flex items-center">
                  <button
                    onClick={goBack}
                    disabled={history.length === 0}
                    className="rounded-full bg-foreground/5 p-1.5 text-foreground/30 transition-all hover:bg-foreground/10 disabled:opacity-20"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
                <div className="absolute inset-y-0 -right-10 flex items-center">
                  <button
                    onClick={skip}
                    className="rounded-full bg-foreground/5 p-1.5 text-foreground/30 transition-all hover:bg-foreground/10"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rating buttons */}
      {currentPerson && (
        <div className="border-t border-border/20 bg-background/84 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-2">
            {RATING_BUTTONS.map(btn => (
              <motion.button
                key={btn.value}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleRate(btn.value)}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center font-sans text-[11px] font-medium leading-tight transition-all active:scale-95 ${btn.toneClass}`}
              >
                <btn.icon className="h-4 w-4" />
                {btn.label}
              </motion.button>
            ))}
          </div>

          <button
            onClick={skip}
            className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-foreground/30 transition-colors hover:text-foreground/45"
          >
            <SkipForward className="h-3 w-3" />
            <span className="text-[11px] font-sans">Je ne connais pas</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default PeopleTrainer;
