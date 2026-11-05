import { describe, expect, it } from 'vitest';
import { chooseGreatPersonObjective } from './aiGreatPersonPlanner';
import type { AIStrategicPosture } from './aiStrategy';
import type { City, GameState, Unit } from './types';

const posture: AIStrategicPosture = {
  skill: 0.8,
  phase: 'midgame',
  atWar: false,
  militaryRatio: 1,
  victoryFocus: 'science',
  expansionPressure: 0.4,
  threatLevel: 0,
  developmentPressure: 0.2,
  targetCiv: null,
  defensiveCityId: null,
  empire: {
    cities: 2,
    units: 1,
    combatUnits: 0,
    researchedTechs: 5,
    researchedCivics: 3,
    totalPopulation: 10,
    totalYield: 30,
    militaryPower: 0,
  },
  rivals: [],
};

function city(id: number, q: number, r: number, yields: Partial<City['yields']>): City {
  return {
    id,
    owner: 1,
    q,
    r,
    population: 4,
    isCapital: id === 1,
    yields: { food: 2, production: 2, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0, ...yields },
    greatWorkIds: [],
  } as unknown as City;
}

describe('chooseGreatPersonObjective', () => {
  it('sends scientists to the strongest science city', () => {
    const state = {
      cities: [city(1, 0, 0, { science: 1 }), city(2, 4, 0, { science: 10, production: 5 })],
    } as GameState;
    const unit = { id: 9, owner: 1, q: 0, r: 0, type: 'great_scientist' } as Unit;
    const objective = chooseGreatPersonObjective(state, 1, unit, posture);
    expect(objective.action).toBe('move');
    if (objective.action === 'move') expect(objective.cityId).toBe(2);
  });

  it('activates when already in the preferred city', () => {
    const state = {
      cities: [city(1, 0, 0, { science: 10, production: 5 }), city(2, 4, 0, { science: 1 })],
    } as GameState;
    const unit = { id: 9, owner: 1, q: 0, r: 0, type: 'great_scientist' } as Unit;
    const objective = chooseGreatPersonObjective(state, 1, unit, posture);
    expect(objective.action).toBe('activate');
    if (objective.action === 'activate') expect(objective.cityId).toBe(1);
  });
});
