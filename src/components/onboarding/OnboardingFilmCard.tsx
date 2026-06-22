import { motion } from "framer-motion";
import { Clock, Star } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getBackdropUrl, getDisplayTitle, getPosterUrl, getYear } from "@/lib/tmdb";

interface OnboardingFilmCardProps {
  movie: MovieDetail;
}

function originLabel(movie: MovieDetail): string | null {
  const lang = (movie as MovieDetail & { original_language?: string }).original_language;
  if (lang === "fr") return "Cinéma français";
  if (lang === "en") return "Blockbuster US";
  return null;
}

export function OnboardingFilmCardSkeleton() {
  return (
    <div className="w-full max-w-sm mx-auto animate-pulse">
      <div className="relative rounded-3xl overflow-hidden border border-border/20 bg-card/40 p-6">
        <div className="mx-auto w-44 h-[264px] md:w-48 md:h-[288px] rounded-2xl bg-foreground/10" />
        <div className="mt-5 h-7 w-3/4 mx-auto rounded-lg bg-foreground/10" />
        <div className="mt-3 flex justify-center gap-2">
          <div className="h-6 w-14 rounded-lg bg-foreground/8" />
          <div className="h-6 w-20 rounded-lg bg-foreground/8" />
        </div>
        <div className="mt-4 space-y-2 px-2">
          <div className="h-3 w-full rounded bg-foreground/8" />
          <div className="h-3 w-5/6 mx-auto rounded bg-foreground/8" />
        </div>
      </div>
    </div>
  );
}

export default function OnboardingFilmCard({ movie }: OnboardingFilmCardProps) {
  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const runtime = movie.runtime || movie.episode_run_time?.[0] || 0;
  const genres = movie.genres?.slice(0, 3).map((g) => g.name) ?? [];
  const poster = getPosterUrl(movie.poster_path, "w500");
  const backdrop = getBackdropUrl(movie.backdrop_path) || poster;
  const origin = originLabel(movie);
  const overview = movie.overview?.trim();

  return (
    <article className="relative w-full max-w-sm mx-auto">
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)]">
        {backdrop && (
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}
        <div className="absolute inset-0 backdrop-blur-2xl bg-background/75" />
        <div className="absolute inset-0 poster-gradient opacity-90" />

        <div className="relative z-10 px-5 pt-6 pb-5 flex flex-col items-center text-center">
          {origin && (
            <span className="mb-4 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-sans font-semibold uppercase tracking-widest text-primary/90">
              {origin}
            </span>
          )}

          {poster && (
            <div className="relative mb-5">
              <motion.div
                aria-hidden
                animate={{ opacity: [0.45, 0.75, 0.45] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-5 rounded-3xl -z-10 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, hsl(var(--primary) / 0.35) 0%, hsl(var(--primary) / 0.08) 50%, transparent 72%)",
                  filter: "blur(18px)",
                }}
              />
              <motion.img
                src={poster}
                alt={title}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-44 h-[264px] md:w-48 md:h-[288px] rounded-2xl object-cover border border-white/15 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.85),0_0_32px_-8px_hsl(var(--primary)/0.35)]"
              />
              <motion.div
                aria-hidden
                initial={{ opacity: 0, x: "-120%" }}
                animate={{ opacity: [0, 0.55, 0], x: "180%" }}
                transition={{ duration: 1.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 w-1/3"
                  style={{
                    background:
                      "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
                  }}
                />
              </motion.div>
            </div>
          )}

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="font-serif text-2xl md:text-[1.65rem] leading-tight text-foreground px-1"
          >
            {title}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.4 }}
            className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[11px] font-sans text-foreground/55"
          >
            {year && (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 font-medium text-foreground/75">
                {year}
              </span>
            )}
            {runtime > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {runtime} min
              </span>
            )}
            {movie.vote_average > 0 && (
              <span className="inline-flex items-center gap-1 text-primary/90 font-medium">
                <Star className="w-3 h-3 fill-primary" />
                {movie.vote_average.toFixed(1)}
              </span>
            )}
          </motion.div>

          {genres.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              className="mt-2 text-[10px] font-sans uppercase tracking-[0.14em] text-primary/65 font-medium"
            >
              {genres.join(" · ")}
            </motion.p>
          )}

          {overview && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32, duration: 0.45 }}
              className="mt-4 text-sm leading-relaxed text-foreground/65 font-sans line-clamp-3 px-1"
            >
              {overview}
            </motion.p>
          )}
        </div>
      </div>
    </article>
  );
}
