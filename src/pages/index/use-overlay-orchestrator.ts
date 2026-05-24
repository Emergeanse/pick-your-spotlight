import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { MissionId } from "@/components/pick/ActivationFlow";
import type { WatchlistGuideStep } from "@/components/pick/WatchlistMissionGuide";
import type { TalkToPickGuideStep } from "@/components/pick/TalkToPickMissionGuide";
import type { IndexDispatch } from "./reducer";

type Options = {
  user: User | null;
  dispatch: IndexDispatch;
  recommendationBatchSize: number;
  setShowActivation: (v: boolean) => void;
  setShowTour: (v: boolean) => void;
};

/**
 * Manages the activation flow, platform tour and mission-specific guides
 * (watchlist, talk-to-pick). Side-effects are limited to dispatching reducer
 * actions and updating local overlay state; no recommendation fetching here.
 */
export function useOverlayOrchestrator({
  user,
  dispatch,
  recommendationBatchSize,
  setShowActivation,
  setShowTour,
}: Options) {
  const [activeActivationMission, setActiveActivationMission] = useState<MissionId | null>(null);
  const [openTrainerOnMount, setOpenTrainerOnMount] = useState(false);
  const [watchlistGuideStep, setWatchlistGuideStep] = useState<WatchlistGuideStep>(null);
  const [watchlistGuideDone, setWatchlistGuideDone] = useState(false);
  const [watchlistSavedCount, setWatchlistSavedCount] = useState(0);
  const [talkToPickGuideStep, setTalkToPickGuideStep] = useState<TalkToPickGuideStep>(null);

  const handleTourComplete = async () => {
    setShowTour(false);
    if (user) {
      await supabase.from("profiles").update({ tour_completed: true } as any).eq("id", user.id);
    }
    setShowActivation(true);
  };

  const handleActivationMission = (missionId: MissionId) => {
    setActiveActivationMission(missionId);
    switch (missionId) {
      case "train_20":
        setOpenTrainerOnMount(true);
        break;
      case "first_reco":
        break;
      case "talk_to_pick":
        dispatch({ type: "RESET_HOME", suggestionCount: recommendationBatchSize });
        setOpenTrainerOnMount(false);
        setTimeout(() => setTalkToPickGuideStep("open-chat"), 400);
        break;
      case "watchlist_3":
        dispatch({ type: "RESET_HOME", suggestionCount: recommendationBatchSize });
        setOpenTrainerOnMount(false);
        setWatchlistGuideStep("sauvegarder");
        break;
      default:
        break;
    }
  };

  const handleActivationComplete = async () => {
    setShowActivation(false);
    setActiveActivationMission(null);
    if (user) {
      await supabase
        .from("profiles")
        .update({ activation_completed: true } as any)
        .eq("id", user.id);
    }
  };

  return {
    activeActivationMission,
    setActiveActivationMission,
    openTrainerOnMount,
    setOpenTrainerOnMount,
    watchlistGuideStep,
    setWatchlistGuideStep,
    watchlistGuideDone,
    setWatchlistGuideDone,
    watchlistSavedCount,
    setWatchlistSavedCount,
    talkToPickGuideStep,
    setTalkToPickGuideStep,
    handleTourComplete,
    handleActivationMission,
    handleActivationComplete,
  };
}
