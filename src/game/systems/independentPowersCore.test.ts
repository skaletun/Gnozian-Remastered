import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { normalizeIndependentPowersState, tickIndependentPowers } from './independentPowersCore';

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
      mapWidth: 10,
      mapHeight: 10,
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
    tiles: Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, q) => ({
        q, r, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, unit: null,
        revealed: [true, true], visible: [true, true],
      }))
    ) as any,
    cities: [{ id: 1, owner: 0, q: 1, r: 1 }, { id: 2, owner: 1, q: 8, r: 8 }] as any,
    units: [],
    civilizations: [
      { id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true, isAlive: true, capital: 1, cities: [1], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
      { id: 1, name: 'B', adjective: 'B', leader: 'L2', color: '#fff', secondaryColor: '#000', isHuman: false, isAlive: true, capital: 2, cities: [2], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
    ],
    relations: [],
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
    age: {
      currentAge: 'antiquity',
      phase: 'ongoing',
      turnsInAge: 12,
      threshold: 220,
      pointsByCiv: [0, 0],
      pendingTransitionTurn: null,
      triggerCivIndex: null,
      modernLegacyUnlocked: false,
      history: [],
    },
  } as unknown as GameState;
}

describe('independentPowersCore', () => {
  it('spawns powers up to target count', () => {
    const s = makeState();
    const out = tickIndependentPowers(s);
    expect(out.systems.independentPowers.length).toBeGreaterThan(0);
    expect(out.systems.nextIndependentPowerId).toBeGreaterThan(1);
  });

  it('normalizes malformed power records', () => {
    const s = makeState();
    s.systems.independentPowers = [{ id: 0, name: '', q: -4, r: 99, tier: '???', relations: {} }] as any;
    const n = normalizeIndependentPowersState(s);
    expect(n.independentPowers[0]?.id).toBeGreaterThan(0);
    expect(n.independentPowers[0]?.tier).toBe('camp');
  });
});

