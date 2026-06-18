import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const ADMIN_EMAILS = ["cbilleux@gmail.com"];

export function useAdmin() {
  const { user, isReady } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Fallback email-based check (always admin for known addresses)
    if (ADMIN_EMAILS.includes(user.email ?? "")) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
        setLoading(false);
      });
  }, [user, isReady]);

  return { isAdmin, loading };
}
