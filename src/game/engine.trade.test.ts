import { describe, expect, it } from 'vitest';
import { addTradeRoute } from './engine';
import type { GameState } from './types';

function makeState(): GameState {
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
      mapWidth: 7,
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
    turn: 1,
    currentCivIndex: 0,
    tiles: Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 7 }, (_, q) => ({
        q, r, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, unit: null, revealed: [true, true], visible: [true, true], road: false,
      }))
    ) as any,
    cities: [{ id: 1, owner: 0, q: 1, r: 1 }, { id: 2, owner: 1, q: 5, r: 1 }] as any,
    units: [
      { id: 100, owner: 0, type: 'great_merchant', q: 1, r: 1, movement: 4, maxMovement: 4, hp: 100, maxHp: 100, strength: 0, rangedStrength: 0, range: 0, hasAttacked: false, promotions: [], era: 'industrial', name: 'Merchant' },
    ] as any,
    civilizations: [
      { id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true, isAlive: true, capital: 1, cities: [1], units: [100], resources: { food: 0, production: 0, gold: 20, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: ['currency'], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'industrial', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
      { id: 1, name: 'B', adjective: 'B', leader: 'L2', color: '#fff', secondaryColor: '#000', isHuman: false, isAlive: true, capital: 2, cities: [2], units: [], resources: { food: 0, production: 0, gold: 20, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: ['currency'], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'industrial', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
    ],
    relations: [{ civA: 0, civB: 1, status: 'peace', turnsAtWar: 0, tradeRoutes: 0, peaceLockedUntilTurn: 0, armisticeUntilTurn: 0, trust: 0, grievances: 0 }],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 3,
    nextUnitId: 101,
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
    age: { currentAge: 'exploration', phase: 'ongoing', turnsInAge: 1, threshold: 220, pointsByCiv: [0, 0], pendingTransitionTurn: null, triggerCivIndex: null, modernLegacyUnlocked: false, history: [] },
  } as unknown as GameState;
}

describe('merchant-created trade routes', () => {
  it('requires great merchant and lays roads on path', () => {
    const s = makeState();
    const next = addTradeRoute(s, 0, 1, { merchantUnitId: 100 });
    expect((next.tradeRoutes?.length ?? 0)).toBe(1);
    expect(next.units.find(u => u.id === 100)?.movement).toBe(0);
    const roads = next.tiles.flat().filter(t => t.road).length;
    expect(roads).toBeGreaterThan(0);
  });
});

