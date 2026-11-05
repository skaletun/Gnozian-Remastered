import { describe, expect, it } from 'vitest';
import { chooseScoutExplorationStep } from './aiScoutPlanner';
import { getNeighbors, hexDistance } from './mapgen';
import type { AIEngineAPI } from './ai';
import type { GameState, Tile, Unit } from './types';

function stateWithFog(radius = 1): GameState {
  const tiles: Tile[][] = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, q) => ({
      q, r, terrain: 'plains', improvement: 'none', resource: null,
      owner: null, city: null, territoryCityId: null, unit: null,
      revealed: [true, hexDistance(q, r, 4, 4) <= radius],
      visible: [true, hexDistance(q, r, 4, 4) <= radius],
    }))
  );
  return { tiles, units: [], cities: [], systems: {},
    civilizations: [{ researchedTechs: [] }, { researchedTechs: [] }],
  } as unknown as GameState;
}
function scout(): Unit {
  return {
    id: 1, owner: 1, q: 4, r: 4, type: 'scout', movement: 3,
    maxMovement: 3, strength: 8, rangedStrength: 0, range: 0,
    hp: 100, maxHp: 100, hasAttacked: false,
    promotions: [], era: 'ancient', name: 'Scout',
  };
}
const api = {
  bestNeighborToward: (_state: GameState, u: Unit, q: number, r: number) =>
    getNeighbors(u.q, u.r, 9, 9)
      .sort((a, b) => hexDistance(a.q, a.r, q, r) - hexDistance(b.q, b.r, q, r))[0] ?? null,
  canFriendlyStackOnTile: () => true,
} as unknown as AIEngineAPI;

describe('scout fog-of-war exploration', () => {
  it('moves into known terrain toward the unseen frontier', () => {
    const state = stateWithFog();
    const step = chooseScoutExplorationStep(state, 1, scout(), api);
    expect(step).not.toBeNull();
    expect(hexDistance(4, 4, step!.q, step!.r)).toBe(1);
    expect(state.tiles[step!.r]![step!.q]!.revealed[1]).toBe(true);
  });

  it('avoids known enemy combat positions', () => {
    const state = stateWithFog(2);
    state.units.push({ ...scout(), owner: 0, id: 7, q: 5, r: 4, strength: 20 });
    const step = chooseScoutExplorationStep(state, 1, scout(), api);
    expect(step).not.toBeNull();
    expect(hexDistance(step!.q, step!.r, 5, 4)).toBeGreaterThan(1);
  });

  it('does not wander when the whole map is explored', () => {
    expect(chooseScoutExplorationStep(stateWithFog(30), 1, scout(), api)).toBeNull();
  });
});
