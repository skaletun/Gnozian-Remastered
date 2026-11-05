import { describe, expect, it } from 'vitest';
import { processTurn } from './engine';
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
        pointsByCiv: {
          0: { military: 1, science: 1, culture: 1, economy: 1 },
          1: { military: 8, science: 8, culture: 8, economy: 8 },
        },
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
      mapWidth: 2,
      mapHeight: 2,
      numCivs: 2,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 1,
      mapType: 'continents',
      civNames: ['A', 'B'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 1,
    currentCivIndex: 0,
    tiles: [
      [
        { q: 0, r: 0, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, unit: null, revealed: [true, true], visible: [true, true] },
        { q: 1, r: 0, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, unit: null, revealed: [true, true], visible: [true, true] },
      ],
      [
        { q: 0, r: 1, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, unit: null, revealed: [true, true], visible: [true, true] },
        { q: 1, r: 1, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, unit: null, revealed: [true, true], visible: [true, true] },
      ],
    ] as any,
    cities: [],
    units: [],
    civilizations: [
      {
        id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true, isAlive: true,
        capital: null, cities: [], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
        lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0,
        policies: [], era: 'modern', score: 10, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null,
        lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER',
      },
      {
        id: 1, name: 'B', adjective: 'B', leader: 'L2', color: '#fff', secondaryColor: '#000', isHuman: false, isAlive: true,
        capital: null, cities: [], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
        lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0,
        policies: [], era: 'modern', score: 5, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null,
        lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER',
      },
    ],
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
      currentAge: 'modern',
      phase: 'ongoing',
      turnsInAge: 3,
      threshold: 220,
      pointsByCiv: [0, 0],
      pendingTransitionTurn: null,
      triggerCivIndex: null,
      modernLegacyUnlocked: false,
      history: [],
    },
  } as unknown as GameState;
}

describe('victory model finalization', () => {
  it('uses legacy fallback score for time victory winner', () => {
    const s = makeState();
    const out = processTurn(s, { skipEndAiBlock: true });
    expect(out.victoryType).toBe('time');
    expect(out.winner).toBe(1);
  });

  it('domination override wins even when winner index is 0', () => {
    const s = makeState();
    s.civilizations[1]!.isAlive = false;
    const out = processTurn(s, { skipEndAiBlock: true });
    expect(out.victoryType).toBe('domination');
    expect(out.winner).toBe(0);
  });
});

