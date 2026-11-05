import { describe, expect, it } from 'vitest';
import { chooseWorkerObjective } from './aiWorkerPlanner';
import { listLegalWorkerImprovementsAt } from './workerImprovementRules';
import type { AIEngineAPI } from './ai';
import type { GameState, Tile, Unit } from './types';
import type { AIStrategicPosture } from './aiStrategy';

function tile(q: number, r: number, partial: Partial<Tile> = {}): Tile {
  return {
    q,
    r,
    terrain: 'plains',
    improvement: 'none',
    resource: null,
    owner: 1,
    city: null,
    territoryCityId: null,
    unit: null,
    revealed: [true, true],
    visible: [true, true],
    ...partial,
  };
}

const posture: AIStrategicPosture = {
  skill: 0.7,
  phase: 'opening',
  atWar: false,
  militaryRatio: 1,
  victoryFocus: 'economy',
  expansionPressure: 0.8,
  threatLevel: 0,
  developmentPressure: 0.7,
  targetCiv: null,
  defensiveCityId: null,
  empire: {
    cities: 1,
    units: 1,
    combatUnits: 0,
    researchedTechs: 2,
    researchedCivics: 1,
    totalPopulation: 3,
    totalYield: 8,
    militaryPower: 0,
  },
  rivals: [],
};

function makeState(): GameState {
  const tiles = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, q) => tile(q, r)));
  tiles[1]![2] = tile(2, 1, { terrain: 'hills', resource: 'iron' });
  tiles[2]![2] = tile(2, 2, { terrain: 'forest' });
  return {
    tiles,
    cities: [],
    units: [],
    civilizations: [{ researchedTechs: [] }, { researchedTechs: [] }],
  } as unknown as GameState;
}

function makeApi(): AIEngineAPI {
  return {
    calcTileYield: t => ({
      food: t.terrain === 'plains' ? 2 : 0,
      production: t.terrain === 'hills' || t.terrain === 'forest' ? 3 : 1,
      gold: 0,
      science: 0,
      culture: 0,
      faith: 0,
      happiness: 0,
    }),
  } as AIEngineAPI;
}

describe('chooseWorkerObjective', () => {
  it('builds the best valid improvement on the current tile', () => {
    const worker = { id: 1, owner: 1, q: 1, r: 1, type: 'worker' } as Unit;
    const objective = chooseWorkerObjective(makeState(), 1, worker, ['farm', 'mine'], makeApi(), posture, () => 0);
    expect(objective.action).toBe('build');
    if (objective.action === 'build') expect(objective.improvement).toBe('mine');
  });

  it('moves toward valuable owned resource tiles when nothing useful is buildable here', () => {
    const worker = { id: 1, owner: 1, q: 0, r: 0, type: 'worker' } as Unit;
    const objective = chooseWorkerObjective(makeState(), 1, worker, [], makeApi(), posture, () => 0);
    expect(objective.action).toBe('move');
    if (objective.action === 'move') expect([objective.q, objective.r]).toEqual([2, 1]);
  });
});


describe('worker improvements obey the same game rules for AI and player', () => {
  it('does not target an unreachable or technology-locked forest', () => {
    const s = makeState();
    s.tiles[1]![2]!.resource = null;
    s.tiles[1]![2]!.terrain = 'forest';
    for (const row of s.tiles) {
      for (const tile of row) {
        if (!(tile.q === 2 && tile.r === 1)) tile.improvement = 'farm';
      }
    }
    expect(listLegalWorkerImprovementsAt(s, 1, 2, 1)).toEqual([]);
    const worker = { id: 1, owner: 1, q: 0, r: 0, type: 'worker' } as Unit;
    expect(chooseWorkerObjective(s, 1, worker, [], makeApi(), posture, () => 0)).toEqual({ action: 'wait' });
  });

  it('permits a strategic resource improvement without its ordinary tech unlock', () => {
    const s = makeState();
    expect(listLegalWorkerImprovementsAt(s, 1, 2, 1)).toContain('mine');
  });

  it('keeps workers away from known nearby enemy combat units', () => {
    const s = makeState();
    for (const row of s.tiles) {
      for (const tile of row) {
        if (!(tile.q === 2 && tile.r === 1)) tile.improvement = 'farm';
      }
    }
    s.units.push({ id: 9, owner: 0, q: 2, r: 2, strength: 20, rangedStrength: 0 } as Unit);
    const worker = { id: 1, owner: 1, q: 0, r: 0, type: 'worker' } as Unit;
    expect(chooseWorkerObjective(s, 1, worker, [], makeApi(), posture, () => 0)).toEqual({ action: 'wait' });
  });
});
