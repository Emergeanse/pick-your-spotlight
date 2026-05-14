import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPersonPhotoUrl } from "@/lib/people-preferences";

type PersonLike = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
  known_for?: Array<{ title?: string; name?: string }>;
  birthday?: string | null;
  place_of_birth?: string | null;
  biography?: string | null;
};

export interface RecommendationPersonCardProps {
  person: PersonLike;
  onOpenDetails?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  className?: string;
}

function computeAge(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function extractNationality(placeOfBirth: string | null | undefined): string | null {
  if (!placeOfBirth) return null;
  const parts = placeOfBirth.split(",").map((s) => s.trim());
  return parts[parts.length - 1] || null;
}

const RecommendationPersonCard = ({ person, onOpenDetails, onPrevious, onNext, canGoPrevious = true, canGoNext = true, className = "" }: RecommendationPersonCardProps) => {
  const isDirector = person.known_for_department === "Directing";
  const age = computeAge(person.birthday);
  const nationality = extractNationality(person.place_of_birth);
  const shortBio = person.biography?.split(".").slice(0, 2).join(".").trim();
  const knownForTitles = (person.known_for || [])
    .map((m) => m.title || m.name)
    .filter(Boolean)
    .slice(0, 3) as string[];

  const infoChips: string[] = [];
  if (age) infoChips.push(`${age} ans`);
  if (nationality) infoChips.push(nationality);

  const personImage = getPersonPhotoUrl(person.profile_path, "w342");
  const content = (
    <div className="group relative overflow-hidden rounded-[1.75rem] border border-border/20 bg-background shadow-[0_24px_80px_hsl(var(--background)/0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_90px_hsl(var(--background)/0.16)]">
      {(onPrevious || onNext) && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrevious?.();
            }}
            disabled={!canGoPrevious}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/20 bg-background/80 p-2 text-foreground/60 shadow-sm transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            disabled={!canGoNext}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/20 bg-background/80 p-2 text-foreground/60 shadow-sm transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
      <div className="grid gap-4 p-4 sm:grid-cols-[140px_1fr]">
        <div className="overflow-hidden rounded-3xl bg-slate-950/10 shadow-inner">
          <img
            src={personImage}
            alt={person.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            draggable={false}
          />
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-sans font-semibold uppercase tracking-[0.18em] text-primary">
                {isDirector ? "Réalisateur/Réalisatrice" : "Acteur/Actrice"}
              </span>
              {infoChips.map((chip) => (
                <span key={chip} className="rounded-full bg-foreground/5 px-2 py-1 text-[10px] font-sans text-foreground/70">
                  {chip}
                </span>
              ))}
            </div>

            <h3 className="mt-3 text-xl font-serif font-bold text-foreground leading-tight">{person.name}</h3>
            {shortBio && <p className="mt-2 text-sm leading-relaxed text-foreground/70 line-clamp-3">{shortBio}.</p>}
          </div>

          {knownForTitles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {knownForTitles.map((title) => (
                <span key={title} className="rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] font-sans text-foreground/70">
                  {title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative mx-auto w-full max-w-[400px] ${className}`} style={{ width: "min(68vw, 30vh, 400px)" }}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={person.id}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative w-full select-none"
        >
          {onOpenDetails ? (
            <div
              role="button"
              tabIndex={0}
              onClick={onOpenDetails}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenDetails();
                }
              }}
              className="block w-full text-left"
            >
              {content}
            </div>
          ) : (
            content
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RecommendationPersonCard;
