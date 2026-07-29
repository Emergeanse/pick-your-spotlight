import { useNavigate } from "react-router-dom";
import WatchlistPage from "@/components/pick/WatchlistPage";
import watchlistBackground from "@/assets/watchlist-background.webp";
import type { MovieDetail } from "@/lib/tmdb";

const WatchlistRoute = () => {
  const navigate = useNavigate();

  const handleMovieSelect = (movie: MovieDetail) => {
    navigate("/app", { state: { selectedMovie: movie } });
  };

  return (
    <div className="fixed inset-0 bg-background">
      {/* Image visible en haut, fondue très progressivement */}
      <div
        className="absolute inset-x-0 top-0 h-[80%] bg-cover bg-top bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${watchlistBackground})`, maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", opacity: 0.4 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background)/0.3) 60%, hsl(var(--background)/0.9) 85%, hsl(var(--background)) 100%)" }}
      />
      <div className="h-full pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] relative">
        <WatchlistPage
          onMovieSelect={handleMovieSelect}
          tabs={["watchlist"]}
          title="Ici c'est tes pépites !"
        />
      </div>
    </div>
  );
};

export default WatchlistRoute;
