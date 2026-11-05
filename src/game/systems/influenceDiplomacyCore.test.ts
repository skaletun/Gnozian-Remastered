import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  canSpendInfluence,
  getInfluenceBalance,
  normalizeInfluenceDiplomacy,
  tickInfluenceEconomy,
} from './influenceDiplomacyCore';

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
    turn: 8,
    currentCivIndex: 0,
    tiles: [[{ q: 0, r: 0 } as any]],
    cities: [],
    units: [],
    civilizations: [
      {
        id: 0,
        name: 'A',
        adjective: 'A',
        leader: 'L',
        color: '#fff',
        secondaryColor: '#000',
        isHuman: true,
        isAlive: true,
        capital: null,
        cities: [],
        units: [],
        resources: { food: 0, production: 0, gold: 0, science: 0, culture: 10, faith: 0, happiness: 0 },
        lastTurnIncome: {},
        researchedTechs: [],
        currentResearch: null,
        researchProgress: 0,
        researchedCivics: [],
        currentCivic: null,
        civicProgress: 0,
        policies: [],
        era: 'ancient',
        score: 0,
        greatPeoplePoints: {},
        scienceVictoryProgress: 0,
        culturalInfluence: {},
        faithPool: 0,
        tourism: 0,
        religionIndex: null,
        lifetimeCulture: 0,
        diplomaticVictoryPoints: 0,
        diplomaticFavor: 20,
        consecutivePeaceTurns: 0,
        greatPeopleEarned: 0,
        patronagePoints: 0,
        governmentId: 'chiefdom',
        slottedPolicyIds: [],
        aiPersonality: 'BUILDER',
      },
      {
        id: 1,
        name: 'B',
        adjective: 'B',
        leader: 'L2',
        color: '#fff',
        secondaryColor: '#000',
        isHuman: false,
        isAlive: true,
        capital: null,
        cities: [],
        units: [],
        resources: { food: 0, production: 0, gold: 0, science: 0, culture: 5, faith: 0, happiness: 0 },
        lastTurnIncome: {},
        researchedTechs: [],
        currentResearch: null,
        researchProgress: 0,
        researchedCivics: [],
        currentCivic: null,
        civicProgress: 0,
        policies: [],
        era: 'ancient',
        score: 0,
        greatPeoplePoints: {},
        scienceVictoryProgress: 0,
        culturalInfluence: {},
        faithPool: 0,
        tourism: 0,
        religionIndex: null,
        lifetimeCulture: 0,
        diplomaticVictoryPoints: 0,
        diplomaticFavor: 8,
        consecutivePeaceTurns: 0,
        greatPeopleEarned: 0,
        patronagePoints: 0,
        governmentId: 'chiefdom',
        slottedPolicyIds: [],
        aiPersonality: 'BUILDER',
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
  } as GameState;
}

describe('influenceDiplomacyCore', () => {
  it('derives default balance from diplomatic favor', () => {
    const s = makeState();
    expect(getInfluenceBalance(s, 0)).toBeGreaterThan(getInfluenceBalance(s, 1));
  });

  it('ticks influence economy per turn', () => {
    const s = makeState();
    const n = tickInfluenceEconomy(s);
    expect(getInfluenceBalance(n, 0)).toBeGreaterThan(getInfluenceBalance(s, 0));
  });

  it('normalizes balances for all civs', () => {
    const s = makeState();
    const norm = normalizeInfluenceDiplomacy(s);
    expect(Object.keys(norm.balances).length).toBe(2);
    expect(canSpendInfluence({ ...s, systems: { ...s.systems, influenceDiplomacy: norm } }, 0, 3)).toBe(true);
  });
});

