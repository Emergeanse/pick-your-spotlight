import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Star, Clock, Users, Zap, Heart, Sun, Brain, Film, Smile } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getDisplayTitle, getYear, getBackdropUrl, getPosterUrl, getWatchProviders } from "@/lib/tmdb";
import type { Mood, Context, TimeAvailable } from "@/lib/tmdb";

interface ResultScreenProps {
  movie: MovieDetail;
  onShowAnother: () => void;
  onRestart: () => void;
  hasMore: boolean;
  matchScore?: number;
  matchLabel?: string;
  userCriteria?: {
    mood: Mood | null;
    context: Context | null;
    time: TimeAvailable | null;
    genreIds: number[];
    platformIds: number[];
  };
}

const IMG_BASE = "https://image.tmdb.org/t/p";

const moodLabels: Record<Mood, { label: string; icon: React.ElementType }> = {
  relax: { label: "Détente", icon: Sun },
  excited: { label: "Adrénaline", icon: Zap },
  romantic: { label: "Romance", icon: Heart },
  "mind-blowing": { label: "Vertige", icon: Brain },
  "easy-watch": { label: "Léger", icon: Film },
  fun: { label: "Rire", icon: Smile },
};

const contextLabels: Record<Context, string> = {
  alone: "Seul·e",
  couple: "En couple",
  friends: "Entre amis",
  family: "En famille",
};

const timeLabels: Record<TimeAvailable, string> = {
  short: "Film court (< 90 min)",
  "movie-night": "Soirée ciné",
  episode: "Un épisode",
};

const ResultScreen = ({ movie, onShowAnother, onRestart, hasMore, matchScore, matchLabel, userCriteria }: ResultScreenProps) => {
  const [providers, setProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w780");
  const runtime = movie.runtime || (movie.episode_run_time?.[0]) || 0;
  const genres = movie.genres?.map(g => g.name).join(", ") || "";
  const overview = movie.overview || "Aucune description disponible.";
  const mediaType = movie.first_air_date ? "tv" : "movie";

  const bgImage = backdrop || poster;

  useEffect(() => {
    getWatchProviders(movie.id, mediaType).then(setProviders).catch(() => setProviders([]));
  }, [movie.id, mediaType]);

  // Build "why it matches" reasons
  const matchReasons: string[] = [];
  if (userCriteria) {
    if (userCriteria.mood) {
      const m = moodLabels[userCriteria.mood];
      matchReasons.push(`Ambiance « ${m.label} » — correspond à votre humeur`);
    }
    if (userCriteria.genreIds.length > 0 && movie.genres) {
      const matchedGenres = movie.genres.filter(g => userCriteria.genreIds.includes(g.id));
      if (matchedGenres.length > 0) {
        matchReasons.push(`Genre${matchedGenres.length > 1 ? "s" : ""} : ${matchedGenres.map(g => g.name).join(", ")}`);
      }
    }
    if (userCriteria.context) {
      matchReasons.push(`Parfait pour regarder ${contextLabels[userCriteria.context].toLowerCase()}`);
    }
    if (userCriteria.time) {
      if (userCriteria.time === "short" && runtime > 0 && runtime <= 90) {
        matchReasons.push(`Durée courte (${runtime} min) — idéal pour votre temps disponible`);
      } else if (userCriteria.time === "movie-night") {
        matchReasons.push(`Film complet pour votre soirée ciné`);
      } else if (userCriteria.time === "episode") {
        matchReasons.push(`Format épisode, parfait pour un moment rapide`);
      }
    }
    if (userCriteria.platformIds.length > 0 && providers.length > 0) {
      matchReasons.push(`Disponible sur vos plateformes`);
    }
    if (movie.vote_average >= 7.5) {
      matchReasons.push(`Très bien noté (★ ${movie.vote_average.toFixed(1)})`);
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative min-h-screen w-full">
        {bgImage && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}

        <div className="absolute inset-0 poster-gradient" />

        <div className="relative z-10 flex flex-col justify-end min-h-screen p-6 md:p-12 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl"
          >
            {/* Match score + emotional label */}
            {matchLabel && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mb-4 flex items-center gap-3"
              >
                {matchScore > 0 && (
                  <span className="bg-primary/20 text-primary text-xs font-sans font-semibold px-3 py-1 rounded-full border border-primary/30">
                    {matchScore}% match
                  </span>
                )}
                <span className="text-primary/80 text-sm font-sans font-light italic">
                  {matchLabel}
                </span>
              </motion.div>
            )}

            {genres && (
              <p className="text-muted-foreground text-sm mb-3 tracking-wider uppercase font-sans">
                {genres}
              </p>
            )}

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif mb-4 leading-tight">
              {title}
            </h1>

            <div className="flex items-center gap-4 text-muted-foreground text-sm mb-6 font-sans">
              {year && <span>{year}</span>}
              {runtime > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <span>{runtime} min</span>
                </>
              )}
              {movie.vote_average > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <span>★ {movie.vote_average.toFixed(1)}</span>
                </>
              )}
            </div>

            {/* Streaming platforms */}
            {providers.length > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <span className="text-muted-foreground text-xs font-sans">Disponible sur</span>
                <div className="flex gap-2">
                  {providers.map((p) => (
                    <img
                      key={p.name}
                      src={`${IMG_BASE}/w92${p.logo_path}`}
                      alt={p.name}
                      title={p.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mb-6 max-w-lg font-sans font-light">
              {showDetails ? overview : (overview.length > 200 ? overview.substring(0, 200) + "…" : overview)}
            </p>

            {/* Expand / collapse details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-primary/70 hover:text-primary text-sm font-sans mb-6 transition-colors cursor-pointer"
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showDetails ? "Moins d'infos" : "Plus d'infos"}
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="overflow-hidden mb-8"
                >
                  <div className="space-y-4">
                    {/* Full synopsis if was truncated */}
                    {overview.length > 200 && (
                      <div>
                        <h3 className="text-foreground/60 text-xs uppercase tracking-wider font-sans mb-2">Synopsis complet</h3>
                        <p className="text-foreground/70 text-sm leading-relaxed font-sans font-light max-w-lg">
                          {overview}
                        </p>
                      </div>
                    )}

                    {/* Movie details grid */}
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      {year && (
                        <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                          <span className="text-muted-foreground text-xs font-sans block mb-1">Année</span>
                          <span className="text-foreground text-sm font-sans">{year}</span>
                        </div>
                      )}
                      {runtime > 0 && (
                        <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                          <span className="text-muted-foreground text-xs font-sans block mb-1">Durée</span>
                          <span className="text-foreground text-sm font-sans flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary/60" />
                            {Math.floor(runtime / 60)}h{runtime % 60 > 0 ? `${String(runtime % 60).padStart(2, "0")}` : ""}
                          </span>
                        </div>
                      )}
                      {movie.vote_average > 0 && (
                        <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                          <span className="text-muted-foreground text-xs font-sans block mb-1">Note</span>
                          <span className="text-foreground text-sm font-sans flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-yellow-500" />
                            {movie.vote_average.toFixed(1)} / 10
                          </span>
                        </div>
                      )}
                      {genres && (
                        <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                          <span className="text-muted-foreground text-xs font-sans block mb-1">Genres</span>
                          <span className="text-foreground text-xs font-sans">{genres}</span>
                        </div>
                      )}
                    </div>

                    {/* Why it matches */}
                    {matchReasons.length > 0 && (
                      <div className="mt-2">
                        <h3 className="text-foreground/60 text-xs uppercase tracking-wider font-sans mb-3">
                          Pourquoi ce film est fait pour vous
                        </h3>
                        <div className="space-y-2">
                          {matchReasons.map((reason, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08, duration: 0.3 }}
                              className="flex items-start gap-2.5"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                              <span className="text-foreground/70 text-sm font-sans font-light">{reason}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row gap-4">
              {hasMore && (
                <Button
                  variant="heroOutline"
                  size="xl"
                  onClick={onShowAnother}
                >
                  Autre suggestion
                </Button>
              )}
              <Button
                variant="ghost"
                size="xl"
                className="text-muted-foreground hover:text-foreground"
                onClick={onRestart}
              >
                Recommencer
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;
