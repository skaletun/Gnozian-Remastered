import { describe, expect, it } from 'vitest';
import { resolveTurnEndOrchestrated } from './turnEndOrchestrator';
import type { City, GameState } from '../types';

function makeState(): GameState {
  return {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: 3,
      mapHeight: 3,
      numCivs: 3,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A', 'B', 'C'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 1,
    currentCivIndex: 0,
    tiles: [] as unknown as GameState['tiles'],
    cities: [],
    units: [],
    civilizations: [
      { id: 0, isHuman: true, isAlive: true },
      { id: 1, isHuman: false, isAlive: true },
      { id: 2, isHuman: false, isAlive: true },
    ] as GameState['civilizations'],
    relations: [],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 1,
    nextUnitId: 1,
    phase: 'playing',
    winner: null,
    victoryType: null,
    messages: [],
    stackUnitsToMove: 9999,
    selectedUnitId: null,
    selectedCityId: null,
    selectedTile: null,
    camera: { x: 0, y: 0, zoom: 1 },
    world: { hour: 6, weather: 'clear' },
  } as GameState;
}

function makeDeps(events: string[]) {
  return {
    processTurn: (state: GameState, opts?: { skipEndAiBlock?: boolean }) => {
      events.push(`process:${String(opts?.skipEndAiBlock)}`);
      return { ...state, turn: state.turn + 1 };
    },
    createAIEngineAPI: () => ({}),
    runAITurn: (state: GameState) => state,
    updateVision: (_tiles: GameState['tiles'], civIndex: number) => {
      events.push(`vision:${civIndex}`);
    },
    assignWorkedTiles: (_city: City) => undefined,
    calcCityYields: () => ({ food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }),
    recomputeTileTerritory: () => undefined,
  };
}

describe('resolveTurnEndOrchestrated', () => {
  it('delegates to processTurn', () => {
    const events: string[] = [];
    const out = resolveTurnEndOrchestrated(makeState(), { visionCivIndex: 0 }, makeDeps(events));
    expect(events).toEqual(['process:undefined']);
    expect(out.turn).toBe(2);
  });
});
