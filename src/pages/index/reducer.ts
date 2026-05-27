import type { ChatMessage } from "@/components/pick/VoiceChat";
import type { MovieDetail } from "@/lib/tmdb";
import type { RecommendationMovieDetail } from "@/lib/recommendation-batch";
import { RECOMMENDATION_BATCH_SIZE } from "@/lib/recommendation-batch";

export type Step = "home" | "result";

export type IndexState = {
  step: Step;
  results: RecommendationMovieDetail[];
  currentResultIndex: number;
  resultIndexHistory: number[];
  resultSeenMovieIds: Set<number>;
  batchRejectedIds: Set<number>;
  resultOrigin: "home" | "external";
  resultSuggestionCount: number;
  searchTags: string[];
  showChat: boolean;
  chatInitialMessages?: ChatMessage[];
  chatSuggestedMovies: MovieDetail[] | null;
  chatSuggestedStartIndex: number;
  chatSuggestedSeenMovieIds: Set<number>;
};

export const initialIndexState: IndexState = {
  step: "home",
  results: [],
  currentResultIndex: 0,
  resultIndexHistory: [],
  resultSeenMovieIds: new Set(),
  batchRejectedIds: new Set(),
  resultOrigin: "home",
  resultSuggestionCount: RECOMMENDATION_BATCH_SIZE,
  searchTags: [],
  showChat: false,
  chatInitialMessages: undefined,
  chatSuggestedMovies: null,
  chatSuggestedStartIndex: 0,
  chatSuggestedSeenMovieIds: new Set(),
};

export type IndexAction =
  | {
      type: "OPEN_BATCH";
      movies: RecommendationMovieDetail[];
      origin: "home" | "external";
      startIndex: number;
      seenMovieIds?: Set<number>;
      suggestionCount: number;
    }
  | { type: "REPLACE_BATCH"; movies: RecommendationMovieDetail[]; suggestionCount: number }
  | { type: "UPDATE_MOVIE_TEXTS"; movieId: number; texts: RecommendationMovieDetail["recommendationTexts"] }
  | { type: "RESET_HOME"; suggestionCount: number }
  | { type: "GO_HOME_SOFT"; suggestionCount: number }
  | {
      type: "GO_HOME_PRESERVE_CHAT_SUGGESTIONS";
      movies: RecommendationMovieDetail[];
      startIndex: number;
      seenMovieIds: Set<number>;
    }
  | { type: "GO_TO_INDEX"; index: number }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "OPEN_CHAT"; initialMessages?: ChatMessage[] }
  | { type: "CLOSE_CHAT" }
  | { type: "CONSUME_CHAT_SUGGESTIONS" }
  | { type: "ADD_TAG"; tag: string }
  | { type: "REMOVE_TAG"; tag: string }
  | { type: "SET_SEARCH_TAGS"; tags: string[] }
  | { type: "MERGE_SEARCH_TAGS"; tags: string[] }
  | { type: "SET_VISITED"; ids: Set<number> }
  | { type: "SET_BATCH_REJECTED"; ids: Set<number> }
  | { type: "SET_SUGGESTION_COUNT"; count: number }
  | { type: "SET_STEP_HOME" };

export function indexReducer(state: IndexState, action: IndexAction): IndexState {
  switch (action.type) {
    case "OPEN_BATCH": {
      const safeStart = Math.min(action.startIndex, Math.max(action.movies.length - 1, 0));
      const initialMovieId = action.movies[safeStart]?.id;
      return {
        ...state,
        step: "result",
        results: action.movies,
        resultSuggestionCount: action.suggestionCount,
        currentResultIndex: safeStart,
        resultIndexHistory: [],
        resultSeenMovieIds:
          action.seenMovieIds && action.seenMovieIds.size > 0
            ? new Set(action.seenMovieIds)
            : new Set(initialMovieId ? [initialMovieId] : []),
        batchRejectedIds: new Set(),
        resultOrigin: action.origin,
      };
    }
    case "REPLACE_BATCH":
      return {
        ...state,
        results: action.movies,
        resultSuggestionCount: action.suggestionCount,
        currentResultIndex: 0,
        resultIndexHistory: [],
        resultSeenMovieIds: new Set(action.movies[0] ? [action.movies[0].id] : []),
        batchRejectedIds: new Set(),
      };
    case "UPDATE_MOVIE_TEXTS":
      return {
        ...state,
        results: state.results.map((m) =>
          m.id === action.movieId && action.texts
            ? { ...m, recommendationTexts: { ...m.recommendationTexts, ...action.texts } }
            : m,
        ),
      };
    case "RESET_HOME":
      return {
        ...state,
        step: "home",
        results: [],
        resultSuggestionCount: action.suggestionCount,
        currentResultIndex: 0,
        resultIndexHistory: [],
        resultSeenMovieIds: new Set(),
        batchRejectedIds: new Set(),
        searchTags: [],
        showChat: false,
        chatInitialMessages: undefined,
        chatSuggestedMovies: null,
        chatSuggestedSeenMovieIds: new Set(),
      };
    case "GO_HOME_SOFT":
      // Legacy "pick-reset-home" event behaviour — does not abandon session, does not reset chat suggestions storage.
      return {
        ...state,
        step: "home",
        results: [],
        resultSuggestionCount: action.suggestionCount,
        currentResultIndex: 0,
        resultIndexHistory: [],
        searchTags: [],
        showChat: false,
        chatInitialMessages: undefined,
        chatSuggestedMovies: null,
        chatSuggestedSeenMovieIds: new Set(),
      };
    case "GO_HOME_PRESERVE_CHAT_SUGGESTIONS":
      return {
        ...state,
        step: "home",
        chatSuggestedMovies: action.movies,
        chatSuggestedStartIndex: action.startIndex,
        chatSuggestedSeenMovieIds: new Set(action.seenMovieIds),
      };
    case "GO_TO_INDEX":
      return {
        ...state,
        resultIndexHistory: [...state.resultIndexHistory, state.currentResultIndex],
        currentResultIndex: action.index,
      };
    case "NEXT":
      if (state.currentResultIndex >= state.results.length - 1) return state;
      return {
        ...state,
        resultIndexHistory: [...state.resultIndexHistory, state.currentResultIndex],
        currentResultIndex: state.currentResultIndex + 1,
      };
    case "PREV":
      if (state.currentResultIndex <= 0) return state;
      return {
        ...state,
        resultIndexHistory: [...state.resultIndexHistory, state.currentResultIndex],
        currentResultIndex: state.currentResultIndex - 1,
      };
    case "OPEN_CHAT":
      return { ...state, showChat: true, chatInitialMessages: action.initialMessages };
    case "CLOSE_CHAT":
      return { ...state, showChat: false };
    case "CONSUME_CHAT_SUGGESTIONS":
      return {
        ...state,
        chatSuggestedMovies: null,
        chatSuggestedStartIndex: 0,
        chatSuggestedSeenMovieIds: new Set(),
      };
    case "ADD_TAG":
      return state.searchTags.includes(action.tag)
        ? state
        : { ...state, searchTags: [...state.searchTags, action.tag] };
    case "REMOVE_TAG":
      return { ...state, searchTags: state.searchTags.filter((t) => t !== action.tag) };
    case "SET_SEARCH_TAGS":
      return { ...state, searchTags: action.tags };
    case "MERGE_SEARCH_TAGS": {
      const merged = [...state.searchTags];
      action.tags.forEach((t) => {
        if (!merged.includes(t)) merged.push(t);
      });
      return { ...state, searchTags: merged };
    }
    case "SET_VISITED":
      return { ...state, resultSeenMovieIds: action.ids };
    case "SET_BATCH_REJECTED":
      return { ...state, batchRejectedIds: action.ids };
    case "SET_SUGGESTION_COUNT":
      return { ...state, resultSuggestionCount: action.count };
    case "SET_STEP_HOME":
      return { ...state, step: "home" };
    default:
      return state;
  }
}

export type IndexDispatch = (action: IndexAction) => void;

/** Resolve a React-setState-style updater (value OR fn(prev)=>value) against the current set. */
export function resolveSetUpdater<T>(updater: T | ((prev: T) => T), prev: T): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}
