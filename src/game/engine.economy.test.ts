import { describe, expect, it } from 'vitest';
import { assignWorkedTiles, buildImprovement } from './engine';
import { createDefaultSystems } from './featureSystems';
import { hexDistance } from './mapgen';
import type { Tile, City, GameState, Unit, Civilization } from './types';

function makeTile(q: number, r: number, partial: Partial<Tile> = {}): Tile {
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
    revealed: [true],
    visible: [true],
    ...partial,
  };
}

function makeGrid(w: number, h: number): Tile[][] {
  const tiles: Tile[][] = [];
  for (let r = 0; r < h; r++) {
    const row: Tile[] = [];
    for (let q = 0; q < w; q++) row.push(makeTile(q, r));
    tiles.push(row);
  }
  return tiles;
}

function makeCity(id: number, owner: number, q: number, r: number, population = 5): City {
  return {
    id,
    name: `City${id}`,
    owner,
    q,
    r,
    population,
    food: 0,
    foodNeeded: 10,
    buildings: [],
    productionQueue: [],
    workedTiles: [],
    yields: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
    isCapital: true,
    defense: 20,
    hp: 200,
    maxHp: 200,
    turnFounded: 1,
    majorityReligionIndex: null,
    housing: 5,
    amenities: 0,
    loyalty: 100,
    greatWorkIds: [],
  };
}

describe('assignWorkedTiles', () => {
  it('only works tiles within hex distance 3', () => {
    const tiles = makeGrid(10, 10);
    const city = makeCity(1, 0, 5, 5, 30);
    assignWorkedTiles(city, tiles, [city]);
    for (const w of city.workedTiles) {
      expect(hexDistance(city.q, city.r, w.q, w.r)).toBeLessThanOrEqual(3);
      expect(w.q === city.q && w.r === city.r).toBe(false);
    }
  });

  it('does not poach tiles owned by another civilization', () => {
    const tiles = makeGrid(10, 10);
    // Mark a neighbour tile as enemy-owned
    tiles[5][6].owner = 1;
    const city = makeCity(1, 0, 5, 5, 30);
    assignWorkedTiles(city, tiles, [city]);
    expect(city.workedTiles.some(w => w.q === 6 && w.r === 5)).toBe(false);
  });
});

function makeCiv(id: number): Civilization {
  return {
    id,
    name: `Civ${id}`,
    adjective: `Civ${id}`,
    leader: 'Leader',
    color: '#fff',
    secondaryColor: '#000',
    isHuman: true,
    isAlive: true,
    capital: 1,
    cities: [1],
    units: [10],
    resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
    lastTurnIncome: {},
    researchedTechs: ['agriculture'],
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
  };
}

function makeWorker(partial: Partial<Unit> = {}): Unit {
  return {
    id: 10,
    type: 'worker',
    owner: 0,
    q: 1,
    r: 1,
    hp: 100,
    maxHp: 100,
    movement: 2,
    maxMovement: 2,
    strength: 0,
    rangedStrength: 0,
    range: 0,
    hasAttacked: false,
    promotions: [],
    era: 'ancient',
    name: 'Worker',
    workerBuildsRemaining: 3,
    ...partial,
  };
}

function makeWorkerState(): GameState {
  const tiles = makeGrid(5, 5);
  for (const row of tiles) {
    for (const t of row) t.owner = 0;
  }
  const city = makeCity(1, 0, 0, 0, 2);
  tiles[0][0].city = city.id;
  tiles[1][1].unit = 10;
  return {
    systems: createDefaultSystems(),
    settings: {
      mapWidth: 5,
      mapHeight: 5,
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
    cities: [city],
    units: [makeWorker()],
    civilizations: [makeCiv(0)],
    relations: [],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 2,
    nextUnitId: 11,
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

function placeWorkerForNextBuild(state: GameState, q: number, r: number): GameState {
  return {
    ...state,
    units: state.units.map(u => (u.id === 10 ? { ...u, q, r, movement: 2 } : u)),
    tiles: state.tiles.map(row => row.map(t => ({ ...t, unit: t.q === q && t.r === r ? 10 : null }))),
  };
}

describe('worker build charges', () => {
  it('consumes the worker after three completed improvements', () => {
    let s = makeWorkerState();
    s = buildImprovement(s, 10, 'farm');
    expect(s.units.find(u => u.id === 10)?.workerBuildsRemaining).toBe(2);

    s = placeWorkerForNextBuild(s, 2, 1);
    s = buildImprovement(s, 10, 'farm');
    expect(s.units.find(u => u.id === 10)?.workerBuildsRemaining).toBe(1);

    s = placeWorkerForNextBuild(s, 3, 1);
    s = buildImprovement(s, 10, 'farm');
    expect(s.units.some(u => u.id === 10)).toBe(false);
    expect(s.civilizations[0]!.units.includes(10)).toBe(false);
  });
});
