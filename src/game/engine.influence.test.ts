import { describe, expect, it } from 'vitest';
import { applyInfluenceDiplomacyAction } from './engine';
import type { GameState } from './types';

function makeState(): GameState {
  return {
    systems: {
      wonderOwners: {},
      religions: [],
      cityFaithPressure: {},
      tourismTotal: {},
      influence: {},
      influenceDiplomacy: { balances: { 0: 50, 1: 20 }, actionLog: [], treaties: [], sanctions: [], endeavors: [] },
      independentPowers: [],
      nextIndependentPowerId: 1,
      commanders: [],
      nextCommanderId: 1,
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
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A', 'B'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 5,
    currentCivIndex: 0,
    tiles: [[{ q: 0, r: 0 } as any]],
    cities: [],
    units: [],
    civilizations: [
      {
        id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000',
        isHuman: true, isAlive: true, capital: null, cities: [], units: [],
        resources: { food: 0, production: 0, gold: 100, science: 0, culture: 0, faith: 0, happiness: 0 },
        lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0,
        researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0,
        greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0,
        religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0,
        consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom',
        slottedPolicyIds: [], aiPersonality: 'BUILDER',
      },
      {
        id: 1, name: 'B', adjective: 'B', leader: 'L2', color: '#fff', secondaryColor: '#000',
        isHuman: false, isAlive: true, capital: null, cities: [], units: [],
        resources: { food: 0, production: 0, gold: 100, science: 0, culture: 0, faith: 0, happiness: 0 },
        lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0,
        researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0,
        greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0,
        religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0,
        consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom',
        slottedPolicyIds: [], aiPersonality: 'BUILDER',
      },
    ],
    relations: [{ civA: 0, civB: 1, status: 'neutral', turnsAtWar: 0, tradeRoutes: 0, peaceLockedUntilTurn: 0, armisticeUntilTurn: 0, trust: 0, grievances: 0 }],
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

describe('applyInfluenceDiplomacyAction', () => {
  it('applies support action and spends influence', () => {
    const s = makeState();
    const out = applyInfluenceDiplomacyAction(s, 0, 1, 'support');
    expect((out.systems.influenceDiplomacy.balances[0] ?? 0)).toBeLessThan(50);
    const rel = out.relations[0]!;
    expect(rel.trust).toBeGreaterThan(0);
    expect(out.systems.influenceDiplomacy.actionLog.length).toBeGreaterThan(0);
  });
});

