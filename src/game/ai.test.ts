import { describe, expect, it } from 'vitest';
import { runAITurn, type AIEngineAPI } from './ai';
import type { City, Civilization, GameState, Tile, Unit } from './types';

function makeTile(q: number, r: number, visibleToAi = true): Tile {
  return {
    q,
    r,
    terrain: 'plains',
    improvement: 'none',
    resource: null,
    owner: null,
    city: null,
    territoryCityId: null,
    unit: null,
    revealed: [true, visibleToAi],
    visible: [true, visibleToAi],
  };
}

function makeCiv(id: number, partial: Partial<Civilization> = {}): Civilization {
  return {
    id,
    name: `Civ${id}`,
    adjective: `Civ${id}`,
    leader: 'Leader',
    color: '#fff',
    secondaryColor: '#000',
    isHuman: id === 0,
    isAlive: true,
    capital: null,
    cities: [],
    units: [],
    resources: { food: 80, production: 80, gold: 120, science: 20, culture: 20, faith: 0, happiness: 10 },
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
    diplomaticFavor: 80,
    consecutivePeaceTurns: 0,
    greatPeopleEarned: 0,
    patronagePoints: 0,
    governmentId: 'chiefdom',
    slottedPolicyIds: [],
    aiPersonality: 'BUILDER',
    ...partial,
  };
}

function makeCity(id: number, owner: number, q: number, r: number, partial: Partial<City> = {}): City {
  return {
    id,
    name: `City${id}`,
    owner,
    q,
    r,
    population: 3,
    food: 0,
    foodNeeded: 20,
    buildings: [],
    productionQueue: [],
    workedTiles: [],
    yields: { food: 4, production: 3, gold: 1, science: 0, culture: 0, faith: 0, happiness: 0 },
    isCapital: true,
    defense: 20,
    hp: 100,
    maxHp: 100,
    turnFounded: 1,
    majorityReligionIndex: null,
    housing: 4,
    amenities: 5,
    loyalty: 100,
    greatWorkIds: [],
    ...partial,
  };
}

function makeUnit(id: number, owner: number, q: number, r: number, partial: Partial<Unit> = {}): Unit {
  return {
    id,
    owner,
    q,
    r,
    type: 'warrior',
    hp: 100,
    maxHp: 100,
    movement: 2,
    maxMovement: 2,
    strength: 20,
    rangedStrength: 0,
    range: 0,
    hasAttacked: false,
    promotions: [],
    era: 'ancient',
    name: 'Warrior',
    ...partial,
  };
}

function makeState(visibleEnemy = true): GameState {
  const tiles = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, q) => makeTile(q, r, true)));
  tiles[2]![2]!.visible[1] = visibleEnemy;
  tiles[2]![2]!.revealed[1] = visibleEnemy;

  const aiCity = makeCity(2, 1, 1, 1);
  const aiUnit = makeUnit(20, 1, 1, 2);
  const enemyUnit = makeUnit(10, 0, 2, 2, { hp: 35 });
  tiles[1]![1]!.city = aiCity.id;
  tiles[2]![1]!.unit = aiUnit.id;
  tiles[2]![2]!.unit = enemyUnit.id;

  const human = makeCiv(0, { cities: [], units: [10], researchedCivics: ['code_of_laws'] });
  const ai = makeCiv(1, {
    isHuman: false,
    capital: aiCity.id,
    cities: [aiCity.id],
    units: [aiUnit.id],
    aiPersonality: 'AGGRESSIVE',
  });

  return {
    systems: { wonderOwners: {} } as GameState['systems'],
    settings: {
      mapWidth: 5,
      mapHeight: 5,
      numCivs: 2,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['Human', 'AI'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 8,
    currentCivIndex: 0,
    tiles,
    cities: [aiCity],
    units: [enemyUnit, aiUnit],
    civilizations: [human, ai],
    relations: [{ civA: 0, civB: 1, status: 'war', turnsAtWar: 1, tradeRoutes: 0, peaceLockedUntilTurn: 0, armisticeUntilTurn: 0, trust: -20, grievances: 20 }],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 3,
    nextUnitId: 21,
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

function makeMockApi(calls: string[]): AIEngineAPI {
  return {
    startResearch: (state, civ, tech) => {
      calls.push(`research:${tech}`);
      const civilizations = state.civilizations.map(c => (c.id === civ ? { ...c, currentResearch: tech } : c));
      return { ...state, civilizations };
    },
    startCivicResearch: (state, civ, civicId) => {
      calls.push(`civic:${civicId}`);
      const civilizations = state.civilizations.map(c => (c.id === civ ? { ...c, currentCivic: civicId } : c));
      return { ...state, civilizations };
    },
    addToProductionQueue: (state, cityId, item) => {
      calls.push(`production:${item.type}:${item.id}`);
      const cities = state.cities.map(city =>
        city.id === cityId ? { ...city, productionQueue: [...city.productionQueue, item] } : city
      );
      return { ...state, cities };
    },
    moveUnit: (state, unitId, toQ, toR) => {
      calls.push(`move:${unitId}:${toQ},${toR}`);
      const units = state.units.map(unit => (unit.id === unitId ? { ...unit, q: toQ, r: toR, movement: 0 } : unit));
      return { ...state, units };
    },
    foundCity: state => state,
    combatUnit: (state, attackerId, defenderId) => {
      calls.push(`combat:${attackerId}:${defenderId}`);
      const units = state.units.map(unit => (unit.id === attackerId ? { ...unit, hasAttacked: true, movement: 0 } : unit));
      return { ...state, units };
    },
    attackCity: state => state,
    declareWar: state => state,
    makePeace: state => state,
    signArmistice: state => state,
    proposeDiplomaticSettlement: state => state,
    formAlliance: state => state,
    leaveAlliance: state => state,
    addTradeRoute: state => state,
    signTradeAgreement: state => state,
    canDeclareWar: () => false,
    areAtWar: () => true,
    isMilitarilyEngaged: () => true,
    bestNeighborToward: () => ({ q: 2, r: 2 }),
    calcTileYield: () => ({ food: 2, production: 1, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }),
    canFriendlyStackOnTile: () => true,
    activateGreatPerson: state => state,
    listValidWorkerImprovements: () => [],
    buildImprovement: state => state,
  };
}

describe('runAITurn', () => {
  it('starts research/civics, queues production, and attacks visible wartime targets', () => {
    const calls: string[] = [];
    const out = runAITurn(makeState(true), 1, makeMockApi(calls));
    expect(calls.some(call => call.startsWith('research:'))).toBe(true);
    expect(calls.some(call => call.startsWith('civic:'))).toBe(true);
    expect(calls.some(call => call.startsWith('production:'))).toBe(true);
    expect(calls).toContain('combat:20:10');
    expect(out.units.find(unit => unit.id === 10)).toBeTruthy();
  });

  it('does not target combat units hidden by fog of war', () => {
    const calls: string[] = [];
    const out = runAITurn(makeState(false), 1, makeMockApi(calls));
    expect(calls.some(call => call.startsWith('combat:'))).toBe(false);
    expect(out.units.find(unit => unit.id === 10)).toBeTruthy();
  });
});
