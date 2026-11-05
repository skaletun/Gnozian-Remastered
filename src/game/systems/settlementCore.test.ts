import { describe, expect, it } from 'vitest';
import type { City, GameState } from '../types';
import {
  applySettlementYieldModel,
  canAssignDistrictSpecialists,
  canBuildDistrict,
  canUpgradeTownToCity,
  normalizeSettlement,
  settlementLimitForCiv,
  settlementSoftCapPenalty,
} from './settlementCore';

function makeCity(id: number, owner: number): City {
  return {
    id,
    name: `S${id}`,
    owner,
    q: 0,
    r: 0,
    population: 5,
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
    amenities: 2,
    loyalty: 100,
    greatWorkIds: [],
    settlementKind: 'town',
    townSpecialization: 'mercantile',
    settlementTier: 1,
    districts: [],
  };
}

function makeState(cityCount: number): GameState {
  const cities = Array.from({ length: cityCount }, (_, i) => makeCity(i + 1, 0));
  const size = 8;
  const tiles: GameState['tiles'] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, q) => ({
      q,
      r,
      terrain: 'plains',
      improvement: 'none',
      resource: null,
      owner: 0,
      city: null,
      territoryCityId: null,
      unit: null,
      revealed: [true],
      visible: [true],
    }))
  );
  if (tiles[0]?.[0]) tiles[0][0].city = cities[0]?.id ?? null;
  return {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: 4,
      mapHeight: 4,
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
    tiles,
    cities,
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
        cities: cities.map(c => c.id),
        units: [],
        resources: { food: 0, production: 0, gold: 500, science: 0, culture: 0, faith: 0, happiness: 0 },
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
        diplomaticFavor: 0,
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
    nextCityId: 99,
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
  } as unknown as GameState;
}

describe('settlementCore', () => {
  it('normalizes town settlement with a center district', () => {
    const normalized = normalizeSettlement(makeCity(1, 0));
    expect(normalized.settlementKind).toBe('town');
    expect(normalized.districts?.some(d => d.type === 'urban_center')).toBe(true);
  });

  it('applies town specialization yield model', () => {
    const city = normalizeSettlement(makeCity(2, 0));
    const y = applySettlementYieldModel(city, {
      food: 10,
      production: 8,
      gold: 5,
      science: 4,
      culture: 4,
      faith: 0,
      happiness: 0,
    });
    expect(y.gold).toBeGreaterThan(5);
    expect(y.production).toBeLessThan(8);
  });

  it('computes soft-cap penalty and checks upgrade requirements', () => {
    const state = makeState(5);
    const limit = settlementLimitForCiv(state, 0);
    expect(limit).toBeGreaterThanOrEqual(2);
    expect(settlementSoftCapPenalty(state, 0)).toBeGreaterThanOrEqual(0);
    const firstCityId = state.cities[0]!.id;
    const result = canUpgradeTownToCity(state, firstCityId, 0);
    expect(result.ok).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
  });

  it('validates district build rules for towns', () => {
    const state = makeState(1);
    const city = state.cities[0]!;
    city.q = 2;
    city.r = 2;
    const denied = canBuildDistrict(state, city.id, 'campus', 3, 2, 0);
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe('town_needs_upgrade');
    const allowed = canBuildDistrict(state, city.id, 'rural_farms', 3, 2, 0);
    expect(allowed.ok).toBe(true);
  });

  it('enforces specialist caps across districts', () => {
    const state = makeState(1);
    const city = state.cities[0]!;
    city.population = 4;
    city.settlementKind = 'city';
    city.districts = [
      { id: 'district-1-center', kind: 'urban', type: 'urban_center', q: 2, r: 2, level: 1, specialists: 0, establishedTurn: 1 },
      { id: 'district-1-campus', kind: 'urban', type: 'campus', q: 3, r: 2, level: 1, specialists: 2, establishedTurn: 1 },
      { id: 'district-1-market', kind: 'urban', type: 'market', q: 2, r: 3, level: 1, specialists: 0, establishedTurn: 1 },
    ];
    const ok = canAssignDistrictSpecialists(state, city.id, 'district-1-market', 1, 0);
    expect(ok.ok).toBe(true);
    const blocked = canAssignDistrictSpecialists(state, city.id, 'district-1-market', 5, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('specialist_cap_reached');
  });
});

