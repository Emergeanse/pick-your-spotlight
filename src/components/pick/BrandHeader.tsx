import { motion } from "framer-motion";
import { ArrowLeft, Users, Crown, Star, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { usePickPlus } from "@/hooks/use-pick-plus";
import { supabase } from "@/integrations/supabase/client";

interface BrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  extraActions?: ReactNode;
}

const BrandHeader = ({ showBack, onBack, extraActions }: BrandHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = usePickPlus();
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [interactionCount, setInteractionCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase
          .from("user_item_feedback")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const name = (profile as any)?.display_name || user.email?.split("@")[0] || "Toi";
      setDisplayName(name.split(" ")[0]);
      setAvatarUrl((profile as any)?.avatar_url || null);
      setInteractionCount(count || 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const initials = (displayName || "?").slice(0, 1).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="absolute top-0 left-0 right-0 z-30 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:p-6 flex items-center justify-between gap-2"
    >
      {showBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-serif text-xl md:text-2xl tracking-wide">Pick</span>
        </button>
      ) : (
        <button
          onClick={() => navigate("/app/profile")}
          className="flex items-center gap-2.5 min-w-0 group active:scale-[0.98] transition-transform"
        >
          <span className="font-serif text-2xl md:text-3xl tracking-wide text-foreground leading-none">
            Pick
          </span>

          <span className="h-6 w-px bg-foreground/15" aria-hidden />

          <div className="relative shrink-0">
            <Avatar className="h-8 w-8 ring-1 ring-white/15">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary/20 text-foreground text-[11px] font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex items-center gap-1.5">
            {isPremium && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-[2px] rounded-md bg-primary text-primary-foreground text-[9px] font-bold leading-none">
                <Crown className="h-2 w-2" strokeWidth={3} />
                Pick+
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-foreground/55">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              <span className="tabular-nums">{interactionCount}</span>
              <span>films</span>
            </span>
          </div>
        </button>
      )}

      <div className="flex items-center gap-1">
        {extraActions}
        <button
          onClick={() => navigate("/app/match")}
          className="relative p-2 rounded-full hover:bg-foreground/5 transition-colors active:scale-95"
          aria-label="Rechercher un film"
        >
          <Search className="w-[18px] h-[18px] text-foreground/40" />
        </button>
        <button
          onClick={() => navigate("/app/duo")}
          className="relative p-2 rounded-full hover:bg-foreground/5 transition-colors active:scale-95"
          aria-label="Mes amis & Duo"
        >
          <Users className="w-[18px] h-[18px] text-foreground/40" />
        </button>
        <NotificationBell />
      </div>
    </motion.div>
  );
};

export default BrandHeader;
