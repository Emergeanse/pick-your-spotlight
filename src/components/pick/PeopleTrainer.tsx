import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Heart, ThumbsDown, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchPopularPeople,
  savePersonPreference,
  fetchPersonDetail,
  getUserPeoplePreferences,
  type PreferenceValue,
} from "@/lib/people-preferences";
import FlipCardDetail from "./FlipCardDetail";
import RecommendationPersonCard from "./RecommendationPersonCard";

interface PeopleTrainerProps {
  onBack?: () => void;
  filterDepartment?: "Acting" | "Directing";
}

const SITE_BOTTOM_NAV_HEIGHT = 88;
const TRAINING_BAR_HEIGHT = 84;

type PersonUiPreference = PreferenceValue | "unknown";

const PeopleTrainer = ({ onBack, filterDepartment }: PeopleTrainerProps) => {
  const { user } = useAuth();
  const [people, setPeople] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());
  const [existingPreferenceIds, setExistingPreferenceIds] = useState<Set<number>>(new Set());
  const [preferencesById, setPreferencesById] = useState<Record<number, PersonUiPreference>>({});
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<number[]>([]);
  const [ratedCount, setRatedCount] = useState(0);
  const [detailPerson, setDetailPerson] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hydratedPeople, setHydratedPeople] = useState<Record<number, any>>({});
  const actionsRef = useRef({ likes: 0, dislikes: 0 });

  const loadPeople = useCallback(
    async (p: number, excludedIds: Set<number> = existingPreferenceIds) => {
      setLoading(true);
      try {
        const randomPage = Math.floor(Math.random() * 30) + p;
        const results = await fetchPopularPeople(randomPage);
        const filtered = results.filter((person) => {
          if (processedIds.has(person.id)) return false;
          if (excludedIds.has(person.id)) return false;
          if (filterDepartment && person.known_for_department !== filterDepartment) return false;
          return true;
        });

        setPeople((prev) => {
          const prevIds = new Set(prev.map((item) => item.id));
          const newItems = filtered.filter((item) => !prevIds.has(item.id));
          return [...prev, ...newItems];
        });
      } catch (e) {
        console.error("Failed to load people:", e);
      } finally {
        setLoading(false);
      }
    },
    [processedIds, existingPreferenceIds, filterDepartment],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setPeople([]);
      setCurrentIndex(0);
      setHistory([]);
      setPage(1);
      setHydratedPeople({});

      try {
        const prefs = user ? await getUserPeoplePreferences() : [];
        if (cancelled) return;

        const expectedType =
          filterDepartment === "Directing" ? "director" : filterDepartment === "Acting" ? "actor" : null;
        const filteredPrefs = prefs.filter((pref) => !expectedType || pref.person_type === expectedType);
        const prefIds = new Set(filteredPrefs.map((pref) => pref.person_id));
        const prefMap = Object.fromEntries(filteredPrefs.map((pref) => [pref.person_id, pref.preference]));

        setExistingPreferenceIds(prefIds);
        setPreferencesById(prefMap);
        await loadPeople(1, prefIds);
      } catch (e) {
        console.error("Failed to bootstrap people trainer:", e);
        if (!cancelled) {
          setExistingPreferenceIds(new Set());
          setPreferencesById({});
          await loadPeople(1, new Set());
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [filterDepartment, user?.id]);

  useEffect(() => {
    if (people.length - currentIndex < 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPeople(nextPage);
    }
  }, [currentIndex, people.length, loading, page, loadPeople]);

  const currentPerson = people[currentIndex];
  const nextPerson = people[currentIndex + 1];
  const currentPreference = currentPerson ? preferencesById[currentPerson.id] : undefined;

  useEffect(() => {
    const ids = [currentPerson?.id, nextPerson?.id].filter(Boolean);
    ids.forEach((id) => {
      if (id && !hydratedPeople[id]) {
        fetchPersonDetail(id)
          .then((detail) => {
            setHydratedPeople((prev) => ({ ...prev, [id]: detail }));
          })
          .catch(() => {});
      }
    });
  }, [currentPerson?.id, nextPerson?.id, hydratedPeople]);

  const currentPersonDetail = currentPerson ? (hydratedPeople[currentPerson.id] ?? currentPerson) : null;

  const advancePerson = () => {
    if (!currentPerson) return;
    setHistory((prev) => [...prev, currentIndex]);
    setProcessedIds((prev) => new Set(prev).add(currentPerson.id));
    setCurrentIndex((i) => i + 1);
  };

  const handleRate = async (preference: PreferenceValue) => {
    if (!currentPerson || !user) return;

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

      setPreferencesById((prev) => ({ ...prev, [currentPerson.id]: preference }));
      setRatedCount((c) => c + 1);
      if (preference === "liked") actionsRef.current.likes += 1;
      if (preference === "disliked") actionsRef.current.dislikes += 1;
    } catch (e) {
      console.error("Failed to rate person:", e);
    }

    advancePerson();
  };

  const handleUnknown = () => {
    if (!currentPerson) return;
    setPreferencesById((prev) => ({ ...prev, [currentPerson.id]: "unknown" }));
    advancePerson();
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
  };

  const skip = () => {
    if (!currentPerson) return;
    advancePerson();
  };

  const openPersonDetail = () => {
    if (!currentPersonDetail) return;
    setDetailPerson(currentPersonDetail);
    setDetailOpen(true);
  };

  const iconSize = "w-3.5 h-3.5";
  const btnSize = "w-8 h-8";
  const inactiveClass = "bg-transparent border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25";
  const likeFilledClass =
    "bg-primary border-primary/80 text-primary-foreground ring-1 ring-white/15 shadow-[0_0_24px_hsl(var(--primary)/0.45)]";
  const dislikeFilledClass =
    "bg-rose-600 border-rose-300/70 text-white ring-1 ring-white/10 shadow-[0_0_24px_rgba(225,29,72,0.45)]";
  const unknownFilledClass =
    "bg-foreground/85 border-white/15 text-background shadow-[0_0_18px_rgba(255,255,255,0.12)]";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{
        paddingBottom: `calc(${SITE_BOTTOM_NAV_HEIGHT + TRAINING_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div className="px-4 pb-2">
        <p className="text-center text-[11px] font-sans text-foreground/25">
          {ratedCount} évalué{ratedCount > 1 ? "s" : ""}
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        {loading && people.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            <p className="text-sm font-sans text-foreground/30">Chargement…</p>
          </div>
        ) : !currentPersonDetail ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-sans text-foreground/50">Plus de personnes pour le moment</p>
          </div>
        ) : (
          <div className="w-full max-w-xl">
            <RecommendationPersonCard person={currentPersonDetail} onOpenDetails={openPersonDetail} />
          </div>
        )}
      </div>

      {currentPerson && (
        <div
          className="fixed left-0 right-0 z-30 border-t border-border/20 bg-background/84 px-4 pt-3 backdrop-blur-xl shadow-[0_-18px_40px_hsl(var(--background)/0.32)]"
          style={{ bottom: `calc(${SITE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
        >
          <div className="mx-auto max-w-md pb-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                onClick={goBack}
                disabled={history.length === 0}
                className="rounded-full bg-foreground/5 p-2 text-foreground/30 transition-all hover:bg-foreground/10 disabled:opacity-20"
                aria-label="Précédent"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 text-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleRate("liked")}
                  className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${currentPreference === "liked" ? likeFilledClass : inactiveClass}`}
                  title="Like"
                  aria-label="Like"
                >
                  <Heart className={`${iconSize} ${currentPreference === "liked" ? "fill-current" : ""}`} />
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={handleUnknown}
                  className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${currentPreference === "unknown" ? unknownFilledClass : inactiveClass}`}
                  title="Connais pas"
                  aria-label="Connais pas"
                >
                  <HelpCircle className={iconSize} />
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleRate("disliked")}
                  className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${currentPreference === "disliked" ? dislikeFilledClass : inactiveClass}`}
                  title="N'aime pas"
                  aria-label="N'aime pas"
                >
                  <ThumbsDown className={iconSize} />
                </motion.button>
              </div>

              <button
                onClick={skip}
                className="rounded-full bg-foreground/5 p-2 text-foreground/30 transition-all hover:bg-foreground/10"
                aria-label="Suivant"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <FlipCardDetail
        item={detailPerson}
        type="person"
        isOpen={detailOpen && !!detailPerson}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
};

export default PeopleTrainer;
