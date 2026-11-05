import { describe, expect, it } from 'vitest';
import { cityFoundingSiteError, cityFoundingValidationError, MIN_CITY_SPACING } from './cityFoundingRules';
import { foundCity } from './engine';
import { chooseSettlerObjective } from './aiExpansionPlanner';
import type { AIEngineAPI } from './ai';
import type { AIPersonality, AIStrategicPosture } from './aiStrategy';
import type { City, GameState, Tile, Unit } from './types';

function makeSite(q: number, r: number): Tile {
  return {
    q, r, terrain: 'plains', improvement: 'none', resource: null,
    owner: null, city: null, territoryCityId: null, unit: null,
    revealed: [true, true], visible: [true, true],
  };
}

function makeSettler(id = 10, owner = 0, q = 3, r = 3): Unit {
  return {
    id, owner, type: 'settler', q, r, hp: 100, maxHp: 100,
    movement: 2, maxMovement: 2, strength: 0, rangedStrength: 0,
    range: 0, hasAttacked: false, promotions: [], era: 'ancient', name: 'Settler',
  };
}

function makeState(): GameState {
  return {
    turn: 1,
    tiles: Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, q) => makeSite(q, r))),
    cities: [],
    units: [makeSettler()],
    civilizations: [{ isAlive: true }, { isAlive: true }],
    messages: [],
  } as unknown as GameState;
}

const city = (id: number, owner: number, q: number, r: number): City =>
  ({ id, owner, q, r, population: 2, hp: 100, maxHp: 100 }) as City;

describe('authoritative 4X founding validation', () => {
  it('requires a living civ and a real, local, active settler', () => {
    const s = makeState();
    expect(cityFoundingValidationError(s, 0, 3, 3, 10)).toBeNull();
    expect(cityFoundingValidationError(s, 0, 3, 3, 999)).toMatch(/settler/);
    expect(cityFoundingValidationError(s, 1, 3, 3, 10)).toMatch(/settler/);
    expect(cityFoundingValidationError(s, 0, 4, 3, 10)).toMatch(/stand/);
    s.units[0]!.movement = 0;
    expect(cityFoundingValidationError(s, 0, 3, 3, 10)).toMatch(/movement/);
    s.units[0]!.movement = 2;
    (s.civilizations[0] as { isAlive: boolean }).isAlive = false;
    expect(cityFoundingValidationError(s, 0, 3, 3, 10)).toMatch(/active/);
  });

  it('blocks water, mountains, foreign ownership, occupation and out-of-map coordinates', () => {
    const s = makeState();
    for (const terrain of ['coast', 'ocean', 'mountains'] as const) {
      s.tiles[3]![3]!.terrain = terrain;
      expect(cityFoundingSiteError(s, 0, 3, 3)).not.toBeNull();
    }
    s.tiles[3]![3]!.terrain = 'plains';
    s.tiles[3]![3]!.owner = 1;
    expect(cityFoundingSiteError(s, 0, 3, 3)).toMatch(/belongs/);
    s.tiles[3]![3]!.owner = null;
    s.units.push(makeSettler(11, 1, 3, 3));
    expect(cityFoundingSiteError(s, 0, 3, 3)).toMatch(/opposing/);
    expect(cityFoundingSiteError(s, 0, -1, 3)).toMatch(/outside/);
  });

  it('prevents founding within two hexes of any civilization city', () => {
    const s = makeState();
    expect(MIN_CITY_SPACING).toBe(3);
    s.cities.push(city(5, 1, 5, 3));
    expect(cityFoundingSiteError(s, 0, 3, 3)).toMatch(/too close/);
    expect(cityFoundingSiteError(s, 0, 2, 3)).toBeNull();
    s.cities[0]!.q = 6;
    expect(cityFoundingSiteError(s, 0, 3, 3)).toBeNull();
  });

  it('rejects forged multiplayer founding commands before altering the game state', () => {
    const s = makeState();
    const after = foundCity(s, 0, 3, 3, 999);
    expect(after.cities).toHaveLength(0);
    expect(after.units).toHaveLength(1);
    expect(after.nextCityId).toBeUndefined();
    expect(after.messages.some(message => message.type === 'warning')).toBe(true);
  });
});

describe('settler AI uses the same city-spacing rules as players', () => {
  it('never settles in the forbidden two-hex radius of foreign cities', () => {
    const s = makeState();
    s.units = [makeSettler(10, 0, 3, 3)];
    s.cities = [city(1, 1, 5, 3)];
    const p = {
      skill: 0.7, phase: 'opening', atWar: false, militaryRatio: 1,
      victoryFocus: 'economy', expansionPressure: 0.8, threatLevel: 0,
      developmentPressure: 0.5, targetCiv: null, defensiveCityId: null,
      empire: { cities: 0, units: 1, combatUnits: 0, researchedTechs: 0,
        researchedCivics: 0, totalPopulation: 0, totalYield: 0, militaryPower: 0 },
      rivals: [],
    } satisfies AIStrategicPosture;
    const api = {
      calcTileYield: () => ({ food: 2, production: 2, gold: 1 }),
    } as unknown as AIEngineAPI;
    const personality = { expansionist: true } as AIPersonality;
    const objective = chooseSettlerObjective(s, 0, s.units[0]!, api, personality, p, () => 0);
    expect(objective.action).not.toBe('settle');
    if (objective.action === 'move') {
      expect(cityFoundingSiteError(s, 0, objective.q, objective.r)).toBeNull();
    }
  });
});
