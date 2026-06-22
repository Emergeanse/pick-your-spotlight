import { ThumbsDown, ThumbsUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setFeedback } from "@/lib/feedback";
import type { MovieDetail } from "@/lib/tmdb";
import { inferCatalogMediaType } from "@/lib/catalog";

export type OnboardingFilmChoice = "liked" | "disliked" | "unknown";

interface OnboardingFilmActionBarProps {
  movie: MovieDetail;
  onChoice: (choice: OnboardingFilmChoice) => void;
  disabled?: boolean;
}

export default function OnboardingFilmActionBar({
  movie,
  onChoice,
  disabled,
}: OnboardingFilmActionBarProps) {
  const mediaType = inferCatalogMediaType(movie);
  const meta = {
    title: movie.title || movie.name,
    poster_path: movie.poster_path,
    media_type: mediaType,
  };

  const run = async (choice: OnboardingFilmChoice, feedback: "like" | "dislike" | "unknown") => {
    if (disabled) return;
    try {
      await setFeedback(movie.id, feedback, meta, {
        context_type: "browse",
        source: "onboarding",
      });
    } catch {
      // Le parcours continue même si la persistance échoue
    }
    onChoice(choice);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="hero"
          size="lg"
          disabled={disabled}
          className="h-12 rounded-xl font-sans text-sm gap-2"
          onClick={() => void run("liked", "like")}
        >
          <ThumbsUp className="w-4 h-4" /> J&apos;aime
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={disabled}
          className="h-12 rounded-xl font-sans text-sm gap-2 border-border/40"
          onClick={() => void run("disliked", "dislike")}
        >
          <ThumbsDown className="w-4 h-4" /> Pas pour moi
        </Button>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void run("unknown", "unknown")}
        className="w-full py-2.5 text-[11px] font-sans text-foreground/45 flex items-center justify-center gap-1.5 hover:text-foreground/65 disabled:opacity-40"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Je ne connais pas ce film
      </button>
    </div>
  );
}
