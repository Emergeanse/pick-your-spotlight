import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { RECOMMENDATION_BATCH_SIZE } from "@/lib/recommendation-batch";

export type ProfilePrefs = {
  excludedGenres: string[];
  excludedPlatforms: number[];
  minRating: number;
  preferredPlatforms: number[];
  profileConfidence: number;
  recommendationBatchSize: number;
  matchThreshold: number;
};

export const defaultProfilePrefs: ProfilePrefs = {
  excludedGenres: [],
  excludedPlatforms: [],
  minRating: 0,
  preferredPlatforms: [],
  profileConfidence: 0,
  recommendationBatchSize: RECOMMENDATION_BATCH_SIZE,
  matchThreshold: 80,
};

type Options = {
  user: User | null;
  /** Called when the loaded `recommendationBatchSize` differs from the current default so the engine state can sync. */
  onRecommendationBatchSizeChange?: (size: number) => void;
};

/**
 * Loads the authenticated user's profile preferences and decides whether to show the
 * platform tour / activation flow. Mirrors the original effect from Index.tsx 1:1.
 */
export function useProfilePrefs({ user, onRecommendationBatchSizeChange }: Options) {
  const navigate = useNavigate();
  const location = useLocation();

  const [profilePrefs, setProfilePrefs] = useState<ProfilePrefs>(defaultProfilePrefs);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showActivation, setShowActivation] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select(
        "onboarding_completed, onboarding_skipped, preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, profile_confidence, tour_completed, activation_completed, default_recommendation_count, match_threshold",
      )
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data && !data.onboarding_completed && !(data as any).onboarding_skipped) {
          navigate("/onboarding");
          return;
        }
        if (data) {
          const recommendationBatchSize = Math.min(
            Math.max((data as any).default_recommendation_count || RECOMMENDATION_BATCH_SIZE, 1),
            10,
          );
          setProfilePrefs({
            excludedGenres: (data as any).excluded_genres || [],
            excludedPlatforms: (data as any).excluded_platforms || [],
            minRating: (data as any).min_rating || 0,
            preferredPlatforms: data.preferred_platforms || [],
            profileConfidence: (data as any).profile_confidence || 0,
            recommendationBatchSize,
            matchThreshold: (data as any).match_threshold ?? 80,
          });
          onRecommendationBatchSizeChange?.(recommendationBatchSize);

          const tourDone = (data as any).tour_completed;
          const activationDone = (data as any).activation_completed;
          const forceTour = sessionStorage.getItem("pick_force_tour") === "1";
          const fromOnboarding = Boolean((location.state as any)?.showTour || forceTour);

          if (!tourDone && fromOnboarding) {
            setShowActivation(false);
            setShowTour(true);
            sessionStorage.removeItem("pick_force_tour");
          } else if (!activationDone) {
            supabase
              .from("user_interactions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .then(({ count }) => {
                if (count && count >= 10) {
                  supabase
                    .from("profiles")
                    .update({ activation_completed: true } as any)
                    .eq("id", user.id);
                } else {
                  setShowTour(false);
                  setShowActivation(true);
                }
              });
          }

          setProfileLoaded(true);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, location.state]);

  return { profilePrefs, profileLoaded, showTour, showActivation, setShowTour, setShowActivation };
}
