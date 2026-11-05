import { describe, expect, it } from 'vitest';
import { initGame } from '../engine';
import type { GameSettings } from '../types';
import { markCivFirstContactSeen, firstContactKey } from './firstContactCore';

const baseSettings = (): GameSettings => ({
  mapWidth: 12,
  mapHeight: 8,
  numCivs: 3,
  difficulty: 'prince',
  seed: 401,
  maxTurns: 80,
  mapType: 'pangaea',
  civNames: ['A', 'B', 'C'],
  humanCivIndex: 0,
  humanNickname: '',
});

describe('firstContactCore', () => {
  it('firstContactKey is directional', () => {
    expect(firstContactKey(0, 1)).toBe('0_1');
    expect(firstContactKey(1, 0)).toBe('1_0');
  });

  it('markCivFirstContactSeen is idempotent', () => {
    let s = initGame(baseSettings());
    s = markCivFirstContactSeen(s, 0, 1);
    expect(s.systems.civFirstContactSeen?.['0_1']).toBe(true);
    const again = markCivFirstContactSeen(s, 0, 1);
    expect(again).toBe(s);
  });

  it('ignores same civ indices', () => {
    let s = initGame(baseSettings());
    const before = s.systems.civFirstContactSeen;
    s = markCivFirstContactSeen(s, 1, 1);
    expect(s.systems.civFirstContactSeen).toEqual(before);
  });
});
