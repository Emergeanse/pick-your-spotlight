import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WatchlistPage from "@/components/pick/WatchlistPage";

import type { MovieDetail } from "@/lib/tmdb";

const WatchlistRoute = () => {
  const navigate = useNavigate();

  const handleMovieSelect = (movie: MovieDetail) => {
    // Navigate to app and pass movie through state
    navigate("/app", { state: { selectedMovie: movie } });
  };

  return (
    <div className="fixed inset-0 bg-background">
      <div className="h-full pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
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
