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
};

let _intent: RevealIntent | null = null;

export const setRevealIntent = (intent: RevealIntent) => { _intent = intent; };
export const getRevealIntent = () => _intent;
export const clearRevealIntent = () => { _intent = null; };

// File d'attente de révélation — survit aux remontages multiples du HomeScreen.
// queueForReveal   : appelé dans EventDetailPage avant navigate()
// peekForReveal    : lu dans la callback du profil (sans consommer)
// consumeForReveal : verrou atomique — un seul montage déclenche le pipeline
let _pendingForReveal: RevealIntent | null = null;
export const queueForReveal   = (intent: RevealIntent) => { _pendingForReveal = intent; };
export const peekForReveal    = (): RevealIntent | null => _pendingForReveal;
export const consumeForReveal = (): RevealIntent | null => {
  const v = _pendingForReveal;
  _pendingForReveal = null;
  return v;
};
