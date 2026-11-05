import { describe, expect, it } from 'vitest';
import { initGame, processTurn } from './engine';
import type { GameSettings } from './types';

describe('processTurn AI integration', () => {
  it('runs the end-of-turn AI sweep without dropping hidden state', () => {
    const settings: GameSettings = {
      mapWidth: 12,
      mapHeight: 8,
      numCivs: 2,
      difficulty: 'prince',
      seed: 77,
      maxTurns: 80,
      mapType: 'pangaea',
      civNames: ['A', 'B'],
      humanCivIndex: 0,
      humanNickname: '',
    };
    const state = initGame(settings);
    const initialUnitCount = state.units.length;
    const out = processTurn(state);
    const ai = out.civilizations.find(civ => !civ.isHuman);
    expect(out.units.length).toBeGreaterThanOrEqual(initialUnitCount);
    expect(ai?.currentResearch ?? ai?.researchedTechs[0]).toBeTruthy();
  });
});
