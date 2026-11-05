import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { findTradeNetworkPath, getTradeRouteBlockReason } from './tradeRoutesCore';

function makeState(blocked = false): GameState {
  const tiles = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 8 }, (_, q) => ({
      q, r,
      terrain: blocked && q === 3 ? 'mountains' : 'plains',
      improvement: 'none',
      resource: null,
      owner: null,
      city: null,
      territoryCityId: null,
      unit: null,
      revealed: [true, true],
      visible: [true, true],
    }))
  ) as any;
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
        homeHemisphereByCiv: { 0: 'west', 1: 'east' },
        distantLandsDiscoveredByCiv: {},
        distantLandsTotalByCiv: {},
        oceanUnlockedByCiv: {},
        riverNavigationUnlockedByCiv: {},
      },
      legacyCrisis: {
        pointsByCiv: {},
        pendingLegacyChoices: [],
        history: [],
        activeYieldModifiersByCiv: {},
        crisisActive: false,
        crisisAge: null,
        crisisTurnsLeft: 0,
        crisisSeverity: 0,
        selectedPolicyByCiv: {},
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
      mapWidth: 8,
      mapHeight: 4,
      numCivs: 2,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A', 'B'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 1,
    currentCivIndex: 0,
    tiles,
    cities: [{ id: 1, owner: 0, q: 1, r: 1 }, { id: 2, owner: 1, q: 6, r: 1 }] as any,
    units: [],
    civilizations: [
      { id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true, isAlive: true, capital: 1, cities: [1], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: ['currency'], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
      { id: 1, name: 'B', adjective: 'B', leader: 'L2', color: '#fff', secondaryColor: '#000', isHuman: false, isAlive: true, capital: 2, cities: [2], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: ['currency'], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
    ],
    relations: [{ civA: 0, civB: 1, status: 'peace', turnsAtWar: 0, tradeRoutes: 0, peaceLockedUntilTurn: 0, armisticeUntilTurn: 0, trust: 0, grievances: 0 }],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 3,
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
    age: { currentAge: 'antiquity', phase: 'ongoing', turnsInAge: 1, threshold: 220, pointsByCiv: [0, 0], pendingTransitionTurn: null, triggerCivIndex: null, modernLegacyUnlocked: false, history: [] },
  } as unknown as GameState;
}

describe('trade network checks', () => {
  it('finds viable network path on open terrain', () => {
    const s = makeState(false);
    const p = findTradeNetworkPath(s, 0, 1);
    expect((p?.length ?? 0) > 2).toBe(true);
    expect(getTradeRouteBlockReason(s, 0, 1)).toBe(null);
  });

  it('blocks route when no network path exists', () => {
    const s = makeState(true);
    const p = findTradeNetworkPath(s, 0, 1);
    expect(p).toBe(null);
    expect(getTradeRouteBlockReason(s, 0, 1)).toContain('No viable trade network path');
  });
});

