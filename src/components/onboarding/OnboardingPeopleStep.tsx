import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface OnboardingPeopleStepProps {
  personType: PersonType;
  onBack: () => void;
  onComplete: () => void;
}

export default function OnboardingPeopleStep({
  personType,
  onBack,
  onComplete,
}: OnboardingPeopleStepProps) {
  const { user } = useAuth();
  const [people, setPeople] = useState<OnboardingPerson[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirector = personType === "director";
  const title = isDirector ? "5 réalisateurs" : "5 acteurs ou actrices";
  const subtitle = isDirector
    ? "Choisis ceux dont tu reconnais le style — même un « j'aime » suffit."
    : "Choisis ceux que tu aimes voir à l'écran — des noms que tu reconnais.";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      isDirector ? fetchOnboardingDirectors() : fetchOnboardingActors(),
      user ? getUserPeoplePreferences() : Promise.resolve([]),
    ])
      .then(([pool, prefs]) => {
        if (cancelled) return;
        setPeople(pool);
        const existing = new Set(
          prefs
            .filter((p) => p.person_type === personType && (p.preference === "liked" || p.preference === "loved"))
            .map((p) => p.person_id),
        );
        setSelectedIds(existing);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personType, user?.id]);

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
    } finally {
      setSaving(false);
    }
  };

  const count = selectedIds.size;
  const done = count >= ONBOARDING_PEOPLE_TARGET;

  return (
    <div className="flex flex-col min-h-full px-5 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <h1 className="text-2xl md:text-3xl font-serif mb-2 max-w-lg">{title}</h1>
      <p className="text-sm text-muted-foreground font-sans mb-4 max-w-lg leading-relaxed">{subtitle}</p>

      <div className="flex items-center gap-3 mb-4 max-w-lg">
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
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-w-lg mb-6">
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
        className="w-full max-w-lg"
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
    </div>
  );
}
