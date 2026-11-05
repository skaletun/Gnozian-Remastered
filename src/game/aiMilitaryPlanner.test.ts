import { describe, expect, it } from 'vitest';
import { chooseCombatObjective } from './aiMilitaryPlanner';
import type { AIPersonality, AIStrategicPosture } from './aiStrategy';
import type { City, GameState, Unit } from './types';

const soldier = (id: number, owner: number, q: number, r: number): Unit => ({
  id, owner, q, r, type: 'warrior', hp: 100, maxHp: 100, movement: 2,
  maxMovement: 2, strength: 20, rangedStrength: 0, range: 0,
  hasAttacked: false, promotions: [], era: 'ancient', name: 'Warrior',
});
const state = (units: Unit[], cities: City[] = [], war = true): GameState => ({
  units, cities, civilizations: [{ isAlive: true }, { isAlive: true }, { isAlive: true }],
  relations: war ? [{ civA: 0, civB: 1, status: 'war' }] : [],
} as unknown as GameState);
const personality = { aggressiveness: 95 } as AIPersonality;
const posture: AIStrategicPosture = {
  skill: 0.9, phase: 'midgame', atWar: true, militaryRatio: 1,
  victoryFocus: 'military', expansionPressure: 0, threatLevel: 0,
  developmentPressure: 0, targetCiv: null, defensiveCityId: null,
  empire: { cities: 1, units: 1, combatUnits: 1, researchedTechs: 0,
    researchedCivics: 0, totalPopulation: 3, totalYield: 4, militaryPower: 20 },
  rivals: [],
};

describe('AI military tactics', () => {
  it('attacks nearby wartime threats before traveling to a defensive objective', () => {
    const city = { id: 8, owner: 1, q: 8, r: 8, hp: 100, maxHp: 100 } as City;
    const s = state([soldier(1, 1, 2, 2), soldier(2, 0, 3, 2)], [city]);
    expect(chooseCombatObjective(s, 1, s.units[0]!, personality,
      { ...posture, threatLevel: 1, defensiveCityId: 8 }, () => 0.5))
      .toMatchObject({ kind: 'attack-unit', unitId: 2 });
  });

  it('pursues a war opponent instead of the nearest neutral combatant', () => {
    const s = state([soldier(1, 1, 1, 1), soldier(3, 2, 2, 1), soldier(2, 0, 6, 5)]);
    expect(chooseCombatObjective(s, 1, s.units[0]!, personality, posture, () => 0.5))
      .toMatchObject({ kind: 'move', targetQ: 6, targetR: 5, reason: 'front' });
  });

  it('does not advance on a neutral city in peacetime', () => {
    const city = { id: 7, owner: 2, q: 6, r: 6, hp: 100, maxHp: 100 } as City;
    const s = state([soldier(1, 1, 1, 1)], [city], false);
    expect(chooseCombatObjective(s, 1, s.units[0]!, personality,
      { ...posture, atWar: false }, () => 0)).toBeNull();
  });
});
