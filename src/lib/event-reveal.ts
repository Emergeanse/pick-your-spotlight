// Module-level singletons pour passer l'état de révélation entre pages
// sans modifier le reducer central

type RevealState = {
  eventId: string;
  eventTitle: string;
} | null;

let _reveal: RevealState = null;

export const setRevealEvent = (state: RevealState) => { _reveal = state; };
export const getRevealEvent = () => _reveal;
export const clearRevealEvent = () => { _reveal = null; };

// Intent complet pour lancer le pipeline (séparé de RevealState pour éviter les conflits)
export type RevealIntent = {
  context: string;
  genres: string[];
  mood: string;
  participantIds: string[];
  /** Type de contenu choisi à la création de la soirée */
  mediaType?: "movie" | "tv" | "both";
};

let _intent: RevealIntent | null = null;

export const setRevealIntent = (intent: RevealIntent) => { _intent = intent; };
export const getRevealIntent = () => _intent;
export const clearRevealIntent = () => { _intent = null; };

// Refs module-level pour les fonctions du pipeline.
// Chaque render de HomeScreen les met à jour → le code async de Mount 1
// appellera les fonctions de Mount 2 (composant affiché) au lieu de celles de Mount 1 (démonté).
type GenTonightFn = (excludeList?: number[], ctx?: unknown, filters?: unknown, overrides?: unknown, mood?: string) => void;
type HandleAutoPickFn = (duoId?: string, opts?: { genres?: string[]; moodContext?: string; mediaType?: "movie" | "tv" }) => Promise<void>;
export const _pipelineFns: {
  generateTonightPick?: GenTonightFn;
  handleAutoPick?: HandleAutoPickFn;
} = {};

// File d'attente de révélation — stockée dans sessionStorage.
// sessionStorage survit aux rechargements de modules HMR (contrairement aux variables module-level)
// et aux double-mounts React, tout en restant synchrone/atomique (JS mono-thread).
const SESSION_KEY = 'pick_reveal_intent_v1';

export const queueForReveal = (intent: RevealIntent): void => {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(intent)); } catch {}
};

export const peekForReveal = (): RevealIntent | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as RevealIntent) : null;
  } catch { return null; }
};

export const consumeForReveal = (): RevealIntent | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SESSION_KEY);
    return JSON.parse(raw) as RevealIntent;
  } catch { return null; }
};
