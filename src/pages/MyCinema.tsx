import { useNavigate } from "react-router-dom";
import WatchlistPage from "@/components/pick/WatchlistPage";
import type { MovieDetail } from "@/lib/tmdb";

const MyCinema = () => {
  const navigate = useNavigate();

  const handleMovieSelect = (movie: MovieDetail) => {
    navigate("/app", { state: { selectedMovie: movie } });
  };

  return (
    <div className="fixed inset-0 bg-background">
      <div className="h-full pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        <WatchlistPage
          onMovieSelect={handleMovieSelect}
          tabs={["liked", "loved", "seen", "disliked"]}
          title="Ma Bibliothèque"
          defaultTab="liked"
        />
      </div>
    </div>
  );
};

export default MyCinema;
