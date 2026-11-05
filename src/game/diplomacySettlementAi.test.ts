import { describe, expect, it } from 'vitest';
import { decideAiSettlementResponse } from './diplomacySettlementAi';
import type { DiplomaticOffer, GameState } from './types';

function makeState(aiStrong = false): GameState {
  return {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: 3,
      mapHeight: 3,
      numCivs: 2,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A', 'B'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 12,
    currentCivIndex: 0,
    tiles: [] as unknown as GameState['tiles'],
    cities: [
      { id: 1, owner: 0, q: 0, r: 0, defense: 20, hp: 100, maxHp: 100 },
      { id: 2, owner: 1, q: 2, r: 2, defense: 20, hp: 100, maxHp: 100 },
    ] as GameState['cities'],
    units: [
      { id: 1, owner: 0, strength: aiStrong ? 15 : 40, rangedStrength: 0, hp: 100, maxHp: 100 },
      { id: 2, owner: 1, strength: aiStrong ? 55 : 10, rangedStrength: 0, hp: 100, maxHp: 100 },
    ] as GameState['units'],
    civilizations: [
      { id: 0, isHuman: true, isAlive: true, resources: { gold: 100 }, aiPersonality: 'BUILDER' },
      { id: 1, isHuman: false, isAlive: true, resources: { gold: 100 }, aiPersonality: 'AGGRESSIVE' },
    ] as GameState['civilizations'],
    relations: [{ civA: 0, civB: 1, status: 'war', turnsAtWar: 5, tradeRoutes: 0, peaceLockedUntilTurn: 0, armisticeUntilTurn: 0, trust: -30, grievances: 30 }],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 3,
    nextUnitId: 3,
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

function makeOffer(partial: Partial<DiplomaticOffer> = {}): DiplomaticOffer {
  return {
    id: 1,
    kind: 'peace',
    fromCiv: 0,
    toCiv: 1,
    pairLo: 0,
    pairHi: 1,
    goldLoPaysHi: 60,
    goldHiPaysLo: 0,
    ...partial,
  };
}

describe('decideAiSettlementResponse', () => {
  it('accepts generous peace when the AI is losing', () => {
    const decision = decideAiSettlementResponse(makeState(false), makeOffer(), 1);
    expect(decision.action).toBe('accept');
  });

  it('counters low-value armistice offers when the AI is winning', () => {
    const decision = decideAiSettlementResponse(
      makeState(true),
      makeOffer({ kind: 'armistice', goldLoPaysHi: 0, armisticeTurns: 8 }),
      1
    );
    expect(decision.action).toBe('counter');
    if (decision.action === 'counter') {
      expect(decision.goldHiPaysLo).toBeGreaterThan(0);
    }
  });
});
