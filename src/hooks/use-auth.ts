import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Restore session from storage first
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
      })
      .catch((error) => {
        console.error("Session restore failed:", error);
      })
      .finally(() => {
        if (!mounted) return;
        setIsReady(true);
        setLoading(false);
      });

    // Listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsReady(true);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Check if test account — if so, clean up before signing out
    if (user) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_test_account")
          .eq("id", user.id)
          .single();

        if (profile?.is_test_account) {
          await supabase.functions.invoke("cleanup-test-user");
        }
      } catch (e) {
        console.error("Cleanup check failed:", e);
      }
    }
    await supabase.auth.signOut();
  };

  return { user, loading, isReady, signOut };
}
