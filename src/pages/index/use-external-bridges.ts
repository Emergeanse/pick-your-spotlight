import { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { MovieDetail } from "@/lib/tmdb";
import type { RecommendationMovieDetail } from "@/lib/recommendation-batch";
import type { IndexDispatch } from "./reducer";

type Options = {
  dispatch: IndexDispatch;
  recommendationBatchSize: number;
  normalizeRecommendationBatch: (
    movies: RecommendationMovieDetail[],
    excludeIds?: number[],
    size?: number,
  ) => Promise<RecommendationMovieDetail[]>;
  openRecommendationBatch: (
    movies: RecommendationMovieDetail[],
    origin?: "home" | "external",
    startIndex?: number,
    seenMovieIds?: Set<number>,
    suggestionCount?: number,
  ) => void;
  abandonCurrentSession: () => void;
  onOpenTrainerOnMount: () => void;
};

/**
 * Centralises window event listeners and router-state side effects:
 *  - `location.state.openTrainer` / `location.state.selectedMovie`
 *  - `pick-chat-movie` window event (from FAB chat → /app)
 *  - `pick-reset-home` legacy soft reset event
 *  - `home-reset` (from BottomTabBar Home tap)
 */
export function useExternalBridges({
  dispatch,
  recommendationBatchSize,
  normalizeRecommendationBatch,
  openRecommendationBatch,
  abandonCurrentSession,
  onOpenTrainerOnMount,
}: Options) {
  const location = useLocation();

  // location.state bridges (deep links from My Cinema, FAB, Onboarding etc.)
  useEffect(() => {
    const state = (location.state as any) || {};
    if (state.openTrainer) {
      onOpenTrainerOnMount();
      window.history.replaceState({}, "", "/app");
    }
    if (state.selectedMovie) {
      const movie = state.selectedMovie as MovieDetail;
      normalizeRecommendationBatch([movie], [movie.id])
        .then((batch) => openRecommendationBatch(batch, "external"))
        .catch(() => openRecommendationBatch([movie], "external"));
      window.history.replaceState({}, "", "/app");
    }
  }, [location.state, normalizeRecommendationBatch, openRecommendationBatch, onOpenTrainerOnMount]);

  // pick-chat-movie: FAB chat passes a movie via sessionStorage
  const loadChatMovie = useCallback(() => {
    const stored = sessionStorage.getItem("pick-fab-movie");
    if (stored) {
      try {
        const movie = JSON.parse(stored) as MovieDetail;
        normalizeRecommendationBatch([movie], [movie.id])
          .then((batch) => openRecommendationBatch(batch, "external"))
          .catch(() => openRecommendationBatch([movie], "external"));
      } catch {
        /* ignore */
      }
      sessionStorage.removeItem("pick-fab-movie");
    }
    window.history.replaceState({}, "", "/app");
  }, [normalizeRecommendationBatch, openRecommendationBatch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "pick-chat") loadChatMovie();
    const handler = () => loadChatMovie();
    window.addEventListener("pick-chat-movie", handler);
    return () => window.removeEventListener("pick-chat-movie", handler);
  }, [loadChatMovie]);

  // Legacy soft reset event
  useEffect(() => {
    const handler = () => {
      dispatch({ type: "GO_HOME_SOFT", suggestionCount: recommendationBatchSize });
    };
    window.addEventListener("pick-reset-home", handler);
    return () => window.removeEventListener("pick-reset-home", handler);
  }, [dispatch, recommendationBatchSize]);

  // home-reset (BottomTabBar Home tap) — full reset including session abandon
  useEffect(() => {
    const handler = () => {
      abandonCurrentSession();
      dispatch({ type: "RESET_HOME", suggestionCount: recommendationBatchSize });
    };
    window.addEventListener("home-reset", handler);
    return () => window.removeEventListener("home-reset", handler);
  }, [dispatch, abandonCurrentSession, recommendationBatchSize]);
}
