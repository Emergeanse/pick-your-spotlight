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
