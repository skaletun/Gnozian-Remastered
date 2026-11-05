import type { GameState, Unit } from './types';
import { getNeighbors, hexDistance } from './mapgen';
import { canAttackAtHexDistance, tileMovementEnterCost } from './movementRules';
import { canFriendlyStackOnTile, isEnemyCombatUnit, unitsAtPosition } from './engine';

/** One-step legal moves from current tile with MP cost (for map overlay). */
export function getNeighborMoveLabels(
  state: GameState,
  unit: Unit,
  _viewerCivIndex: number
): Array<{ q: number; r: number; cost: number }> {
  const w = state.tiles[0]?.length ?? 0;
  const h = state.tiles.length;
  if (!w || !h) return [];
  const out: Array<{ q: number; r: number; cost: number }> = [];
  for (const n of getNeighbors(unit.q, unit.r, w, h)) {
    const tile = state.tiles[n.r]?.[n.q];
    if (!tile) continue;
    const cost = tileMovementEnterCost(tile.terrain, unit.type, {
      state,
      civIndex: unit.owner,
      fromQ: unit.q,
      fromR: unit.r,
      toQ: n.q,
      toR: n.r,
    });
    if (cost == null || cost > unit.movement) continue;
    const destOwner = tile.owner;
    if (destOwner != null && destOwner !== unit.owner) {
      const rel = state.relations.find(
        r =>
          (r.civA === unit.owner && r.civB === destOwner) || (r.civA === destOwner && r.civB === unit.owner)
      );
      if (rel?.status === 'armistice') continue;
    }
    const enemy = unitsAtPosition(state, n.q, n.r).find(u => isEnemyCombatUnit(u, unit.owner));
    if (enemy) continue;
    if (!canFriendlyStackOnTile(state, unit.owner, unit.type, n.q, n.r, unit.id)) continue;
    out.push({ q: n.q, r: n.r, cost });
  }
  return out;
}

/** Strike preview on empty/visible tiles (same rules as unit-vs-unit range). */
export function isHexInStrikeZone(
  unit: Pick<Unit, 'range' | 'movement' | 'maxMovement' | 'type' | 'rangedStrength'>,
  uq: number,
  ur: number,
  tq: number,
  tr: number
): boolean {
  const d = hexDistance(uq, ur, tq, tr);
  if (d === 0) return false;
  return canAttackAtHexDistance(unit, d, 'unit');
}
