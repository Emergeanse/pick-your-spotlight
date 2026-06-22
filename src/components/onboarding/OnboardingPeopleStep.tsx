import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchOnboardingActors,
  fetchOnboardingDirectors,
  getPersonPhotoUrl,
  ONBOARDING_PEOPLE_TARGET,
  type OnboardingPerson,
} from "@/lib/onboarding-people";
import {
  getUserPeoplePreferences,
  savePersonPreference,
  type PersonType,
} from "@/lib/people-preferences";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";

interface OnboardingPeopleStepProps {
  personType: PersonType;
  onComplete: () => void;
}

export default function OnboardingPeopleStep({
  personType,
  onComplete,
}: OnboardingPeopleStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [people, setPeople] = useState<OnboardingPerson[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirector = personType === "director";
  const title = isDirector ? "5 réalisateurs" : "5 acteurs ou actrices";
  const subtitle = isDirector
    ? "10 noms au hasard — sélectionne 5. Pas assez de noms connus ? Actualise la liste."
    : "10 noms au hasard — sélectionne 5. Pas assez de noms connus ? Actualise la liste.";

  const loadPool = useCallback(
    async (pinnedIds: number[], opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      try {
        const fetchPool = isDirector ? fetchOnboardingDirectors : fetchOnboardingActors;
        const pool = await fetchPool(pinnedIds);
        setPeople(pool);
        setSelectedIds((prev) => {
          const poolIds = new Set(pool.map((p) => p.id));
          const next = new Set<number>();
          prev.forEach((id) => {
            if (poolIds.has(id)) next.add(id);
          });
          return next;
        });
        return pool;
      } catch (e) {
        console.error("onboarding people load failed", e);
        toast({
          title: "Chargement impossible",
          description: "Vérifie ta connexion et réessaie.",
          variant: "destructive",
        });
        return [];
      } finally {
        if (!opts?.silent) setLoading(false);
        else setRefreshing(false);
      }
    },
    [isDirector, toast],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPeople([]);
    setSelectedIds(new Set());

    Promise.all([
      isDirector ? fetchOnboardingDirectors() : fetchOnboardingActors(),
      user ? getUserPeoplePreferences() : Promise.resolve([]),
    ])
      .then(([pool, prefs]) => {
        if (cancelled) return;
        setPeople(pool);
        const poolIds = new Set(pool.map((p) => p.id));
        const existing = new Set(
          prefs
            .filter(
              (p) =>
                p.person_type === personType &&
                poolIds.has(p.person_id) &&
                (p.preference === "liked" || p.preference === "loved"),
            )
            .map((p) => p.person_id),
        );
        setSelectedIds(existing);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [personType, user?.id, isDirector]);

  const handleRefresh = () => {
    if (selectedIds.size >= ONBOARDING_PEOPLE_TARGET) return;
    void loadPool([...selectedIds], { silent: true });
  };

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < ONBOARDING_PEOPLE_TARGET) next.add(id);
      return next;
    });
  };

  const handleComplete = async () => {
    if (!user || selectedIds.size < ONBOARDING_PEOPLE_TARGET) return;
    setSaving(true);
    try {
      const selected = people.filter((p) => selectedIds.has(p.id));
      if (selected.length < ONBOARDING_PEOPLE_TARGET) {
        toast({
          title: "Sélection incomplète",
          description: "Choisis 5 noms ou actualise la liste pour en trouver d'autres.",
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

  const count = selectedIds.size;
  const done = count >= ONBOARDING_PEOPLE_TARGET;
  const canRefresh = !loading && !done;

  return (
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground font-sans mb-4 leading-relaxed">{subtitle}</p>

      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-sans text-foreground/40 uppercase tracking-wide">
          {people.length} proposés · choisis {ONBOARDING_PEOPLE_TARGET}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!canRefresh || refreshing}
          className="inline-flex items-center gap-1.5 text-[11px] font-sans font-medium text-primary/80 hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualisation…" : "Autres noms"}
        </button>
      </div>

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-6">
          {people.map((person, i) => {
            const on = selectedIds.has(person.id);
            const full = !on && count >= ONBOARDING_PEOPLE_TARGET;
            return (
              <motion.button
                key={person.id}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.025 }}
                whileTap={full ? undefined : { scale: 0.96 }}
                disabled={full}
                onClick={() => toggle(person.id)}
                className={`relative rounded-xl overflow-hidden border text-left transition-all ${
                  on
                    ? "border-primary ring-2 ring-primary/30"
                    : full
                      ? "border-border/15 opacity-40"
                      : "border-border/25 hover:border-primary/30"
                }`}
              >
                <img
                  src={getPersonPhotoUrl(person.profile_path, "w185")}
                  alt={person.name}
                  className="w-full aspect-[2/3] object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pt-6 pb-1.5">
                  <p className="text-[9px] font-sans font-semibold text-white leading-tight line-clamp-2">
                    {person.name}
                  </p>
                </div>
                {on && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </span>
                )}
              </motion.button>
            );
          })}
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
