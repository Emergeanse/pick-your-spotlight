// Module-level singleton pour passer l'état de révélation entre pages
// sans modifier le reducer central

type RevealState = {
  eventId: string;
  eventTitle: string;
  context?: string;
  genres?: string[];
  mood?: string;
} | null;

let _reveal: RevealState = null;

export const setRevealEvent = (state: RevealState) => { _reveal = state; };
export const getRevealEvent = () => _reveal;
export const clearRevealEvent = () => { _reveal = null; };
