import { describe, expect, it } from 'vitest';
import type { GameState } from './types';
import { tileMovementEnterCost } from './movementRules';

function makeState(age: 'antiquity' | 'exploration'): GameState {
  return {
    systems: {
      wonderOwners: {},
      religions: [],
      cityFaithPressure: {},
      tourismTotal: {},
      influence: {},
      influenceDiplomacy: { balances: {}, actionLog: [], treaties: [], sanctions: [], endeavors: [] },
      independentPowers: [],
      nextIndependentPowerId: 1,
      commanders: [],
      nextCommanderId: 1,
      geographyProgress: {
        homeHemisphereByCiv: { 0: 'west' },
        distantLandsDiscoveredByCiv: {},
        distantLandsTotalByCiv: {},
        oceanUnlockedByCiv: {},
        riverNavigationUnlockedByCiv: {},
      },
      touristVisiting: {},
      touristDomestic: {},
      spies: [],
      disasters: [],
      greatPeopleMeter: {},
      greatPersonProgress: {},
      greatPersonClaimed: [],
      greatWorks: [],
      nextGreatWorkId: 1,
      worldVotes: [],
      spaceRace: {},
      nextSpyId: 1,
      nextDisasterId: 1,
    },
    settings: {
      mapWidth: 2,
      mapHeight: 1,
      numCivs: 1,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 1,
    currentCivIndex: 0,
    tiles: [[
      { q: 0, r: 0, terrain: 'plains', river: true, revealed: [true], visible: [true] },
      { q: 1, r: 0, terrain: 'hills', river: true, revealed: [true], visible: [true] },
    ]] as any,
    cities: [],
    units: [],
    civilizations: [{
      id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true,
      isAlive: true, capital: null, cities: [], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
      lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [],
      era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0,
      diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER',
    }],
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
    age: {
      currentAge: age,
      phase: 'ongoing',
      turnsInAge: 1,
      threshold: 220,
      pointsByCiv: [0],
      pendingTransitionTurn: null,
      triggerCivIndex: null,
      modernLegacyUnlocked: false,
      history: [],
    },
  } as unknown as GameState;
}

describe('movementRules geography', () => {
  it('locks ocean for land units in antiquity', () => {
    const s = makeState('antiquity');
    const cost = tileMovementEnterCost('ocean', 'warrior', { state: s, civIndex: 0, fromQ: 0, fromR: 0, toQ: 1, toR: 0 });
    expect(cost).toBeNull();
  });

  it('locks coast and ocean without Sailing tech', () => {
    const s = makeState('exploration');
    expect(tileMovementEnterCost('coast', 'warrior', { state: s, civIndex: 0 })).toBeNull();
    expect(tileMovementEnterCost('ocean', 'warrior', { state: s, civIndex: 0 })).toBeNull();
  });

  it('allows coastal movement with Sailing; ocean still locked in antiquity without open-ocean unlock', () => {
    const base = makeState('antiquity');
    const s = {
      ...base,
      civilizations: base.civilizations.map((c, i) =>
        i === 0 ? { ...c, researchedTechs: ['sailing'] } : c
      ),
    } as unknown as GameState;
    expect(tileMovementEnterCost('coast', 'warrior', { state: s, civIndex: 0 })).toBe(1);
    expect(tileMovementEnterCost('ocean', 'warrior', { state: s, civIndex: 0 })).toBeNull();
  });

  it('allows ocean with Sailing and exploration-age open ocean unlock', () => {
    const base = makeState('exploration');
    const s = {
      ...base,
      civilizations: base.civilizations.map((c, i) =>
        i === 0 ? { ...c, researchedTechs: ['sailing'] } : c
      ),
    } as unknown as GameState;
    const oceanCost = tileMovementEnterCost('ocean', 'warrior', {
      state: s,
      civIndex: 0,
      fromQ: 0,
      fromR: 0,
      toQ: 1,
      toR: 0,
    });
    const riverCost = tileMovementEnterCost('hills', 'warrior', {
      state: s,
      civIndex: 0,
      fromQ: 0,
      fromR: 0,
      toQ: 1,
      toR: 0,
    });
    expect(oceanCost).toBe(2);
    expect(riverCost).toBe(1);
  });

  it('charges full jungle MP even when both tiles are culturally owned', () => {
    const base = makeState('exploration');
    const s = {
      ...base,
      civilizations: base.civilizations.map((c, i) =>
        i === 0 ? { ...c, researchedTechs: ['sailing'] } : c
      ),
    } as unknown as GameState;
    const a = s.tiles[0][0] as any;
    const b = s.tiles[0][1] as any;
    a.owner = 0;
    b.owner = 0;
    a.terrain = 'jungle';
    b.terrain = 'jungle';
    a.river = false;
    b.river = false;
    const intra = tileMovementEnterCost('jungle', 'warrior', {
      state: s,
      civIndex: 0,
      fromQ: 0,
      fromR: 0,
      toQ: 1,
      toR: 0,
    });
    expect(intra).toBe(2);
  });

  it('does not waive terrain cost crossing from owned into neutral/frontier tiles', () => {
    const base = makeState('exploration');
    const s = {
      ...base,
      civilizations: base.civilizations.map((c, i) =>
        i === 0 ? { ...c, researchedTechs: ['sailing'] } : c
      ),
    } as unknown as GameState;
    const a = s.tiles[0][0] as any;
    const b = s.tiles[0][1] as any;
    a.owner = 0;
    a.terrain = 'plains';
    a.river = false;
    b.owner = null;
    b.terrain = 'jungle';
    b.river = false;
    const out = tileMovementEnterCost('jungle', 'warrior', {
      state: s,
      civIndex: 0,
      fromQ: 0,
      fromR: 0,
      toQ: 1,
      toR: 0,
    });
    expect(out).toBe(2);
  });
});

