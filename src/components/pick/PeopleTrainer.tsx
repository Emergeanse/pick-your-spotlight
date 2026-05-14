import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Heart, ThumbsDown, Star, SkipForward, HelpCircle } from "lucide-react";
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

const PeopleTrainer = ({ onBack, filterDepartment }: PeopleTrainerProps) => {
  const { user } = useAuth();
  const [people, setPeople] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());
  const [existingPreferenceIds, setExistingPreferenceIds] = useState<Set<number>>(new Set());
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
        const prefIds = new Set(
          prefs.filter((pref) => !expectedType || pref.person_type === expectedType).map((pref) => pref.person_id),
        );

        setExistingPreferenceIds(prefIds);
        await loadPeople(1, prefIds);
      } catch (e) {
        console.error("Failed to bootstrap people trainer:", e);
        if (!cancelled) {
          setExistingPreferenceIds(new Set());
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
  }, [currentIndex, people.length, loading, page]);

  const currentPerson = people[currentIndex];
  const nextPerson = people[currentIndex + 1];

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

      setRatedCount((c) => c + 1);
      if (preference === "liked" || preference === "loved") actionsRef.current.likes += 1;
      if (preference === "disliked") actionsRef.current.dislikes += 1;
    } catch (e) {
      console.error("Failed to rate person:", e);
    }

    setHistory((prev) => [...prev, currentIndex]);
    setProcessedIds((prev) => new Set(prev).add(currentPerson.id));
    setCurrentIndex((i) => i + 1);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
  };

  const skip = () => {
    if (!currentPerson) return;
    setHistory((prev) => [...prev, currentIndex]);
    setProcessedIds((prev) => new Set(prev).add(currentPerson.id));
    setCurrentIndex((i) => i + 1);
  };

  const openPersonDetail = () => {
    if (!currentPersonDetail) return;
    setDetailPerson(currentPersonDetail);
    setDetailOpen(true);
  };

  const iconSize = "w-3.5 h-3.5";
  const btnSize = "w-8 h-8";
  const inactiveClass = "bg-transparent border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
            <RecommendationPersonCard
              person={currentPersonDetail}
              onOpenDetails={openPersonDetail}
              onPrevious={goBack}
              onNext={skip}
              canGoPrevious={history.length > 0}
              canGoNext={true}
            />
          </div>
        )}
      </div>

      {currentPerson && (
        <div className="border-t border-border/20 bg-background/84 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-center gap-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleRate("liked")}
              className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${inactiveClass}`}
              title="Aimé"
              aria-label="Aimé"
            >
              <Heart className={iconSize} />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={skip}
              className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${inactiveClass}`}
              title="Je ne connais pas"
              aria-label="Je ne connais pas"
            >
              <HelpCircle className={iconSize} />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleRate("loved")}
              className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${inactiveClass}`}
              title="J'adore"
              aria-label="J'adore"
            >
              <Star className={iconSize} />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleRate("disliked")}
              className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${inactiveClass}`}
              title="Pas fan"
              aria-label="Pas fan"
            >
              <ThumbsDown className={iconSize} />
            </motion.button>
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
