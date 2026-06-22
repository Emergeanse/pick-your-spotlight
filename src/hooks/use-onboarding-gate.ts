import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Redirige vers /onboarding si l'initiation n'est pas terminée (sauf pause ou skip).
 * À utiliser dans AppLayout pour couvrir toutes les routes /app/*.
 */
export function useOnboardingGate() {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    supabase
      .from("profiles")
      .select("onboarding_completed, onboarding_skipped, onboarding_paused")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const skipped = Boolean((data as any)?.onboarding_skipped);
        const paused = Boolean((data as any)?.onboarding_paused);
        const completed = Boolean((data as any)?.onboarding_completed);
        if (data && !completed && !skipped && !paused) {
          navigate("/onboarding", { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, isReady, navigate]);

  return { checking };
}
