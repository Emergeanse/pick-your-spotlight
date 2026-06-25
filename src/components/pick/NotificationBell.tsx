import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  countUnreadNotifications,
  isPersistedNotificationId,
  mergeFriendRequestNotifications,
  type NotificationItem,
  type PendingFriendRequest,
} from "@/lib/friend-notifications";
import { getNotificationIcon, getNotificationRoute } from "@/lib/notification-navigation";

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = countUnreadNotifications(notifications);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const [{ data: rows }, { data: pendingFriendships }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("friendships" as any)
        .select("id, requester_id, created_at")
        .eq("addressee_id", user.id)
        .eq("status", "pending"),
    ]);

    const pendingReceived: PendingFriendRequest[] = [];
    if (pendingFriendships?.length) {
      const requesterIds = (pendingFriendships as any[]).map((f) => f.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", requesterIds);
      const nameById = new Map((profiles || []).map((p) => [p.id, p.display_name]));

      for (const f of pendingFriendships as any[]) {
        pendingReceived.push({
          friendshipId: f.id,
          requesterName: nameById.get(f.requester_id) || "Quelqu'un",
          createdAt: f.created_at,
        });
      }
    }

    setNotifications(
      mergeFriendRequestNotifications((rows || []) as NotificationItem[], pendingReceived),
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { loadNotifications(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${user.id}` },
        () => { loadNotifications(); },
      )
      .subscribe((status, err) => { if (err) console.warn("[NotificationBell] realtime:", err); });

    return () => { supabase.removeChannel(channel); };
  }, [user, loadNotifications]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const unreadIds = notifications
      .filter((n) => !n.read && isPersistedNotificationId(n.id))
      .map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ read: true } as any).in("id", unreadIds);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    navigate(getNotificationRoute(notif.type, notif.data));
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative p-2 rounded-full hover:bg-foreground/5 transition-colors"
        aria-label="Notifications"
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
                        <span className="text-base mt-0.5">{getNotificationIcon(notif.type)}</span>
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
