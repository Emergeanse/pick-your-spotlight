import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Eye, Coffee, Heart, Shuffle, Star, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setFeedback } from "@/lib/feedback";

export type AmbianceMood = "intense" | "mysterious" | "comfort" | "couple" | "surprise";

const AMBIANCES: { id: AmbianceMood; label: string; Icon: typeof Flame }[] = [
  { id: "intense", label: "Intense", Icon: Flame },
  { id: "mysterious", label: "Mystérieux", Icon: Eye },
  { id: "comfort", label: "Réconfortant", Icon: Coffee },
  { id: "couple", label: "À deux", Icon: Heart },
  { id: "surprise", label: "Surprends-moi", Icon: Shuffle },
];

type LastReco = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType: "movie" | "tv";
  itemId: string;
  currentScore: number; // 0-5
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

const HomeAmbianceSection = ({ onPickAmbiance, activeAmbiance }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lastReco, setLastReco] = useState<LastReco | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [friends, setFriends] = useState<FriendWatching[]>([]);
  const [extraFriends, setExtraFriends] = useState<number>(0);

  // Fetch last recommendation (last interacted item)
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

  // Fetch friends + their latest like
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

      // For each friend, get their latest liked/loved movie
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
    <div className="px-5 md:px-8 space-y-6">
      {/* ─── Last Reco Rating Card ─── */}
      {lastReco && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55 }}
          className="relative rounded-[28px] bg-gradient-to-br from-card/80 via-card/55 to-card/30 backdrop-blur-xl border border-white/[0.06] p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
        >
          <div className="flex gap-4 items-center">
            <div className="relative flex-shrink-0 w-[88px] h-[124px] rounded-2xl overflow-hidden border border-white/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]">
              {lastReco.posterPath ? (
                <img
                  src={`${POSTER_BASE}${lastReco.posterPath}`}
                  alt={lastReco.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-sans text-primary/90 tracking-wide font-medium mb-1">
                Note ta dernière reco de Pick
              </p>
              <p className="font-serif text-foreground text-[19px] leading-tight truncate">
                {lastReco.title}
              </p>
              <div className="mt-3 flex items-center gap-1.5" onMouseLeave={() => setHovered(0)}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = (hovered || rating) >= n;
                  return (
                    <motion.button
                      key={n}
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      whileHover={{ scale: 1.12 }}
                      onMouseEnter={() => setHovered(n)}
                      onClick={() => handleRate(n)}
                      className="p-0.5"
                      aria-label={`Note ${n}/5`}
                    >
                      <Star
                        className={`w-6 h-6 transition-all ${
                          filled
                            ? "fill-primary text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                            : "text-primary/40"
                        }`}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  );
                })}
              </div>
              {submitted && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 text-[11px] text-foreground/60 font-sans"
                >
                  Merci, j'affine ton goût ✨
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Ambiance chips ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
      >
        <p className="text-[13px] font-sans text-foreground/70 mb-3 px-1">
          Ou choisis ton ambiance
        </p>
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap pb-1 scrollbar-none">
          {AMBIANCES.map(({ id, label, Icon }, i) => {
            const active = activeAmbiance === id;
            return (
              <motion.button
                key={id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + i * 0.04, duration: 0.35 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => onPickAmbiance(id)}
                className={`flex-shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full font-sans text-[13px] font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/60 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.55)]"
                    : "bg-card/60 text-foreground/75 border border-white/[0.06] hover:bg-card/80 hover:text-foreground"
                }`}
              >
                <Icon className={`w-[15px] h-[15px] ${active ? "text-primary" : "text-foreground/55"}`} strokeWidth={2} />
                {label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Friends watching ─── */}
      {friends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.55 }}
          className="rounded-[28px] bg-gradient-to-br from-card/80 via-card/55 to-card/30 backdrop-blur-xl border border-white/[0.06] p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-foreground text-[18px] leading-tight">
              Vos amis regardent
            </h3>
            <button
              onClick={() => navigate("/app/friends")}
              className="inline-flex items-center gap-0.5 text-[12px] font-sans text-foreground/55 hover:text-primary transition-colors"
            >
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
            {friends.map((f, i) => (
              <motion.button
                key={f.id}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.06, duration: 0.4 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => navigate("/app/friends")}
                className="flex-shrink-0 flex flex-col items-center w-[72px] group"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-primary/60 transition-colors bg-muted">
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-foreground/60 font-sans text-sm font-semibold">
                        {f.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-[0_0_10px_hsl(var(--primary)/0.8)]" />
                </div>
                <p className="mt-2 text-[11.5px] font-sans font-medium text-foreground/85 truncate w-full text-center">
                  {f.name}
                </p>
                {f.title && (
                  <p className="text-[10px] font-sans text-foreground/45 truncate w-full text-center mt-0.5">
                    {f.title}
                  </p>
                )}
              </motion.button>
            ))}
            {extraFriends > 0 && (
              <button
                onClick={() => navigate("/app/friends")}
                className="flex-shrink-0 flex flex-col items-center w-[72px]"
              >
                <div className="w-14 h-14 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-primary font-sans font-semibold text-[14px]">
                  +{extraFriends}
                </div>
                <p className="mt-2 text-[10px] font-sans text-foreground/45 text-center leading-tight">
                  {extraFriends} autres<br/>amis
                </p>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default HomeAmbianceSection;
