import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setFeedback } from "@/lib/feedback";
import { getMovieDetails } from "@/lib/tmdb";

export type AmbianceMood = "intense" | "mysterious" | "comfort" | "couple" | "surprise";

type LastReco = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType: "movie" | "tv";
  itemId: string;
  currentScore: number;
  createdAt: string | null;
  watchedWith: string | null;
};

interface Props {
  onPickAmbiance: (mood: AmbianceMood) => void;
  activeAmbiance?: AmbianceMood | null;
}

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// Unified premium surface — same family across all home cards
const PREMIUM_SURFACE =
  "rounded-3xl border-white/[0.05] bg-[linear-gradient(180deg,hsl(240_14%_9%/0.85),hsl(240_18%_5%/0.7))] backdrop-blur-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)]";

const SECTION_EYEBROW =
  "text-[10.5px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40";

const HomeAmbianceSection = ({ onPickAmbiance, activeAmbiance }: Props) => {
  const { user } = useAuth();
  const [lastReco, setLastReco] = useState<LastReco | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_item_feedback")
        .select("item_id, score, created_at, catalog_items:item_id(id, tmdb_id, title, poster_path, media_type)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled || !data?.length) return;
      const row = data[0] as any;
      const ci = row.catalog_items;
      if (!ci?.tmdb_id) return;
      const mediaType = (ci.media_type as "movie" | "tv") || "movie";
      let title: string = ci.title;
      let posterPath: string | null = ci.poster_path ?? null;
      if (!title || /^TMDB #\d+$/.test(title) || !posterPath) {
        try {
          const detail = await getMovieDetails(ci.tmdb_id, mediaType);
          if (detail) {
            title = detail.title || title;
            posterPath = detail.poster_path || posterPath;
          }
        } catch {}
      }
      // Nom du duo partenaire si disponible
      let watchedWith: string | null = null;
      try {
        const { data: duoData } = await supabase
          .from("duo_profiles" as any)
          .select("user1_id, user2_id, user1_display_name, user2_display_name")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .limit(1);
        const duo = (duoData as any[])?.[0];
        if (duo) {
          watchedWith = duo.user1_id === user.id ? duo.user2_display_name : duo.user1_display_name;
        }
      } catch {}
      if (cancelled) return;
      setLastReco({
        tmdbId: ci.tmdb_id,
        title,
        posterPath,
        mediaType,
        itemId: ci.id,
        currentScore: row.score || 0,
        createdAt: row.created_at ?? null,
        watchedWith,
      });
      if (row.score) setRating(Math.round(row.score));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleRate = async (n: number) => {
    if (!lastReco || submitted) return;
    setRating(n);
    setSubmitted(true);
    try {
      const type = n >= 4 ? "love" : n >= 3 ? "like" : n >= 2 ? "seen" : "not_for_me";
      await setFeedback(lastReco.tmdbId, type as any, { media_type: lastReco.mediaType });
    } catch (e) {
      console.error("[rate]", e);
    }
  };

  return (
    <div className="px-4 md:px-8 space-y-4">
      {/* ─── Last Reco Rating Card ─── */}
      {lastReco && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`relative mt-2.5 ${PREMIUM_SURFACE} p-2 border-4`}
        >
          <div className="flex gap-2.5 items-stretch">
            <div className="relative flex-shrink-0 w-[44px] h-[66px] rounded-lg overflow-hidden border border-white/[0.06] shadow-[0_14px_36px_-14px_rgba(0,0,0,0.8)]">
              {lastReco.posterPath ? (
                <img
                  src={`${POSTER_BASE}${lastReco.posterPath}`}
                  alt={lastReco.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between py-0">
              <div>
                <p className={SECTION_EYEBROW}>Ta dernière séance</p>
                <p className="mt-0.5 font-serif text-foreground text-[13px] leading-[1.15] tracking-tight line-clamp-1">
                  {lastReco.title}
                </p>
                {lastReco.createdAt && (() => {
                  const diff = Math.floor((Date.now() - new Date(lastReco.createdAt!).getTime()) / 86400000);
                  const dateStr = diff === 0 ? "Aujourd'hui" : diff === 1 ? "Hier" : `Il y a ${diff} j.`;
                  const withStr = lastReco.watchedWith ? ` · avec ${lastReco.watchedWith}` : "";
                  return (
                    <p className="mt-0.5 text-[10px] font-sans text-foreground/45 leading-snug">
                      {dateStr}{withStr}
                    </p>
                  );
                })()}
                <p className="mt-0.5 text-[10px] font-sans text-foreground/40 leading-snug">
                  {submitted ? "Merci — j'affine ton goût." : "Comment tu l'as vécu ?"}
                </p>
              </div>

              <div
                className="mt-1.5 flex items-center gap-0.5"
                onMouseLeave={() => setHovered(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = (hovered || rating) >= n;
                  return (
                    <motion.button
                      key={n}
                      type="button"
                      whileTap={{ scale: 0.82 }}
                      whileHover={{ scale: 1.1 }}
                      onMouseEnter={() => setHovered(n)}
                      onClick={() => handleRate(n)}
                      className="p-0.5 -ml-0.5"
                      aria-label={`Note ${n}/5`}
                    >
                      <Star
                        className={`w-[16px] h-[16px] transition-all ${
                          filled
                            ? "fill-primary text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]"
                            : "text-foreground/45"
                        }`}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  );
                })}
              </div>
            </div>

          </div>
        </motion.div>
      )}

    </div>
  );
};

export default HomeAmbianceSection;
