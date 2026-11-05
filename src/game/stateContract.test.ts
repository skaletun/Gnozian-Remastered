import { describe, expect, it } from 'vitest';
import { normalizeStateContract, validateStateContractShape } from './kernel/stateContract';
import type { GameState } from './types';

function makeStubState(): GameState {
  return {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: 2,
      mapHeight: 2,
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
        resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
        lastTurnIncome: {},
        researchedTechs: [],
        currentResearch: null,
        researchProgress: 0,
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
        diplomaticFavor: 0,
        consecutivePeaceTurns: 0,
        greatPeopleEarned: 0,
        patronagePoints: 0,
        governmentId: 'chiefdom',
        slottedPolicyIds: [],
        aiPersonality: 'BUILDER',
      } as any,
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
  };
}

describe('state contract', () => {
  it('normalizes civics defaults', () => {
    const s = makeStubState();
    const out = normalizeStateContract(s);
    expect(out.civilizations[0]?.researchedCivics).toEqual(['code_of_laws']);
    expect(out.civilizations[0]?.currentCivic).toBeNull();
    expect(out.civilizations[0]?.civicProgress).toBe(0);
    expect(out.leaders?.[0]?.displayName).toBe('L');
    expect(out.civilizationIdentity?.[0]?.currentName).toBe('A');
    expect(out.systems.influenceDiplomacy).toBeDefined();
  });

  it('normalizes settlement fields for legacy city objects', () => {
    const s = makeStubState();
    s.cities = [
      {
        id: 1,
        name: 'Old',
        owner: 0,
        q: 0,
        r: 0,
        population: 2,
        food: 0,
        foodNeeded: 15,
        buildings: [],
        productionQueue: [],
        workedTiles: [],
        yields: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
        isCapital: false,
        defense: 20,
        hp: 200,
        maxHp: 200,
        turnFounded: 1,
        majorityReligionIndex: null,
        housing: 5,
        amenities: 0,
        loyalty: 100,
        greatWorkIds: [],
      } as any,
    ];
    s.civilizations[0]!.cities = [1];
    const out = normalizeStateContract(s);
    expect(out.cities[0]?.settlementKind).toBe('town');
    expect(out.cities[0]?.districts?.length).toBeGreaterThan(0);
    expect(out.cities[0]?.growthYieldBonuses?.food).toBe(0);
    expect(out.cities[0]?.pendingGrowthEvent).toBeNull();
  });

  it('validates required shape', () => {
    expect(validateStateContractShape(makeStubState())).toBe(true);
    expect(validateStateContractShape({ nope: true })).toBe(false);
  });
});

