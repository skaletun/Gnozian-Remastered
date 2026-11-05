import { describe, expect, it } from 'vitest';
import { combatUnit, attackCity, declareWar } from './engine';
import type { GameState, Tile, Unit, City, Civilization } from './types';

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
    revealed: [true, true],
    visible: [true, true],
    ...partial,
  };
}

function makeCiv(id: number, partial: Partial<Civilization> = {}): Civilization {
  return {
    id,
    name: `Civ${id}`,
    adjective: `Civ${id}`,
    leader: 'Leader',
    color: '#ffffff',
    secondaryColor: '#000000',
    isHuman: id === 0,
    isAlive: true,
    capital: null,
    cities: [],
    units: [],
    resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
    lastTurnIncome: {},
    researchedTechs: [],
    currentResearch: null,
    researchProgress: 0,
    researchedCivics: ['code_of_laws'],
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
    ...partial,
  } as Civilization;
}

function makeWarrior(id: number, owner: number, q: number, r: number, partial: Partial<Unit> = {}): Unit {
  return {
    id,
    type: 'warrior',
    owner,
    q,
    r,
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

function makeCity(id: number, owner: number, q: number, r: number, partial: Partial<City> = {}): City {
  return {
    id,
    name: `City${id}`,
    owner,
    q,
    r,
    population: 1,
    food: 0,
    foodNeeded: 10,
    buildings: [],
    productionQueue: [],
    workedTiles: [],
    yields: { food: 2, production: 1, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
    isCapital: true,
    defense: 20,
    hp: 5,
    maxHp: 200,
    turnFounded: 1,
    majorityReligionIndex: null,
    housing: 4,
    amenities: 0,
    loyalty: 100,
    greatWorkIds: [],
    ...partial,
  };
}

function makeBaseState(units: Unit[], cities: City[] = [], civs: Civilization[] = [makeCiv(0), makeCiv(1)]): GameState {
  const W = 6;
  const H = 6;
  const tiles: Tile[][] = [];
  for (let r = 0; r < H; r++) {
    const row: Tile[] = [];
    for (let q = 0; q < W; q++) row.push(makeTile(q, r));
    tiles.push(row);
  }
  for (const u of units) {
    const t = tiles[u.r]?.[u.q];
    if (t) t.unit = u.id;
    const civ = civs[u.owner];
    if (civ) civ.units = [...civ.units, u.id];
  }
  for (const c of cities) {
    const t = tiles[c.r]?.[c.q];
    if (t) t.city = c.id;
    const civ = civs[c.owner];
    if (civ) civ.cities = [...civ.cities, c.id];
    if (c.isCapital && civs[c.owner]) civs[c.owner]!.capital = c.id;
  }
  const state: GameState = {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: W,
      mapHeight: H,
      numCivs: civs.length,
      difficulty: 'prince',
      seed: 42,
      maxTurns: 500,
      mapType: 'continents',
      civNames: civs.map(c => c.name),
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 5,
    currentCivIndex: 0,
    tiles,
    cities,
    units,
    civilizations: civs,
    relations: [],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: cities.length + 1,
    nextUnitId: units.length + 1,
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
  return state;
}

describe('combatUnit', () => {
  it('rejects attack without war declaration', () => {
    const a = makeWarrior(1, 0, 1, 1);
    const d = makeWarrior(2, 1, 2, 1);
    const s = makeBaseState([a, d]);
    const after = combatUnit(s, 1, 2);
    expect(after.units.find(u => u.id === 2)?.hp).toBe(100);
    expect(after.messages.some(m => m.type === 'warning')).toBe(true);
  });

  it('damages defender after war declaration', () => {
    const a = makeWarrior(1, 0, 1, 1);
    const d = makeWarrior(2, 1, 2, 1, { hp: 50 });
    let s = makeBaseState([a, d]);
    s = declareWar(s, 0, 1);
    const after = combatUnit(s, 1, 2);
    const def = after.units.find(u => u.id === 2);
    const atk = after.units.find(u => u.id === 1);
    expect(atk?.hasAttacked).toBe(true);
    if (def) expect(def.hp).toBeLessThan(50);
  });
});

describe('combat determinism', () => {
  it('produces identical state for identical input (seeded RNG)', () => {
    const a1 = makeWarrior(1, 0, 1, 1);
    const d1 = makeWarrior(2, 1, 2, 1);
    const s1 = makeBaseState([a1, d1]);
    const s1war = declareWar(s1, 0, 1);
    const r1 = combatUnit(s1war, 1, 2);

    const a2 = makeWarrior(1, 0, 1, 1);
    const d2 = makeWarrior(2, 1, 2, 1);
    const s2 = makeBaseState([a2, d2]);
    const s2war = declareWar(s2, 0, 1);
    const r2 = combatUnit(s2war, 1, 2);

    expect(r1.units.find(u => u.id === 1)?.hp).toBe(r2.units.find(u => u.id === 1)?.hp);
    expect(r1.units.find(u => u.id === 2)?.hp).toBe(r2.units.find(u => u.id === 2)?.hp);
  });
});

describe('attackCity', () => {
  it('captures a city when its hp falls to 0', () => {
    const civ0 = makeCiv(0);
    const civ1 = makeCiv(1);
    const attacker = makeWarrior(1, 0, 1, 1, { strength: 200 });
    const city = makeCity(10, 1, 2, 1, { hp: 5, defense: 0 });
    let s = makeBaseState([attacker], [city], [civ0, civ1]);
    s = declareWar(s, 0, 1);
    const after = attackCity(s, 1, 10);
    const captured = after.cities.find(c => c.id === 10);
    expect(captured?.owner).toBe(0);
    expect(captured?.isCapital).toBe(false);
    expect(after.civilizations[0]?.cities).toContain(10);
    expect(after.civilizations[1]?.cities).not.toContain(10);
    expect(after.civilizations[1]?.isAlive).toBe(false);
    expect(after.civilizations[1]?.capital).toBeNull();
  });

  it('rejects city attack without war declaration', () => {
    const attacker = makeWarrior(1, 0, 1, 1, { strength: 200 });
    const city = makeCity(10, 1, 2, 1, { hp: 5, defense: 0 });
    const s = makeBaseState([attacker], [city]);
    const after = attackCity(s, 1, 10);
    expect(after.cities.find(c => c.id === 10)?.owner).toBe(1);
    expect(after.messages.some(m => m.type === 'warning')).toBe(true);
  });
});
