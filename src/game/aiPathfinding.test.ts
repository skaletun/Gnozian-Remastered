import { describe, expect, it } from 'vitest';
import type { GameState, Unit, TerrainType, Tile } from './types';
import { hexDistance } from './mapgen';
import { findStrategicNextStep } from './aiPathfinding';

const warrior = (partial: Partial<Unit> = {}): Unit => ({
  id: 1, owner: 0, type: 'warrior', q: 0, r: 2,
  hp: 100, maxHp: 100, movement: 2, maxMovement: 2,
  strength: 20, rangedStrength: 0, range: 0, hasAttacked: false,
  promotions: [], era: 'ancient', name: 'Warrior', ...partial,
});
const world = (terrain: TerrainType[][], unit = warrior(), others: Unit[] = []): GameState => ({
  tiles: terrain.map((row, r) => row.map((t, q) => ({
    q, r, terrain: t, owner: null, improvement: 'none', city: null,
    resource: null, revealed: [true, true], visible: [true, true],
  } as Tile))),
  units: [unit, ...others],
  relations: [],
} as unknown as GameState);

describe('multi-turn strategic pathfinding (AI)', () => {
  it('plans a faraway destination beyond current movement points', () => {
    const state = world([Array.from({length:10},()=> 'plains' as const)], warrior({r:0}));
    const step = findStrategicNextStep(state,state.units[0]!,9,0);
    expect(step).toEqual({q:1,r:0});
  });
  it('detours around an impassable mountain barrier', () => {
    const tiles:TerrainType[][] = [
      ['plains','mountains','plains','plains','plains'],
      ['plains','mountains','plains','plains','plains'],
      ['plains','mountains','plains','plains','plains'],
      ['plains','mountains','plains','plains','plains'],
      ['plains','plains','plains','plains','plains'],
    ];
    const state = world(tiles, warrior({q:0,r:2}));
    const step = findStrategicNextStep(state,state.units[0]!,4,2);
    expect(step).not.toBeNull();
    expect(step).toEqual({q:0,r:3});
  });
  it('never suggests an unaffordable first step', () => {
    const state = world([['plains','hills','plains']],warrior({r:0,movement:1}));
    expect(findStrategicNextStep(state,state.units[0]!,2,0)).toBeNull();
  });
  it('stops adjacent to an enemy unit instead of stepping onto it', () => {
    const me = warrior({r:0});
    const enemy = warrior({id:5,owner:1,q:4,r:0,type:'spearman'});
    const state=world([Array.from({length:6},()=> 'plains' as const)], me,[enemy]);
    const step=findStrategicNextStep(state,me,4,0);
    expect(step).toEqual({q:1,r:0});
    expect(hexDistance(step!.q,step!.r,me.q,me.r)).toBe(1);
  });
  it('does not cheat by planning a forbidden mountain shortcut', () => {
    const tiles:TerrainType[][]=[
      ['plains','mountains','plains'],
      ['plains','mountains','plains'],
      ['plains','mountains','plains'],
    ];
    const state=world(tiles,warrior({q:0,r:1}));
    expect(findStrategicNextStep(state,state.units[0]!,2,1)).toBeNull();
  });
  it('does not create movement when no MP remain', () => {
    const state=world([['plains','plains','plains']],warrior({r:0,movement:0}));
    expect(findStrategicNextStep(state,state.units[0]!,2,0)).toBeNull();
  });
  it('avoids stepping directly into a visible hostile combat unit', () => {
    const me=warrior({q:0,r:0,type:'settler',strength:0});
    const enemy=warrior({id:8,owner:1,q:1,r:0});
    const state=world([
      ['plains','plains','plains','plains'],
      ['plains','plains','plains','plains'],
      ['plains','plains','plains','plains'],
    ],me,[enemy]);
    const step=findStrategicNextStep(state,me,3,0);
    expect(step).not.toBeNull();
    expect(step).not.toEqual({q:1,r:0});
  });
});
