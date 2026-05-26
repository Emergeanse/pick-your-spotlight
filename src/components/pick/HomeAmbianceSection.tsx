import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setFeedback } from "@/lib/feedback";

export type AmbianceMood = "intense" | "mysterious" | "comfort" | "couple" | "surprise";

type LastReco = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType: "movie" | "tv";
  itemId: string;
  currentScore: number;
};

type FriendWatching = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  title?: string;
  online?: boolean;
};

interface Props {
  onPickAmbiance: (mood: AmbianceMood) => void;
  activeAmbiance?: AmbianceMood | null;
}

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// Unified premium surface — same family across all home cards
const PREMIUM_SURFACE =
  "rounded-[26px] border border-white/[0.05] bg-[linear-gradient(180deg,hsl(240_14%_9%/0.85),hsl(240_18%_5%/0.7))] backdrop-blur-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)]";

const SECTION_EYEBROW =
  "text-[10.5px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40";

const HomeAmbianceSection = ({ onPickAmbiance, activeAmbiance }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lastReco, setLastReco] = useState<LastReco | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [friends, setFriends] = useState<FriendWatching[]>([]);
  const [extraFriends, setExtraFriends] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_item_feedback")
        .select("item_id, score, catalog_items:item_id(id, tmdb_id, title, poster_path, media_type)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled || !data?.length) return;
      const row = data[0] as any;
      const ci = row.catalog_items;
      if (!ci?.tmdb_id) return;
      setLastReco({
        tmdbId: ci.tmdb_id,
        title: ci.title,
        posterPath: ci.poster_path,
        mediaType: (ci.media_type as "movie" | "tv") || "movie",
        itemId: ci.id,
        currentScore: row.score || 0,
      });
      if (row.score) setRating(Math.round(row.score));
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: fs } = await supabase
        .from("friendships" as any)
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const accepted = (fs as any[] | null)?.filter((f) => f.status === "accepted") ?? [];
      if (!accepted.length) { if (!cancelled) setFriends([]); return; }
      const ids = accepted.map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);

      const enriched: FriendWatching[] = await Promise.all(
        (profs ?? []).slice(0, 4).map(async (p: any) => {
          const { data: fb } = await supabase
            .from("user_item_feedback")
            .select("catalog_items:item_id(title)")
            .eq("user_id", p.id)
            .in("feedback_type", ["like", "love", "watchlist"])
            .order("created_at", { ascending: false })
            .limit(1);
          const title = (fb as any)?.[0]?.catalog_items?.title;
          return {
            id: p.id,
            name: (p.display_name || "Ami").split(" ")[0],
            avatarUrl: p.avatar_url,
            title,
          };
        })
      );
      if (cancelled) return;
      setFriends(enriched);
      setExtraFriends(Math.max(0, ids.length - 4));
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
    <div className="px-4 md:px-8 space-y-2">
      {/* ─── Last Reco Rating Card ─── */}
      {lastReco && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`relative ${PREMIUM_SURFACE} p-2.5`}
        >
          <div className="flex gap-3 items-stretch">
            <div className="relative flex-shrink-0 w-[56px] h-[84px] rounded-lg overflow-hidden border border-white/[0.06] shadow-[0_14px_36px_-14px_rgba(0,0,0,0.8)]">
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
                <p className="mt-0.5 font-serif text-foreground text-[15px] leading-[1.15] tracking-tight line-clamp-1">
                  {lastReco.title}
                </p>
                <p className="mt-0.5 text-[10.5px] font-sans text-foreground/50 leading-snug">
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
                            : "text-foreground/25"
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

      {/* ─── Friends watching ─── */}
      {friends.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className={`relative ${PREMIUM_SURFACE} px-3 pt-3 pb-1.5`}
        >
          <div className="flex items-end justify-between mb-2.5">
            <div>
              <p className={SECTION_EYEBROW}>Cercle Pick</p>
              <h3 className="mt-0.5 font-serif text-foreground text-[15px] leading-tight">
                Vos amis regardent
              </h3>
            </div>
            <button
              onClick={() => navigate("/app/friends")}
              className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-foreground/55 hover:text-foreground transition-colors group"
            >
              Voir tout
              <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto -mx-3 px-3 pb-0 scrollbar-none">
            {friends.map((f, i) => (
              <motion.button
                key={f.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + i * 0.06, duration: 0.45 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/app/friends")}
                className="flex-shrink-0 flex flex-col items-center w-[54px] group"
              >
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-primary/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 blur transition-opacity" />
                  <div className="relative w-[40px] h-[40px] rounded-full overflow-hidden border border-white/10 bg-muted">
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-foreground/60 font-serif text-sm">
                        {f.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border-2 border-background" />
                </div>
                <p className="mt-1 text-[10.5px] font-sans font-medium text-foreground/85 truncate w-full text-center leading-tight">
                  {f.name}
                </p>
                {f.title && (
                  <p className="mt-0 text-[9px] font-sans text-foreground/40 truncate w-full text-center leading-tight">
                    {f.title}
                  </p>
                )}
              </motion.button>

            ))}
            {extraFriends > 0 && (
              <button
                onClick={() => navigate("/app/friends")}
                className="flex-shrink-0 flex flex-col items-center w-[54px] group"
              >
                <div className="w-[40px] h-[40px] rounded-full border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-foreground/70 font-sans font-semibold text-[11px] group-hover:border-primary/40 group-hover:text-primary transition-colors">
                  +{extraFriends}
                </div>
                <p className="mt-1 text-[9px] font-sans text-foreground/40 text-center leading-tight">
                  autres amis
                </p>
              </button>
            )}

          </div>
        </motion.section>
      )}
    </div>
  );
};

export default HomeAmbianceSection;
