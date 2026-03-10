import { useState } from "react";
import { Button } from "@/components/ui/button";

interface HomeScreenProps {
  onStart: () => void;
  onSurprise: () => void;
  loading: boolean;
}

const HomeScreen = ({ onStart, onSurprise, loading }: HomeScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onStart();
    }, 1600);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 film-grain">
      <div className="text-center max-w-2xl relative z-10">
        <h1 className="text-5xl md:text-7xl font-serif leading-tight mb-4 tracking-wide">
          Don't know what to watch?
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl mb-3 font-light">
          Pick vous trouve le film parfait en moins de 30 secondes.
        </p>
        <p className="text-muted-foreground/60 text-sm mb-12 font-sans">
          Basé sur votre humeur, votre temps disponible et vos plateformes
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {/* Primary CTA with signature loading animation */}
          <div className="relative w-full sm:w-auto">
            <Button
              variant="hero"
              size="xl"
              className="w-full sm:w-auto min-w-[280px] relative overflow-hidden"
              onClick={handleStart}
              disabled={isLoading || loading}
            >
              {isLoading ? (
                <span className="relative z-10 opacity-0">Find something to watch</span>
              ) : (
                "Find something to watch"
              )}
              {isLoading && (
                <div className="absolute inset-0 flex items-center">
                  <div className="h-full bg-primary-foreground/20 animate-fill-bar" />
                </div>
              )}
            </Button>
          </div>

          {/* Surprise Me */}
          <Button
            variant="heroOutline"
            size="xl"
            className="w-full sm:w-auto min-w-[200px]"
            onClick={onSurprise}
            disabled={isLoading || loading}
          >
            {loading ? "..." : "Surprise me"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
