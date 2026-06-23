import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchOnboardingActorsPage,
  fetchOnboardingDirectorsPage,
  fetchOnboardingPeopleByIds,
  getPersonPhotoUrl,
  ONBOARDING_PEOPLE_PAGE_SIZE,
  ONBOARDING_PEOPLE_TARGET,
  type OnboardingPerson,
} from "@/lib/onboarding-people";
import { saveOnboardingPeopleProgress } from "@/lib/onboarding-progress";
import { savePersonPreference, type PersonType } from "@/lib/people-preferences";
import { useOnboardingInfiniteScroll } from "@/hooks/use-onboarding-infinite-scroll";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";

interface OnboardingPeopleStepProps {
  personType: PersonType;
  initialSelectedIds?: number[];
  initialProposedIds?: number[];
  onSelectedIdsChange?: (ids: number[]) => void;
  onProposedIdsChange?: (ids: number[]) => void;
  onComplete: () => void;
}

export default function OnboardingPeopleStep({
  personType,
  initialSelectedIds = [],
  initialProposedIds = [],
  onSelectedIdsChange,
  onProposedIdsChange,
  onComplete,
}: OnboardingPeopleStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const isDirector = personType === "director";
  const title = isDirector ? "5 réalisateurs" : "5 acteurs ou actrices";
  const subtitle = isDirector
    ? "Fais défiler la liste et sélectionne tes réalisateurs préférés. De nouveaux noms apparaissent au fil du scroll."
    : "Fais défiler la liste et sélectionne tes acteurs préférés. De nouveaux noms apparaissent au fil du scroll.";

  const initialProposed = useMemo(
    () => [...new Set([...initialProposedIds, ...initialSelectedIds])],
    [initialProposedIds.join(","), initialSelectedIds.join(",")],
  );

  const persistState = useCallback(
    async (selected: Set<number>, proposed: number[]) => {
      const selectedArr = [...selected];
      onSelectedIdsChange?.(selectedArr);
      onProposedIdsChange?.(proposed);
      try {
        await saveOnboardingPeopleProgress(personType, selectedArr, proposed);
      } catch (e) {
        console.error("onboarding people progress save failed", e);
      }
    },
    [personType, onSelectedIdsChange, onProposedIdsChange],
  );

  const fetchPage = useCallback(
    (excludeIds: number[]) =>
      isDirector
        ? fetchOnboardingDirectorsPage(excludeIds, ONBOARDING_PEOPLE_PAGE_SIZE)
        : fetchOnboardingActorsPage(excludeIds, ONBOARDING_PEOPLE_PAGE_SIZE),
    [isDirector],
  );

  const count = selectedIds.size;
  const done = count >= ONBOARDING_PEOPLE_TARGET;

  const handleProposedPersist = useCallback(
    (proposed: number[]) => {
      void saveOnboardingPeopleProgress(personType, [...selectedIdsRef.current], proposed);
    },
    [personType],
  );

  const handleLoadError = useCallback(() => {
    toast({
      title: "Chargement impossible",
      description: "Vérifie ta connexion et réessaie.",
      variant: "destructive",
    });
  }, [toast]);

  const {
    items: people,
    loading,
    loadingMore,
    exhausted,
    sentinelRef,
    getProposedIds,
    reload,
  } = useOnboardingInfiniteScroll({
    fetchPage,
    initialProposedIds: initialProposed,
    pageSize: ONBOARDING_PEOPLE_PAGE_SIZE,
    enabled: !done,
    onPersistProposed: handleProposedPersist,
    onLoadError: handleLoadError,
  });

  useEffect(() => {
    const savedSelected = initialSelectedIds.slice(0, ONBOARDING_PEOPLE_TARGET);
    setSelectedIds(new Set(savedSelected));
  }, [personType]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < ONBOARDING_PEOPLE_TARGET) next.add(id);
      void persistState(next, getProposedIds());
      onProposedIdsChange?.(getProposedIds());
      return next;
    });
  };

  const handleComplete = async () => {
    if (!user || selectedIds.size < ONBOARDING_PEOPLE_TARGET) return;
    setSaving(true);
    try {
      const selectedIdsList = [...selectedIds];
      const selected = await fetchOnboardingPeopleByIds(selectedIdsList, personType);
      if (selected.length < ONBOARDING_PEOPLE_TARGET) {
        toast({
          title: "Sélection incomplète",
          description: "Choisis 5 noms en faisant défiler la liste.",
          variant: "destructive",
        });
        return;
      }
      await Promise.all(
        selected.map((person) =>
          savePersonPreference({
            person_id: person.id,
            person_name: person.name,
            person_type: personType,
            photo_url: person.profile_path,
            preference: "liked",
            known_for: (person.known_for ?? [])
              .map((k) => k.title || k.name)
              .filter(Boolean)
              .slice(0, 5) as string[],
          }),
        ),
      );
      await persistState(new Set(selectedIdsList), getProposedIds());
      onComplete();
    } catch (e) {
      console.error("onboarding people save failed", e);
      toast({
        title: "Enregistrement impossible",
        description: "Vérifie ta connexion et réessaie.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground font-sans mb-4 leading-relaxed">{subtitle}</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="h-1.5 flex-1 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${Math.min(100, (count / ONBOARDING_PEOPLE_TARGET) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-sans tabular-nums text-foreground/50">
          {count}/{ONBOARDING_PEOPLE_TARGET}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {people.map((person) => {
            const on = selectedIds.has(person.id);
            const full = !on && count >= ONBOARDING_PEOPLE_TARGET;
            return (
              <motion.button
                key={person.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={full ? undefined : { scale: 0.99 }}
                disabled={full}
                onClick={() => toggle(person.id)}
                className={`flex items-center gap-3 w-full rounded-xl border p-2 text-left transition-all ${
                  on
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : full
                      ? "border-border/15 opacity-40"
                      : "border-border/25 hover:border-primary/30 hover:bg-foreground/[0.02]"
                }`}
              >
                <img
                  src={getPersonPhotoUrl(person.profile_path, "w92")}
                  alt=""
                  className="shrink-0 w-12 h-12 rounded-full object-cover bg-foreground/10"
                />
                <p className="flex-1 text-sm font-sans font-medium leading-snug line-clamp-2">
                  {person.name}
                </p>
                <span
                  className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground/20"
                  }`}
                >
                  {on ? <Check className="w-4 h-4" /> : null}
                </span>
              </motion.button>
            );
          })}

          <div ref={sentinelRef} className="h-1" aria-hidden />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
            </div>
          )}

          {!loadingMore && exhausted && people.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground font-sans">
                Impossible de charger les profils pour le moment.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
                Réessayer
              </Button>
            </div>
          )}

          {!loadingMore && exhausted && people.length > 0 && (
            <p className="text-center text-[11px] text-muted-foreground font-sans py-2">
              Fin de la liste — tu peux continuer avec tes {count} choix.
            </p>
          )}
        </div>
      )}

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!done || saving}
        onClick={() => void handleComplete()}
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
          </>
        ) : (
          <>
            Continuer <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </OnboardingStepLayout>
  );
}
