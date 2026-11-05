import { describe, expect, it } from 'vitest';
import type { City, GameState } from '../types';
import {
  applyGrowthChoice,
  createGrowthEvent,
  normalizeCityGrowthState,
  selectAiGrowthChoice,
} from './growthEventsCore';

function makeCity(owner = 0): City {
  return {
    id: 1,
    name: 'Alpha',
    owner,
    q: 2,
    r: 2,
    population: 4,
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
    districts: [{ id: 'district-1-center', kind: 'urban', type: 'urban_center', q: 2, r: 2, level: 1, specialists: 0, establishedTurn: 1 }],
  };
}

function makeState(city: City): GameState {
  const tiles = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 6 }, (_, q) => ({
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
  ) as unknown as GameState['tiles'];
  tiles[city.r]![city.q]!.city = city.id;
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
    turn: 10,
    currentCivIndex: 0,
    tiles,
    cities: [city],
    units: [],
    civilizations: [
      {
        id: 0,
        name: 'A',
        adjective: 'A',
        leader: 'L',
        color: '#fff',
        secondaryColor: '#000',
        isHuman: false,
        isAlive: true,
        capital: city.id,
        cities: [city.id],
        units: [],
        resources: { food: 10, production: 10, gold: 10, science: 10, culture: 10, faith: 0, happiness: 0 },
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
    nextCityId: 2,
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

describe('growthEventsCore', () => {
  it('creates and resolves growth event bonuses', () => {
    const city = makeCity();
    const state = makeState(city);
    city.pendingGrowthEvent = createGrowthEvent(city, 10, state.tiles);
    const target = city.pendingGrowthEvent.targetCandidates?.find(c => c.kind === 'rural');
    const resolved = applyGrowthChoice(city, 'rural_development', target ?? null);
    expect(resolved.pendingGrowthEvent).toBeNull();
    expect((resolved.growthYieldBonuses?.food ?? 0) > 0).toBe(true);
    expect((resolved.growthEventsResolved ?? 0) > 0).toBe(true);
    expect((resolved.districts ?? []).some(d => d.kind === 'rural')).toBe(true);
  });

  it('selects a deterministic AI choice from options', () => {
    const city = makeCity();
    const state = makeState(city);
    city.pendingGrowthEvent = createGrowthEvent(city, 10, state.tiles);
    const choice = selectAiGrowthChoice(state, city);
    expect(city.pendingGrowthEvent?.options.includes(choice)).toBe(true);
  });

  it('normalizes missing growth fields', () => {
    const normalized = normalizeCityGrowthState(makeCity());
    expect(normalized.growthYieldBonuses?.food).toBe(0);
    expect(normalized.growthEventsResolved).toBe(0);
    expect(normalized.pendingGrowthEvent).toBeNull();
  });
});

