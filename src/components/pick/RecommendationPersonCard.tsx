import { motion } from "framer-motion";
import { Film, User, Clapperboard } from "lucide-react";
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

const RecommendationPersonCard = ({
  person,
  onOpenDetails,
  className = "",
}: RecommendationPersonCardProps) => {
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

  const CardContent = (
    <div className="absolute inset-0 rounded-[1.75rem] overflow-hidden shadow-[0_24px_80px_hsl(var(--background)/0.72)] cursor-pointer">
      <img
        src={getPersonPhotoUrl(person.profile_path, "w780")}
        alt={person.name}
        className="absolute inset-0 h-full w-full object-cover brightness-[1.3] contrast-[1.08] saturate-[1.3]"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10 z-[1]" />

      <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-background via-background/70 to-transparent px-4 pt-24 pb-4">
        <h3 className="mb-0.5 text-lg font-serif font-bold text-white drop-shadow-md leading-tight">{person.name}</h3>
        <p className="mb-1 text-[11px] font-sans text-white/55">
          {isDirector ? "Réalisateur/Réalisatrice" : "Acteur/Actrice"}
          {infoChips.length > 0 && ` · ${infoChips.join(" · ")}`}
        </p>
        {shortBio && (
          <p className="mb-2 text-[10px] font-sans leading-snug text-white/40 line-clamp-2">{shortBio}.</p>
        )}
        {knownForTitles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {knownForTitles.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/65 backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="absolute top-3 left-3 z-[2] rounded-full bg-background/30 px-2 py-1 backdrop-blur-sm flex items-center gap-1.5">
        {isDirector ? <Clapperboard className="h-3 w-3 text-white/65" /> : <User className="h-3 w-3 text-white/65" />}
        <span className="text-[9px] font-sans text-white/50">Vignette</span>
      </div>

      <div className="absolute top-3 right-3 z-[2] rounded-full bg-background/30 px-2 py-1 backdrop-blur-sm flex items-center gap-1.5">
        <Film className="h-3 w-3 text-white/65" />
        <span className="text-[9px] font-sans text-white/50">Tap pour détails</span>
      </div>
    </div>
  );

  return (
    <div className={`relative mx-auto w-full max-w-[280px] ${className}`} style={{ width: "min(68vw, 30vh, 280px)" }}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={person.id}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative aspect-[3/4] w-full select-none"
        >
          {onOpenDetails ? (
            <button type="button" onClick={onOpenDetails} className="absolute inset-0 block w-full text-left">
              {CardContent}
            </button>
          ) : (
            CardContent
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RecommendationPersonCard;
