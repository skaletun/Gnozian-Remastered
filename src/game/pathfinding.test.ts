import { describe, expect, it } from 'vitest';
import { findNextStepToward, findLeastCostMovementPath, reachableHexMovementCosts } from './pathfinding';
import type { GameState, Unit } from './types';

describe('pathfinding', () => {
  it('returns adjacent step toward target on open terrain', () => {
    const unit: Unit = {
      id: 1,
      type: 'warrior',
      owner: 0,
      q: 0,
      r: 0,
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
    };
    const state = {
      tiles: [
        [{ terrain: 'plains' }, { terrain: 'plains' }, { terrain: 'plains' }],
        [{ terrain: 'plains' }, { terrain: 'plains' }, { terrain: 'plains' }],
        [{ terrain: 'plains' }, { terrain: 'plains' }, { terrain: 'plains' }],
      ],
      units: [unit],
    } as unknown as GameState;

    const step = findNextStepToward(state, unit, 1, 1);
    expect(step).not.toBeNull();
    expect(Math.abs((step?.q ?? 0) - unit.q) + Math.abs((step?.r ?? 0) - unit.r)).toBeGreaterThanOrEqual(1);
  });

  it('finds long owned-territory paths with summed terrain MP (plains)', () => {
    const W = 8;
    const row = Array.from({ length: W }, () => ({ terrain: 'plains', owner: 0 }));
    const tiles = [row] as unknown as GameState['tiles'];
    const unit: Unit = {
      id: 1,
      type: 'warrior',
      owner: 0,
      q: 0,
      r: 0,
      hp: 100,
      maxHp: 100,
      movement: 14,
      maxMovement: 14,
      strength: 20,
      rangedStrength: 0,
      range: 0,
      hasAttacked: false,
      promotions: [],
      era: 'ancient',
      name: 'Warrior',
    };
    const state = { tiles, units: [unit] } as unknown as GameState;
    const costs = reachableHexMovementCosts(state, unit);
    expect(costs.get('7,0')).toBe(7);
    const path = findLeastCostMovementPath(state, unit, 7, 0, { restrictToOwnedTerrain: true });
    expect(path).not.toBeNull();
    expect(path!.some(p => p.q === 7 && p.r === 0)).toBe(true);
  });

  it('blocks restrictToOwnedTerrain paths through neutral strips', () => {
    const row = [
      { terrain: 'plains', owner: 0 },
      { terrain: 'plains', owner: null },
      { terrain: 'plains', owner: 0 },
    ];
    const tiles = [row] as unknown as GameState['tiles'];
    const unit: Unit = {
      id: 1,
      type: 'warrior',
      owner: 0,
      q: 0,
      r: 0,
      hp: 100,
      maxHp: 100,
      movement: 10,
      maxMovement: 10,
      strength: 20,
      rangedStrength: 0,
      range: 0,
      hasAttacked: false,
      promotions: [],
      era: 'ancient',
      name: 'Warrior',
    };
    const state = { tiles, units: [unit] } as unknown as GameState;
    expect(findLeastCostMovementPath(state, unit, 2, 0, { restrictToOwnedTerrain: true })).toBeNull();
    expect(findLeastCostMovementPath(state, unit, 2, 0, { restrictToOwnedTerrain: false })).not.toBeNull();
  });
});
