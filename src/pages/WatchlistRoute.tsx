import { useNavigate } from "react-router-dom";
import WatchlistPage from "@/components/pick/WatchlistPage";
import watchlistBackground from "@/assets/watchlist-background.png";
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
        className="absolute inset-x-0 top-0 h-[60%] bg-cover bg-top bg-no-repeat pointer-events-none opacity-40"
        style={{ backgroundImage: `url(${watchlistBackground})` }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 20%, hsl(var(--background)/0.5) 50%, hsl(var(--background)/0.85) 75%, hsl(var(--background)) 100%)" }}
      />
      <div className="h-full pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))] relative">
        <WatchlistPage
          onMovieSelect={handleMovieSelect}
          tabs={["watchlist"]}
          title="À voir"
        />
      </div>
    </div>
  );
};

export default WatchlistRoute;
