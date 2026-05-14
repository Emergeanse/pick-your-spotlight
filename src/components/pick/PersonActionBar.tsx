import { useState, useCallback } from "react";
import { Heart, ThumbsDown, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { savePersonPreference, deletePersonPreference, type PersonType, type PreferenceValue } from "@/lib/people-preferences";

interface PersonActionBarProps {
  person: {
    id: number;
    name: string;
    profile_path?: string | null;
    known_for_department?: string | null;
    known_for?: Array<{ title?: string; name?: string }>;
  };
  size?: "sm" | "md";
  className?: string;
  onInteraction?: (type: string) => void;
  currentPreference?: PreferenceValue | null;
}

const PersonActionBar = ({
  person,
  size = "md",
  className = "",
  onInteraction,
  currentPreference,
}: PersonActionBarProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preference, setPreference] = useState<PreferenceValue | null>(currentPreference || null);

  const personType: PersonType = person.known_for_department === "Directing" ? "director" : "actor";
  const knownForTitles = (person.known_for || [])
    .map((m) => m.title || m.name)
    .filter(Boolean)
    .slice(0, 3) as string[];

  const requireAuth = () => {
    if (!user) {
      toast.info("Connecte-toi pour enrichir ton profil !");
      return false;
    }
    return true;
  };

  const handlePreference = useCallback(
    async (pref: PreferenceValue) => {
      if (!requireAuth()) return;

      setLoading(true);
      try {
        const isCurrentlyActive = preference === pref;

        if (isCurrentlyActive) {
          // Remove preference
          await deletePersonPreference(person.id);
          setPreference(null);
          toast.success("Avis retiré");
        } else {
          // Save new preference
          await savePersonPreference({
            person_id: person.id,
            person_name: person.name,
            person_type: personType,
            photo_url: person.profile_path || null,
            preference: pref,
            known_for: knownForTitles,
          });
          setPreference(pref);

          const toastMap: Record<PreferenceValue, string> = {
            loved: "Adoré !",
            liked: "Aimé",
            disliked: "Pas pour moi",
          };
          toast.success(toastMap[pref]);
        }

        onInteraction?.(pref);
      } catch (error) {
        console.error("Error saving preference:", error);
        toast.error("Erreur lors de la sauvegarde");
      } finally {
        setLoading(false);
      }
    },
    [preference, person, personType, knownForTitles],
  );

  const sizeClasses = {
    sm: "gap-1",
    md: "gap-3",
  };

  const buttonSizeClasses = {
    sm: "p-1.5 text-xs",
    md: "p-2.5 text-sm",
  };

  const iconSizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      <button
        type="button"
        disabled={loading}
        onClick={() => handlePreference("loved")}
        className={`inline-flex items-center gap-2 rounded-full border transition-all ${
          preference === "loved"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/30 bg-foreground/[0.04] text-foreground/60 hover:border-primary/25 hover:bg-foreground/[0.08]"
        } disabled:opacity-50 disabled:cursor-not-allowed ${buttonSizeClasses[size]}`}
        title="Adoré"
      >
        <Heart className={`${iconSizeClasses[size]} ${preference === "loved" ? "fill-current" : ""}`} />
        <span className="hidden sm:inline font-medium">Adoré</span>
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() => handlePreference("liked")}
        className={`inline-flex items-center gap-2 rounded-full border transition-all ${
          preference === "liked"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/30 bg-foreground/[0.04] text-foreground/60 hover:border-primary/25 hover:bg-foreground/[0.08]"
        } disabled:opacity-50 disabled:cursor-not-allowed ${buttonSizeClasses[size]}`}
        title="Aimé"
      >
        <HelpCircle className={iconSizeClasses[size]} />
        <span className="hidden sm:inline font-medium">Aimé</span>
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() => handlePreference("disliked")}
        className={`inline-flex items-center gap-2 rounded-full border transition-all ${
          preference === "disliked"
            ? "border-red-500/50 bg-red-500/10 text-red-500"
            : "border-border/30 bg-foreground/[0.04] text-foreground/60 hover:border-red-500/25 hover:bg-foreground/[0.08]"
        } disabled:opacity-50 disabled:cursor-not-allowed ${buttonSizeClasses[size]}`}
        title="Pas pour moi"
      >
        <ThumbsDown className={iconSizeClasses[size]} />
        <span className="hidden sm:inline font-medium">Pas pour moi</span>
      </button>
    </div>
  );
};

export default PersonActionBar;
