import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  read: boolean;
  created_at: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setNotifications(data as Notification[]);
    };
    load();

    // Realtime subscription
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    await supabase.from("notifications").update({ read: true } as any).in("id", unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.type === "friend_request" || notif.type === "friend_accepted") {
      navigate("/app/friends");
    } else if (notif.type === "duo_accepted") {
      navigate("/app/duo");
    } else if (notif.type === "session_invite") {
      navigate("/app/pick-together-group");
    } else if (notif.type === "event_invite" || notif.type === "event_confirmed") {
      const eventId = notif.data?.event_id;
      if (eventId) navigate(`/app/soirees/${eventId}`);
      else navigate("/app/soirees");
    }
    setOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request":  return "👋";
      case "friend_accepted": return "🤝";
      case "duo_accepted":    return "💑";
      case "session_invite":  return "🎬";
      case "event_invite":    return "🎉";
      case "event_confirmed": return "✅";
      default: return "🔔";
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative p-2 rounded-full hover:bg-foreground/5 transition-colors"
      >
        <Bell className="w-5 h-5 text-foreground/60" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-sans font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-2xl bg-card border border-border/20 shadow-xl"
            >
              <div className="p-3 border-b border-border/10">
                <h3 className="font-sans font-semibold text-sm text-foreground">Notifications</h3>
              </div>

              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground text-sm font-sans">Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-border/5">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-3 hover:bg-foreground/[0.03] transition-colors ${!notif.read ? "bg-primary/[0.03]" : ""}`}
                    >
                      <div className="flex gap-2.5">
                        <span className="text-base mt-0.5">{getIcon(notif.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-sans leading-snug ${!notif.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-[11px] text-muted-foreground font-sans mt-0.5 line-clamp-2">{notif.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/50 font-sans mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
