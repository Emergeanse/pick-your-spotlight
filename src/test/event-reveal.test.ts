/**
 * TNR — Module event-reveal.ts (file d'attente sessionStorage)
 *
 * Régression cible : l'intent de révélation était stocké dans une variable
 * module-level (`let _intent`) réinitialisée par le double-mount React Router
 * et le HMR Vite. Corrigé en 2026-06-21 via sessionStorage.
 *
 * Ces tests vérifient les garanties fondamentales du nouveau mécanisme.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  queueForReveal,
  peekForReveal,
  consumeForReveal,
} from '@/lib/event-reveal';
import type { RevealIntent } from '@/lib/event-reveal';

const SOLO_INTENT: RevealIntent = {
  context: 'solo',
  genres: ['Comédie', 'Drame'],
  mood: 'détendu',
  participantIds: ['user-abc123'],
};

const DUO_INTENT: RevealIntent = {
  context: 'duo',
  genres: ['Action'],
  mood: '',
  participantIds: ['user-1', 'user-2'],
};

describe('event-reveal — file d\'attente sessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  // ── Comportement de base ─────────────────────────────────────────────────

  it('queueForReveal stocke l\'intent dans sessionStorage', () => {
    queueForReveal(SOLO_INTENT);
    expect(sessionStorage.getItem('pick_reveal_intent_v1')).not.toBeNull();
  });

  it('peekForReveal retourne l\'intent sans le supprimer', () => {
    queueForReveal(SOLO_INTENT);
    const first = peekForReveal();
    const second = peekForReveal();
    expect(first).toEqual(SOLO_INTENT);
    expect(second).toEqual(SOLO_INTENT); // Toujours en place
  });

  it('consumeForReveal retourne l\'intent ET le supprime', () => {
    queueForReveal(SOLO_INTENT);
    const result = consumeForReveal();
    expect(result).toEqual(SOLO_INTENT);
    expect(sessionStorage.getItem('pick_reveal_intent_v1')).toBeNull();
  });

  // ── Atomicité (protection double-mount) ──────────────────────────────────

  it('RÉGRESSION — consumeForReveal est atomique : 2e appel retourne null', () => {
    // Simule le double-mount React Router : Mount 1 consomme, Mount 2 ne doit rien trouver.
    queueForReveal(SOLO_INTENT);
    const mount1 = consumeForReveal();
    const mount2 = consumeForReveal(); // HMR / double-mount
    expect(mount1).toEqual(SOLO_INTENT);
    expect(mount2).toBeNull();
  });

  it('RÉGRESSION — peekForReveal résiste aux double-mounts (N lectures = toujours présent)', () => {
    // peekForReveal est utilisé dans le useState initializer — appelé plusieurs fois.
    queueForReveal(SOLO_INTENT);
    peekForReveal(); // render 1
    peekForReveal(); // render 2 (double-mount)
    peekForReveal(); // render 3
    expect(peekForReveal()).toEqual(SOLO_INTENT); // Toujours là
  });

  // ── Cas limites ──────────────────────────────────────────────────────────

  it('consumeForReveal sur queue vide retourne null', () => {
    expect(consumeForReveal()).toBeNull();
  });

  it('peekForReveal sur queue vide retourne null', () => {
    expect(peekForReveal()).toBeNull();
  });

  it('queueForReveal écrase un intent précédent (pas d\'accumulation)', () => {
    queueForReveal(SOLO_INTENT);
    queueForReveal(DUO_INTENT);
    const result = consumeForReveal();
    expect(result?.context).toBe('duo');
    expect(consumeForReveal()).toBeNull(); // Un seul item en queue
  });

  // ── Préservation des données ──────────────────────────────────────────────

  it('tous les champs de l\'intent sont préservés après sérialisation JSON', () => {
    const intent: RevealIntent = { ...SOLO_INTENT, mediaType: 'movie' };
    queueForReveal(intent);
    const result = consumeForReveal();
    expect(result?.context).toBe('solo');
    expect(result?.genres).toEqual(['Comédie', 'Drame']);
    expect(result?.mood).toBe('détendu');
    expect(result?.participantIds).toEqual(['user-abc123']);
    expect(result?.mediaType).toBe('movie');
  });

  it('intent duo : participantIds préserve les deux utilisateurs', () => {
    queueForReveal(DUO_INTENT);
    const result = consumeForReveal();
    expect(result?.context).toBe('duo');
    expect(result?.participantIds).toHaveLength(2);
    expect(result?.participantIds).toContain('user-1');
    expect(result?.participantIds).toContain('user-2');
  });

  it('genres vide est sérialisé proprement', () => {
    const intent: RevealIntent = {
      context: 'solo',
      genres: [],
      mood: '',
      participantIds: ['user-x'],
    };
    queueForReveal(intent);
    const result = consumeForReveal();
    expect(result?.genres).toEqual([]);
  });
});
