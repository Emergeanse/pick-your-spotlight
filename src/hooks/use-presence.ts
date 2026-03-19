import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Tracks the current user's online presence via Supabase Realtime.
 * Call once at app root level.
 */
export function usePresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          email: user.email || "",
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}

export interface OnlineUser {
  user_id: string;
  email: string;
  online_at: string;
}

/**
 * Subscribe to presence state and return online users list.
 */
export function useOnlineUsers(enabled: boolean) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel("online-users");

    const syncPresence = () => {
      const state = channel.presenceState<OnlineUser>();
      const users: OnlineUser[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key];
        if (presences && presences.length > 0) {
          users.push(presences[0] as OnlineUser);
        }
      }
      setOnlineUsers(users);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return onlineUsers;
}
