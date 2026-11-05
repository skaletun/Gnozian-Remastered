import { describe, expect, it } from 'vitest';
import { computeStateHash } from './stateHash';
import type { GameState } from '../types';

function makeState(): GameState {
  return {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: 2,
      mapHeight: 2,
      numCivs: 1,
      difficulty: 'prince',
      seed: 42,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 3,
    currentCivIndex: 0,
    tiles: [[{ q: 0, r: 0 } as GameState['tiles'][number][number]]],
    cities: [],
    units: [],
    civilizations: [
      ({
        index: 0,
        name: 'A',
        color: '#fff',
        cities: [],
        technologies: [],
        currentResearch: null,
        researchProgress: 0,
        isAI: false,
        exploredTiles: [],
        era: 'ancient',
        score: 0,
        isAlive: true,
        diplomacy: [],
        diplomaticFavor: 0,
        religionIndex: null,
        faithPool: 0,
        tourism: 0,
        lifetimeCulture: 0,
        diplomaticVictoryPoints: 0,
        consecutivePeaceTurns: 0,
        greatPeopleEarned: 0,
        patronagePoints: 0,
        governmentId: 'chiefdom',
        slottedPolicyIds: [],
        aiPersonality: 'balanced',
      } as unknown as GameState['civilizations'][number]),
    ],
    messages: [],
    nextCityId: 1,
    nextUnitId: 1,
    selectedUnit: null,
    selectedCity: null,
    selectedTile: null,
    camera: { x: 0, y: 0, zoom: 1 },
    world: { hour: 6, weather: 'clear' },
  } as unknown as GameState;
}

describe('computeStateHash', () => {
  it('is stable for equal state snapshots', () => {
    const a = makeState();
    const b = structuredClone(a);
    expect(computeStateHash(a)).toBe(computeStateHash(b));
  });

  it('changes when gameplay-relevant fields change', () => {
    const a = makeState();
    const b = structuredClone(a);
    b.turn += 1;
    expect(computeStateHash(a)).not.toBe(computeStateHash(b));
  });
});

